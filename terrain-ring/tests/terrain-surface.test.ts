import { describe, expect, it } from "vitest";
import { blur, minMax, normalise, sampleBilinear, sampleFrame, type TerrainSource } from "../src/geometry/heightmap";
import { buildTerrain, frameFor } from "../src/three/terrain-surface";
import { WEIGHTS } from "../src/geometry/ring-blank";

/** Elevation = metres north of centre, so "uphill" is north. */
const slope: TerrainSource = { radiusM: 1e6, elevationAt: (_e, n) => n };

describe("frame sampling and orientation", () => {
  const area = { lengthM: 2000, widthM: 1000, bearingDeg: 0 };
  it("north-up: top row is highest", () => {
    const g = sampleFrame(slope, area, 5, 3);
    expect(g[0]).toBeCloseTo(500);
    expect(g[2 * 5]).toBeCloseTo(-500);
  });
  it("bearing 90 (east up): north is on the left", () => {
    const g = sampleFrame(slope, { ...area, bearingDeg: 90 }, 5, 3);
    expect(g[1 * 5 + 0]).toBeCloseTo(1000); // middle row, left column
    expect(g[1 * 5 + 4]).toBeCloseTo(-1000);
  });
  it("bearing 180 flips north to the bottom", () => {
    const g = sampleFrame(slope, { ...area, bearingDeg: 180 }, 5, 3);
    expect(g[0]).toBeCloseTo(-500);
  });
});

describe("terrain processing", () => {
  it("normalises to 0..1 and handles flat ground", () => {
    expect(minMax(normalise(Float32Array.from([3, 5, 9])))).toEqual([0, 1]);
    expect(Array.from(normalise(new Float32Array(3).fill(7)))).toEqual([0, 0, 0]);
  });
  it("min/max works on large grids", () => {
    expect(minMax(new Float32Array(2_000_000).map((_, i) => i % 7))).toEqual([0, 6]);
  });
  it("low detail softens a spike", () => {
    const n = 32;
    const spike = new Float32Array(n * n);
    spike[16 * n + 16] = 1;
    expect(minMax(blur(spike, n, n, 2))[1]).toBeLessThan(0.2);
    expect(blur(spike, n, n, 0)).toBe(spike);
  });
  it("bilinear sampling on rectangles", () => {
    const g = Float32Array.from([0, 1, 2, 3, 4, 5]); // 3 cols × 2 rows
    expect(sampleBilinear(g, 3, 2, 0.5, 0.5)).toBeCloseTo(2.5);
  });
  it("grid aspect follows the face and exaggeration is reported", () => {
    const raised: TerrainSource = { radiusM: 1e6, elevationAt: (_e, n) => n + 1000 };
    const t = buildTerrain(raised, frameFor(2000, 0, WEIGHTS.slim), WEIGHTS.slim, { terrainHeight: 0.5, detail: "high" }, 130);
    const { faceLengthMm, faceWidthMm } = WEIGHTS.slim;
    expect(t.rows).toBe(Math.round((130 * faceWidthMm) / faceLengthMm));
    expect(t.reliefMm).toBeCloseTo(WEIGHTS.slim.maxReliefMm * 0.5);
    expect(t.exaggeration).toBeCloseTo(t.reliefMm / ((t.rangeM * faceLengthMm) / 2000), 5);
  });
});
