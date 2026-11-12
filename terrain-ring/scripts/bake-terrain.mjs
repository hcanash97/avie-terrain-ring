// Bakes real elevation around each preset place into public/baked/<slug>.bin
// (PNG, decimetres in R/G) plus src/data/baked.json metadata, so the configurator
// works where live tile servers are unreachable (e.g. a hosted preview).
import { PNG } from "pngjs";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const PLACES = JSON.parse(readFileSync("src/data/presets.json", "utf8"));
const TILE = 256, EARTH = 40075016.686;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
const meta = JSON.parse(readFileSync("src/data/baked.json", "utf8"));

for (const {name, lat, lon, lengthM} of PLACES) {
  if (!process.argv.includes("--all") && meta[name] && existsSync(`public/baked/${meta[name].id}.png`)) continue;
  // High-altitude terrain exceeds 6553.5 m, the decimetre encoding limit.
  const elevationStepM = name === "Mount Everest, NP" ? 0.2 : 0.1;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const zoom = Math.max(1, Math.min(15, Math.round(Math.log2((EARTH * cosLat) / TILE / (lengthM / 320)))));
  const mPerPx = (EARTH * cosLat) / (TILE * 2 ** zoom);
  const scale = TILE * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  const cx = ((lon + 180) / 360) * scale;
  const cy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  const rPx = Math.ceil((lengthM * 0.72) / mPerPx);
  const x0 = Math.floor(cx - rPx), y0 = Math.floor(cy - rPx);
  const size = rPx * 2 + 2;
  const out = new Uint16Array(size * size);
  const tiles = new Map();
  const getTile = async (tx, ty) => {
    const k = `${tx},${ty}`;
    if (!tiles.has(k)) {
      const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${tx}/${ty}.png`);
      if (!res.ok) throw new Error(`${name}: tile ${k} ${res.status}`);
      tiles.set(k, PNG.sync.read(Buffer.from(await res.arrayBuffer())));
    }
    return tiles.get(k);
  };
  for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y0 + size) / TILE); ty++)
    for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + size) / TILE); tx++) await getTile(tx, ty);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = x0 + x, gy = y0 + y;
      const png = tiles.get(`${Math.floor(gx / TILE)},${Math.floor(gy / TILE)}`);
      const i = ((gy % TILE) * TILE + (gx % TILE)) * 4;
      const m = png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768;
      out[y * size + x] = Math.min(65535, Math.round(Math.max(0, m) / elevationStepM));
    }
  }
  const id = slug(name);
  // Lossless PNG: decimetres packed as R = high byte, G = low byte.
  const img = new PNG({ width: size, height: size });
  for (let i = 0; i < out.length; i++) {
    img.data[i * 4] = out[i] >> 8;
    img.data[i * 4 + 1] = out[i] & 255;
    img.data[i * 4 + 2] = 0;
    img.data[i * 4 + 3] = 255;
  }
  writeFileSync(`public/baked/${id}.png`, PNG.sync.write(img));
  meta[name] = { id, size, mPerPx, cx: cx - x0, cy: cy - y0, radiusM: lengthM * 0.72, elevationStepM };
  console.log(`${name}: zoom ${zoom}, ${size}², ${(out.byteLength / 1024).toFixed(0)} KB`);
}
writeFileSync("src/data/baked.json", JSON.stringify(meta, null, 2));
