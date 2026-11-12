// Crop the ring area out of several captures and place them side by side.
// Usage: node scripts/strip.mjs out.png crop(x,y,w,h) file1.png file2.png ...
import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
const [out, crop, ...files] = process.argv.slice(2);
const [cx, cy, cw, ch] = crop.split(",").map(Number);
const res = new PNG({ width: cw * files.length + 8 * (files.length - 1), height: ch });
res.data.fill(255);
files.forEach((f, n) => {
  const src = PNG.sync.read(readFileSync(f));
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const si = ((cy + y) * src.width + (cx + x)) * 4, di = (y * res.width + n * (cw + 8) + x) * 4;
    const a = src.data[si + 3] / 255; // composite on the stage colour
    for (let c = 0; c < 3; c++) res.data[di + c] = Math.round(src.data[si + c] * a + 236 * (1 - a));
    res.data[di + 3] = 255;
  }
});
writeFileSync(out, PNG.sync.write(res));
