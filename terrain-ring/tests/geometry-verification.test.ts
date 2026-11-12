/**
 * Verification requested by the external build review (12 Nov 2026):
 * face dimensions, inner dimensions, seam continuity and closure across every
 * style at minimum and maximum relief, with flat and sloped terrain fixtures.
 * These check the preview geometry only; see MANUFACTURING_CHECKS.md for what
 * they do not establish.
 */
import { describe, expect, it } from "vitest";
import {
  createRingMesh, meshVolume, openEdgeCount, weldedNormals, WEIGHTS,
  type BandProfile, type RingParameters, type ShoulderStyle, type Weight
} from "../src/geometry/ring-blank";
import type { TerrainSource } from "../src/geometry/heightmap";
import { buildTerrain, frameFor, MAX_EXAGGERATION } from "../src/three/terrain-surface";
import { getInnerDiameterMm } from "../src/geometry/ring-sizing";

const RES = { faceSegments: 60, backSegments: 90, widthSegments: 30 };
const FLAT: TerrainSource = { radiusM: 1e6, elevationAt: () => 250 };
/** 400 m rise west → east plus a ridge, so the face ends carry real height. */
const SLOPE: TerrainSource = {
  radiusM: 1e6,
  elevationAt: (e, n) => 500 + e * 0.1 + 150 * Math.exp(-((n / 600) ** 2))
};

const build = (weight: Weight, shoulder: ShoulderStyle, profile: BandProfile, source: TerrainSource | null, height: number) => {
  const preset = WEIGHTS[weight];
  const terrain = source
    ? buildTerrain(source, frameFor(4000, 0, preset), preset, { terrainHeight: height, detail: "high" }, 64)
    : null;
  const params: RingParameters = { innerDiameterMm: getInnerDiameterMm("N"), weight: preset, shoulder, profile, terrain, resolution: RES };
  return { mesh: createRingMesh(params), terrain };
};

describe("face footprint matches the customer-facing dimensions", () => {
  for (const weight of ["slim", "standard", "bold"] as Weight[]) {
    it(`${weight}: face is exactly ${WEIGHTS[weight].faceLengthMm} × ${WEIGHTS[weight].faceWidthMm} mm, even with terrain`, () => {
      const { mesh } = build(weight, "classic", "classic", SLOPE, 1);
      const P = mesh.positions;
      const cols = RES.widthSegments + 1;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let row = 0; row <= RES.faceSegments; row++) {
        for (let k = 0; k < cols; k++) {
          const i = (row * cols + k) * 3;
          const edge = k === 0 || k === cols - 1;
          // The rounded rim pulls the outermost columns in slightly; measure the footprint at the wall line.
          if (!edge) { minX = Math.min(minX, P[i]!); maxX = Math.max(maxX, P[i]!); }
          minZ = Math.min(minZ, P[i + 2]!); maxZ = Math.max(maxZ, P[i + 2]!);
        }
      }
      expect(maxX - minX).toBeCloseTo(WEIGHTS[weight].faceLengthMm, 1);
      expect(maxZ - minZ).toBeCloseTo(WEIGHTS[weight].faceWidthMm, 6);
    });
  }
});

describe("inner dimensions", () => {
  it.each(["flat", "classic", "d_shape"] as BandProfile[])("%s band keeps the finger size at the centre line", (profile) => {
    const { mesh } = build("standard", "classic", profile, SLOPE, 1);
    const P = mesh.positions;
    let minR = Infinity;
    for (let i = 0; i < P.length; i += 3) minR = Math.min(minR, Math.hypot(P[i]!, P[i + 1]!));
    expect(minR * 2).toBeCloseTo(getInnerDiameterMm("N"), 3);
  });
});

describe("terrain perimeter and shading", () => {
  it("terrain stays on the head: the end wall is vertical and the shoulder never overhangs it", () => {
    for (const shoulder of ["straight", "classic", "curved"] as ShoulderStyle[]) {
      const { mesh } = build("bold", shoulder, "classic", SLOPE, 1);
      const P = mesh.positions;
      const half = WEIGHTS.bold.faceLengthMm / 2;
      // Any outer point above table height must lie within the face footprint.
      const yTop = getInnerDiameterMm("N") / 2 + WEIGHTS.bold.headHeightMm;
      for (let i = 0; i < P.length; i += 3) {
        if (P[i + 1]! > yTop + 1e-6) expect(Math.abs(P[i]!)).toBeLessThanOrEqual(half + 1e-6);
      }
    }
  });

  it("smooth joins shade continuously; the terrain perimeter stays a crisp edge", () => {
    const { mesh } = build("standard", "classic", "classic", SLOPE, 1);
    const N = weldedNormals(mesh);
    const P = mesh.positions;
    const groups = new Map<string, number[]>();
    for (let i = 0; i < P.length / 3; i++) {
      const k = `${Math.round(P[i * 3]! * 1e5)},${Math.round(P[i * 3 + 1]! * 1e5)},${Math.round(P[i * 3 + 2]! * 1e5)}`;
      groups.set(k, [...(groups.get(k) ?? []), i]);
    }
    let creased = 0;
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      const dots = members.slice(1).map((j) =>
        N[members[0]! * 3]! * N[j * 3]! + N[members[0]! * 3 + 1]! * N[j * 3 + 1]! + N[members[0]! * 3 + 2]! * N[j * 3 + 2]!);
      if (dots.some((d) => d < 0.999)) creased++;
    }
    expect(creased).toBeGreaterThan(0); // the terrain perimeter keeps its edge
  });
});

describe("closure across every style at minimum and maximum relief", () => {
  const cases: [Weight, ShoulderStyle, BandProfile, string, number][] = [];
  for (const w of ["slim", "standard", "bold"] as Weight[])
    for (const s of ["straight", "classic", "curved"] as ShoulderStyle[])
      for (const p of ["flat", "classic", "d_shape"] as BandProfile[])
        for (const [label, h] of [["min", 0.05], ["max", 1]] as const) cases.push([w, s, p, label, h]);

  it.each(cases)("%s / %s / %s at %s relief: closed, outward, finite", (w, s, p, _label, h) => {
    const { mesh } = build(w, s, p, SLOPE, h);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(openEdgeCount(mesh)).toBe(0);
    expect(meshVolume(mesh)).toBeGreaterThan(0);
  });
});

describe("terrain fixtures and relief semantics", () => {
  it("flat ground produces no relief (no amplified noise)", () => {
    const { terrain, mesh } = build("standard", "classic", "classic", FLAT, 1);
    expect(terrain!.rangeM).toBe(0);
    expect(terrain!.reliefMm).toBe(0);
    expect(openEdgeCount(mesh)).toBe(0);
  });

  it("nearly flat ground is capped by the exaggeration limit", () => {
    const noisy: TerrainSource = { radiusM: 1e6, elevationAt: (e) => 100 + 2 * Math.sin(e / 50) };
    const preset = WEIGHTS.standard;
    const t = buildTerrain(noisy, frameFor(4000, 0, preset), preset, { terrainHeight: 1, detail: "high" }, 64);
    expect(t.exaggeration).toBeLessThanOrEqual(MAX_EXAGGERATION + 1e-9);
    expect(t.reliefMm).toBeLessThan(0.2); // ~4 m of wobble must not become millimetres of relief
  });

  it("mountains use the slider share of the style maximum", () => {
    const preset = WEIGHTS.standard;
    const t = buildTerrain(SLOPE, frameFor(4000, 0, preset), preset, { terrainHeight: 0.5, detail: "high" }, 64);
    expect(t.reliefMm).toBeCloseTo(preset.maxReliefMm * 0.5, 6);
  });
});
