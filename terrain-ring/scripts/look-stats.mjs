// Pixel statistics for look tuning. Usage: node scripts/look-stats.mjs <prefix> [<prefix> ...]
// Counts only fully opaque (ring) pixels; the shadow and background are translucent.
import { PNG } from "pngjs";
import { readFileSync, readdirSync } from "node:fs";

const dir = "../captures";
for (const prefix of process.argv.slice(2)) {
  for (const file of readdirSync(dir).filter((f) => f.startsWith(prefix + "_") && f.endsWith(".png")).sort()) {
    const png = PNG.sync.read(readFileSync(`${dir}/${file}`));
    const lum = [];
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i + 3] < 255) continue;
      lum.push(0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]);
    }
    lum.sort((a, b) => a - b);
    const q = (p) => Math.round(lum[Math.floor(p * (lum.length - 1))]);
    const pct = (f) => ((100 * lum.filter(f).length) / lum.length).toFixed(1).padStart(5);
    console.log(`${file.replace(".png", "").padEnd(44)} clipped ${pct((v) => v >= 250)}%  crushed ${pct((v) => v <= 30)}%  p5 ${String(q(0.05)).padStart(3)}  p50 ${String(q(0.5)).padStart(3)}  p95 ${String(q(0.95)).padStart(3)}`);
  }
}
