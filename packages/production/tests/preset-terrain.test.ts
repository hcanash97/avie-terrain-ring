import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { loadSavedTerrain } from "../src/ring-source";

const presets = JSON.parse(
  readFileSync(
    new URL("../../../terrain-ring/src/data/presets.json", import.meta.url),
    "utf8",
  ),
) as { name: string; lat: number; lon: number; lengthM: number }[];
it("all fifteen presets have finite, varied saved terrain and valid map frames", () => {
  expect(presets).toHaveLength(15);
  expect(new Set(presets.map((p) => p.name)).size).toBe(presets.length);
  for (const p of presets) {
    expect(Math.abs(p.lat)).toBeLessThan(85);
    expect(Math.abs(p.lon)).toBeLessThanOrEqual(180);
    const { source, meta } = loadSavedTerrain(p.name);
    expect(meta.radiusM).toBeGreaterThan(p.lengthM / Math.sqrt(2));
    const heights: number[] = [];
    for (let y = -4; y <= 4; y++)
      for (let x = -4; x <= 4; x++)
        heights.push(
          source.elevationAt((x * p.lengthM) / 10, (y * p.lengthM) / 10),
        );
    expect(heights.every(Number.isFinite)).toBe(true);
    expect(Math.max(...heights) - Math.min(...heights), p.name).toBeGreaterThan(
      50,
    );
  }
});
it("Everest retains high-altitude elevation without overflowing sixteen-bit storage", () => {
  const { source, meta } = loadSavedTerrain("Mount Everest, NP");
  expect(meta.elevationStepM).toBe(0.2);
  expect(source.elevationAt(0, 0)).toBeGreaterThan(8000);
});
