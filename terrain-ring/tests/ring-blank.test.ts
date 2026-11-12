import { describe, expect, it } from "vitest";
import {
  createRingMesh, meshVolume, openEdgeCount, WEIGHTS,
  type BandProfile, type RingParameters, type ShoulderStyle, type Weight
} from "../src/geometry/ring-blank";
import { createDemoSource } from "../src/geometry/heightmap";
import { buildTerrain, frameFor } from "../src/three/terrain-surface";
import { getInnerDiameterMm, UK_RING_SIZES } from "../src/geometry/ring-sizing";

const res = { faceSegments: 48, backSegments: 40, widthSegments: 24 };
const terrainFor = (weight: Weight) =>
  buildTerrain(createDemoSource(), frameFor(6000, 0, WEIGHTS[weight]), WEIGHTS[weight], { terrainHeight: 0.8, detail: "high" }, 64);

const params = (patch: Partial<RingParameters> = {}): RingParameters => ({
  innerDiameterMm: getInnerDiameterMm("N"),
  weight: WEIGHTS.standard,
  shoulder: "classic",
  profile: "classic",
  terrain: null,
  resolution: res,
  ...patch
});

const bounds = (P: Float32Array) => {
  let minR = Infinity, maxY = -Infinity, minY = Infinity, zTop = 0, zBottom = 0, xTop = 0;
  for (let i = 0; i < P.length; i += 3) {
    const [x, y, z] = [P[i]!, P[i + 1]!, P[i + 2]!];
    minR = Math.min(minR, Math.hypot(x, y));
    maxY = Math.max(maxY, y);
    minY = Math.min(minY, y);
    if (y > 0) { zTop = Math.max(zTop, Math.abs(z)); xTop = Math.max(xTop, Math.abs(x)); }
    if (y < 0 && Math.abs(x) < 0.5) zBottom = Math.max(zBottom, Math.abs(z));
  }
  return { minR, maxY, minY, faceWidth: zTop * 2, bandWidth: zBottom * 2, xTop };
};

describe("ring sizing", () => {
  it("UK N is about 17.2 mm", () => expect(getInnerDiameterMm("N")).toBeCloseTo(17.2, 1));
  it("sizes increase monotonically", () => {
    const d = UK_RING_SIZES.map(getInnerDiameterMm);
    for (let i = 1; i < d.length; i++) expect(d[i]!).toBeGreaterThan(d[i - 1]!);
  });
  it("rejects unknown sizes", () => expect(() => getInnerDiameterMm("Q7")).toThrow());
});

describe("signet geometry", () => {
  it("has the right inner diameter, face width and band width", () => {
    const b = bounds(createRingMesh(params()).positions);
    expect(b.minR * 2).toBeCloseTo(getInnerDiameterMm("N"), 3);
    expect(b.faceWidth).toBeCloseTo(WEIGHTS.standard.faceWidthMm, 3);
    expect(b.bandWidth).toBeCloseTo(WEIGHTS.standard.bandWidthMm, 1);
  });

  it("has a flat table at the head height spanning the face length", () => {
    const b = bounds(createRingMesh(params()).positions);
    const top = getInnerDiameterMm("N") / 2 + WEIGHTS.standard.headHeightMm;
    expect(b.maxY).toBeCloseTo(top + 0.12, 2); // + block base lift
    expect(b.xTop).toBeGreaterThanOrEqual(WEIGHTS.standard.faceLengthMm / 2 - 1e-6);
  });

  it("terrain rises above the table but within the relief limit", () => {
    const terrain = terrainFor("standard");
    const b = bounds(createRingMesh(params({ terrain })).positions);
    const top = getInnerDiameterMm("N") / 2 + WEIGHTS.standard.headHeightMm;
    expect(b.maxY).toBeGreaterThan(top + terrain.reliefMm * 0.8);
    expect(b.maxY).toBeLessThanOrEqual(top + 0.12 + terrain.reliefMm + 1e-6);
  });

  const variants: [Weight, ShoulderStyle, BandProfile][] = [];
  for (const w of ["slim", "standard", "bold"] as Weight[])
    for (const s of ["straight", "classic", "curved"] as ShoulderStyle[])
      for (const p of ["flat", "classic", "d_shape"] as BandProfile[]) variants.push([w, s, p]);

  it.each(variants)("%s / %s shoulders / %s band is watertight with outward normals", (weight, shoulder, profile) => {
    const mesh = createRingMesh(params({ weight: WEIGHTS[weight], shoulder, profile, terrain: terrainFor(weight) }));
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(openEdgeCount(mesh)).toBe(0);
    expect(meshVolume(mesh)).toBeGreaterThan(0);
  });

  it("weights produce increasing metal volume", () => {
    const v = (w: Weight) => meshVolume(createRingMesh(params({ weight: WEIGHTS[w] })));
    expect(v("slim")).toBeLessThan(v("standard"));
    expect(v("standard")).toBeLessThan(v("bold"));
  });

  it("a plausible silver weight for a standard ring (5–15 g)", () => {
    const grams = (meshVolume(createRingMesh(params({ terrain: terrainFor("standard") }))) / 1000) * 10.36;
    expect(grams).toBeGreaterThan(5);
    expect(grams).toBeLessThan(15);
  });
});
