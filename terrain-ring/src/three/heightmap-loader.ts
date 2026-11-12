/**
 * Real elevation from the public AWS Terrain Tiles dataset (Terrarium PNGs,
 * no API key):  elevation = R × 256 + G + B / 256 − 32768  (metres).
 *
 * Tiles covering a circle around the centre are decoded once into a mosaic;
 * the frame can then be rotated or resized without refetching. In production
 * this moves server-side behind a cache (Phase 14/15).
 */
import type { TerrainSource } from "../geometry/heightmap";

const TILE = 256;
const EARTH_M = 40075016.686;
const tileUrl = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

function worldPx(lat: number, lon: number, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale
  };
}

function loadImage(url: string, signal?: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Tile failed: ${url}`));
    img.src = url;
  });
}

/**
 * @param radiusM  ground radius to cover (half the frame diagonal plus margin)
 * @param metresPerSample  target resolution
 */
export async function loadTerrainSource(
  lat: number,
  lon: number,
  radiusM: number,
  metresPerSample: number,
  signal?: AbortSignal
): Promise<TerrainSource> {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const zoom = Math.max(1, Math.min(15, Math.round(Math.log2((EARTH_M * cosLat) / TILE / metresPerSample))));
  const mPerPx = (EARTH_M * cosLat) / (TILE * 2 ** zoom);
  const c = worldPx(lat, lon, zoom);
  const rPx = radiusM / mPerPx;
  const tiles = 2 ** zoom;
  const tx0 = Math.floor((c.x - rPx) / TILE), tx1 = Math.floor((c.x + rPx) / TILE);
  const ty0 = Math.max(0, Math.floor((c.y - rPx) / TILE)), ty1 = Math.min(tiles - 1, Math.floor((c.y + rPx) / TILE));
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 36) throw new Error("Area too large");

  const canvas = document.createElement("canvas");
  canvas.width = (tx1 - tx0 + 1) * TILE;
  canvas.height = (ty1 - ty0 + 1) * TILE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");

  const jobs: Promise<void>[] = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const wx = ((tx % tiles) + tiles) % tiles;
      jobs.push(loadImage(tileUrl(zoom, wx, ty), signal).then((img) => {
        ctx.drawImage(img, (tx - tx0) * TILE, (ty - ty0) * TILE);
      }));
    }
  }
  await Promise.all(jobs);

  const w = canvas.width, h = canvas.height;
  const px = ctx.getImageData(0, 0, w, h).data;
  const elev = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    elev[i] = px[i * 4]! * 256 + px[i * 4 + 1]! + px[i * 4 + 2]! / 256 - 32768;
  }
  const ox = c.x - tx0 * TILE, oy = c.y - ty0 * TILE;
  const at = (x: number, y: number) =>
    elev[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]!;

  return {
    radiusM,
    elevationAt(eastM, northM) {
      const fx = ox + eastM / mPerPx;
      const fy = oy - northM / mPerPx;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const dx = fx - x0, dy = fy - y0;
      return (at(x0, y0) * (1 - dx) + at(x0 + 1, y0) * dx) * (1 - dy) +
        (at(x0, y0 + 1) * (1 - dx) + at(x0 + 1, y0 + 1) * dx) * dy;
    }
  };
}

export type SearchResult = { name: string; lat: number; lon: number };

/** Place search via OpenStreetMap Nominatim (light use only; swap for Mapbox in production). */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Search failed");
  const json = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return json.map((r) => ({ name: r.display_name.split(",").slice(0, 2).join(","), lat: Number(r.lat), lon: Number(r.lon) }));
}

import baked from "../data/baked.json";

type BakedMeta = { elevationStepM?: number; id: string; size: number; mPerPx: number; cx: number; cy: number; radiusM: number };

/**
 * Pre-baked elevation for the preset places (see scripts/bake-terrain.mjs).
 * Used when live tiles are unreachable, e.g. in a hosted preview.
 */
export async function loadBakedSource(placeName: string, signal?: AbortSignal): Promise<TerrainSource | null> {
  const meta = (baked as Record<string, BakedMeta>)[placeName];
  if (!meta) return null;
  const img = await loadImage(`./baked/${meta.id}.png`, signal);
  const n = meta.size;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, n, n).data;
  const raw = new Float32Array(n * n);
  for (let i = 0; i < raw.length; i++) raw[i] = (px[i * 4]! * 256 + px[i * 4 + 1]!) * (meta.elevationStepM ?? 0.1);
  const at = (x: number, y: number) => raw[Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))]!;
  return {
    radiusM: meta.radiusM,
    elevationAt(eastM, northM) {
      const fx = meta.cx + eastM / meta.mPerPx;
      const fy = meta.cy - northM / meta.mPerPx;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const dx = fx - x0, dy = fy - y0;
      return (at(x0, y0) * (1 - dx) + at(x0 + 1, y0) * dx) * (1 - dy) +
        (at(x0, y0 + 1) * (1 - dx) + at(x0 + 1, y0 + 1) * dx) * dy;
    }
  };
}
