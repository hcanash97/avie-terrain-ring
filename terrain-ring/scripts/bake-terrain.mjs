// Bakes real elevation around each preset place into public/baked/<slug>.bin
// (PNG, decimetres in R/G) plus src/data/baked.json metadata, so the configurator
// works where live tile servers are unreachable (e.g. a hosted preview).
import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";

const PLACES = [
  ["Snowdon, GB", 53.0685, -4.0763, 6000],
  ["Ben Nevis, GB", 56.7969, -5.0036, 7000],
  ["Matterhorn, CH", 45.9763, 7.6586, 6000],
  ["Table Mountain, ZA", -33.9628, 18.4098, 8000],
  ["Mount Fuji, JP", 35.3606, 138.7274, 20000],
  ["Grand Canyon, US", 36.0997, -112.1124, 16000],
  ["Lake District, GB", 54.46, -3.09, 18000]
];
const TILE = 256, EARTH = 40075016.686;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
const meta = {};

for (const [name, lat, lon, lengthM] of PLACES) {
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
      out[y * size + x] = Math.round(Math.max(0, m) * 10);
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
  meta[name] = { id, size, mPerPx, cx: cx - x0, cy: cy - y0, radiusM: lengthM * 0.72 };
  console.log(`${name}: zoom ${zoom}, ${size}², ${(out.byteLength / 1024).toFixed(0)} KB`);
}
writeFileSync("src/data/baked.json", JSON.stringify(meta, null, 2));
