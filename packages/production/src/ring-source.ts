/**
 * Builds the production ring mesh for a configuration, from saved terrain.
 * Uses the same shared terrain engine and ring generator as the preview, at a
 * higher, fixed production resolution, so output is deterministic.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { buildTerrain, frameFor, sampleFrame, type Detail, type TerrainSource } from "@avie/terrain";
import {
  assertRecordedRingGeometryVersion,
  createRingMesh,
  facePreset,
  METAL_DENSITY_G_CM3,
  RING_GEOMETRY_VERSION,
  type BandProfile,
  type HeadShape,
  type ShoulderStyle,
  type Weight
} from "@avie/geometry/terrain-ring";
// Single source of truth for UK sizing lives in the configurator for now.
import { getInnerDiameterMm } from "../../../terrain-ring/src/geometry/ring-sizing";
import { weld, type IndexedMesh } from "./mesh";

export const PRODUCTION_RESOLUTION = { cols: 480, faceSegments: 420, backSegments: 220, widthSegments: 170 } as const;

export type Metal = keyof typeof METAL_DENSITY_G_CM3;

export type RingConfiguration = {
  place: string; // preset name with saved terrain, e.g. "Snowdon, GB"
  lengthM?: number; // ground distance across the face; defaults to the preset's
  bearingDeg: number;
  terrainHeight: number;
  detail: Detail;
  headShape: HeadShape;
  weight: Weight;
  shoulder: ShoulderStyle;
  profile: BandProfile;
  ringSize: string;
  metal: Metal;
  finish: "polished" | "satin";
};

type BakedMeta = { elevationStepM?: number; id: string; size: number; mPerPx: number; cx: number; cy: number; radiusM: number };
const ROOT = resolve(import.meta.dirname, "../../..");
const PRESET_LENGTH_M: Record<string, number> = Object.fromEntries(
  (JSON.parse(readFileSync(resolve(ROOT, "terrain-ring/src/data/presets.json"), "utf8")) as {name: string; lengthM: number}[]).map((p) => [p.name, p.lengthM]),
);

/** Saved elevation for a preset (decimetres packed in R/G of a lossless PNG). */
export function loadSavedTerrain(place: string): { source: TerrainSource; meta: BakedMeta; png: Buffer } {
  const all = JSON.parse(readFileSync(resolve(ROOT, "terrain-ring/src/data/baked.json"), "utf8")) as Record<string, BakedMeta>;
  const meta = all[place];
  if (!meta) throw new Error(`No saved terrain for "${place}". Available: ${Object.keys(all).join(", ")}`);
  const png = readFileSync(resolve(ROOT, `terrain-ring/public/baked/${meta.id}.png`));
  const img = PNG.sync.read(png);
  const n = meta.size;
  const at = (x: number, y: number) => {
    const i = (Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))) * 4;
    return (img.data[i]! * 256 + img.data[i + 1]!) * (meta.elevationStepM ?? 0.1);
  };
  const source: TerrainSource = {
    radiusM: meta.radiusM,
    elevationAt(eastM, northM) {
      const fx = meta.cx + eastM / meta.mPerPx, fy = meta.cy - northM / meta.mPerPx;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), dx = fx - x0, dy = fy - y0;
      return (at(x0, y0) * (1 - dx) + at(x0 + 1, y0) * dx) * (1 - dy) + (at(x0, y0 + 1) * (1 - dx) + at(x0 + 1, y0 + 1) * dx) * dy;
    }
  };
  return { source, meta, png };
}

export function buildProductionRing(config: RingConfiguration, recordedGeometryVersion?: string | null) {
  // Omitted means a new build of the current algorithm. A provided value is a
  // recorded design version: missing or unknown must not fall through to current.
  const geometryAlgorithm = recordedGeometryVersion === undefined
    ? RING_GEOMETRY_VERSION
    : assertRecordedRingGeometryVersion(recordedGeometryVersion);
  const preset = facePreset(config.weight, config.headShape);
  const lengthM = config.lengthM ?? PRESET_LENGTH_M[config.place] ?? 6000;
  const { source } = loadSavedTerrain(config.place);
  const area = frameFor(lengthM, config.bearingDeg, preset);
  const terrain = buildTerrain(source, area, preset, { terrainHeight: config.terrainHeight, detail: config.detail }, PRODUCTION_RESOLUTION.cols);
  // Exact elevation samples the face was built from (metres), for 04_source.
  const rows = terrain.rows;
  const elevations = sampleFrame(source, area, PRODUCTION_RESOLUTION.cols, rows);
  const innerDiameterMm = getInnerDiameterMm(config.ringSize);
  const raw = createRingMesh({
    innerDiameterMm,
    weight: preset,
    shoulder: config.shoulder,
    profile: config.profile,
    terrain,
    resolution: PRODUCTION_RESOLUTION
  }, geometryAlgorithm);
  const mesh: IndexedMesh = weld({ positions: raw.positions, indices: raw.indices, surfaceLabels: raw.surfaceLabels });
  // Relief: highest terrain point above the head's table.
  const tableY = innerDiameterMm / 2 + Math.max(preset.headHeightMm, 0.8);
  let maxY = -Infinity;
  for (let i = 1; i < mesh.positions.length; i += 3) maxY = Math.max(maxY, mesh.positions[i]!);
  return {
    mesh,
    preset,
    lengthM,
    area,
    terrain,
    elevations: { data: elevations, cols: PRODUCTION_RESOLUTION.cols, rows },
    innerDiameterMm,
    reliefMm: maxY - tableY,
    densityGcm3: METAL_DENSITY_G_CM3[config.metal],
    geometryAlgorithm
  };
}
