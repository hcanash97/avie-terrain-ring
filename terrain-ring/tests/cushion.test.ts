/** Cushion head: same guarantees as the bar head. */
import { describe, expect, it } from "vitest";
import {
  createRingMesh, facePreset, meshVolume, openEdgeCount,
  type BandProfile, type ShoulderStyle, type Weight
} from "../src/geometry/ring-blank";
import type { TerrainSource } from "../src/geometry/heightmap";
import { buildTerrain, frameFor } from "../src/three/terrain-surface";

const RES = { faceSegments: 60, backSegments: 90, widthSegments: 30 };
const SLOPE: TerrainSource = { radiusM: 1e6, elevationAt: (e, n) => 500 + e * 0.1 + 150 * Math.exp(-((n / 600) ** 2)) };

const build = (weight: Weight, shoulder: ShoulderStyle, profile: BandProfile, d: number, height: number | null) => {
  const preset = facePreset(weight, "cushion");
  const terrain = height === null ? null
    : buildTerrain(SLOPE, frameFor(4000, 0, preset), preset, { terrainHeight: height, detail: "high" }, 64);
  return createRingMesh({ innerDiameterMm: d, weight: preset, shoulder, profile, terrain, resolution: RES });
};

describe("cushion head", () => {
  const cases: [Weight, ShoulderStyle, BandProfile, number][] = [];
  for (const w of ["slim", "standard", "bold"] as Weight[])
    for (const s of ["straight", "classic", "curved"] as ShoulderStyle[])
      for (const p of ["flat", "classic", "d_shape"] as BandProfile[])
        for (const h of [0.05, 1]) cases.push([w, s, p, h]);

  it.each(cases)("%s / %s / %s at %s relief: closed and outward", (w, s, p, h) => {
    const m = build(w, s, p, 17.2, h);
    expect(m.positions.every(Number.isFinite)).toBe(true);
    expect(openEdgeCount(m)).toBe(0);
    expect(meshVolume(m)).toBeGreaterThan(0);
  });

  for (const w of ["slim", "standard", "bold"] as Weight[]) {
    for (const d of [15, 17.2, 21.5]) {
      it(`${w} at ${d} mm: footprint matches the label and the opening is exact`, () => {
        const preset = facePreset(w, "cushion");
        const m = build(w, "classic", "classic", d, null);
        const P = m.positions;
        const yTop = d / 2 + preset.headHeightMm;
        let minR = Infinity, faceX = 0, faceZ = 0;
        for (let i = 0; i < P.length; i += 3) {
          minR = Math.min(minR, Math.hypot(P[i]!, P[i + 1]!));
          // Length at table height (the face carries a 0.12 mm base); width at the wall line within the face.
          if (P[i + 1]! >= yTop + 0.06) faceX = Math.max(faceX, Math.abs(P[i]!));
          if (P[i + 1]! >= yTop - 0.2 && Math.abs(P[i]!) <= preset.faceLengthMm / 2 + 1e-4) faceZ = Math.max(faceZ, Math.abs(P[i + 2]!));
        }
        expect(minR * 2).toBeCloseTo(d, 3);
        expect(faceX * 2).toBeCloseTo(preset.faceLengthMm, 2);
        expect(faceZ * 2).toBeCloseTo(preset.faceWidthMm, 2);
      });
    }
  }
});
