import { describe, expect, it } from "vitest";
import { frameFor, type TerrainRelief } from "@avie/terrain";
import { createRoundPendant, pendantDimensions, type RoundPendantParameters } from "../src/products/terrain-pendant";
import { validateMesh } from "../src/validation/common";

const D = 18, BASE = 1, EDGE = 0.3, FADE = 1, RELIEF = 1.5;
/** Synthetic terrain: f(u, v) with u west→east, v north→south. */
function field(f: (u: number, v: number) => number, n = 121): TerrainRelief {
  const data = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = f(i / (n - 1), j / (n - 1));
  return { data, cols: n, rows: n, reliefMm: RELIEF };
}
const hills = field((u, v) => 0.5 + 0.5 * Math.sin(u * 9) * Math.cos(v * 7));
const params = (over: Partial<RoundPendantParameters> = {}): RoundPendantParameters => ({
  diameterMm: D, baseThicknessMm: BASE, edgeRoundMm: EDGE, terrainFadeMm: FADE, terrain: hills,
  bail: { openingHeightMm: 3, openingDepthMm: 2, wallMm: 1, embedMm: 0.6 },
  resolution: { radial: 48, angular: 180, round: 6, bail: 36 },
  ...over,
});
const profile = { id: "test", approved: false, minWallMm: null, minFeatureMm: null, maxReliefMm: null };
const P = (m: { positions: Float32Array }) => Array.from({ length: m.positions.length / 3 }, (_, i) => [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!] as const);

describe("round pendant body", () => {
  const pd = createRoundPendant(params());

  it("has the specified body diameter, a flat back at y = 0 and no non-finite coordinates", () => {
    const d = pendantDimensions(pd);
    expect(d.body.diameterMm).toBeCloseTo(D, 6);
    const pts = P(pd.body);
    expect(pts.every((p) => p.every(Number.isFinite))).toBe(true);
    expect(Math.min(...pts.map((p) => p[1]))).toBe(0);
    expect(d.body.depthMm).toBeLessThanOrEqual(BASE + RELIEF + 1e-6);
  });

  it("keeps terrain inside its window: plain face from the fade band outward", () => {
    for (const [x, y, z] of P(pd.body)) if (Math.hypot(x, z) >= D / 2 - EDGE - 1e-6) expect(y).toBeLessThanOrEqual(BASE + 1e-6);
  });

  it("is a closed, manifold, single shell without self-intersections, labelled for validation", () => {
    const r = validateMesh(pd.body, { productType: "terrain_pendant", profile, densityGcm3: 10, surfaceLabels: pd.body.surfaceLabels });
    expect(r.errors).toEqual([]);
    expect(r.checks.selfIntersections!.status).toBe("pass");
    expect(r.wall.minMm).toBeGreaterThanOrEqual(BASE - 1e-3); // structural: back to front is at least the base
    expect(new Set(pd.body.surfaceLabels)).toEqual(new Set([0, 1, 2]));
  });

  it("puts north towards the bail (−Z) and east at +X; nothing is mirrored", () => {
    const at = (t: TerrainRelief, x: number, z: number) => {
      const b = createRoundPendant(params({ terrain: t, bail: null }));
      let best = Infinity, y = 0;
      for (const [px, py, pz] of P(b.body)) { const dd = Math.hypot(px - x, pz - z); if (py > 0.01 && dd < best) { best = dd; y = py; } }
      return y;
    };
    const north = field((_u, v) => (v < 0.3 ? 1 : 0));
    expect(at(north, 0, -5)).toBeGreaterThan(at(north, 0, 5) + 1);
    const east = field((u) => (u > 0.7 ? 1 : 0));
    expect(at(east, 5, 0)).toBeGreaterThan(at(east, -5, 0) + 1);
  });

  it("crops a square frame to the circle rather than stretching it", () => {
    const area = frameFor(6000, 0, { faceLengthMm: D, faceWidthMm: D, maxReliefMm: RELIEF });
    expect(area.widthM).toBe(area.lengthM);
  });

  it("keeps a plain face with no terrain when none is given", () => {
    const plain = createRoundPendant(params({ terrain: null, bail: null }));
    expect(plain.body.faceTriangleCount).toBe(0);
    expect(pendantDimensions(plain).body.depthMm).toBeCloseTo(BASE, 6);
  });
});

describe("bail component", () => {
  const pd = createRoundPendant(params());

  it("is a separate closed solid recorded as an unjoined visual placeholder", () => {
    expect(pd.assembly?.joined).toBe(false);
    expect(pd.assembly?.relationship).toMatch(/Visual placeholder: not a joined solid/);
    const r = validateMesh(pd.bail!, { productType: "terrain_pendant", profile, densityGcm3: 10 });
    expect(r.errors).toEqual([]);
  });

  it("has the specified opening and wall, above the body at −Z", () => {
    const pts = P(pd.bail!);
    const ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]), xs = pts.map((p) => p[0]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(3 + 2 * 1, 3);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(2 + 2 * 1, 3);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1, 3);
    expect(Math.max(...zs)).toBeCloseTo(-(D / 2 - 0.6), 3);
  });

  it("reports body and overall dimensions separately", () => {
    const d = pendantDimensions(pd);
    expect(d.overall.heightMm).toBeCloseTo(D + 5 - 0.6, 3);
    expect(d.overall.widthMm).toBeCloseTo(D, 6);
    expect(d.bail?.note).toMatch(/overlap with the body not subtracted/);
  });
});

describe("preview and export agree", () => {
  it("gives the same dimensions at preview and production resolution", () => {
    const lo = pendantDimensions(createRoundPendant(params({ resolution: { radial: 96, angular: 360, round: 6, bail: 48 } })));
    const hi = pendantDimensions(createRoundPendant(params({ resolution: { radial: 240, angular: 720, round: 8, bail: 96 } })));
    expect(lo.body.diameterMm).toBe(hi.body.diameterMm);
    expect(Math.abs(lo.body.depthMm - hi.body.depthMm)).toBeLessThan(0.02);
    expect(Math.abs(lo.body.volumeMm3 - hi.body.volumeMm3) / hi.body.volumeMm3).toBeLessThan(0.01);
    expect(lo.overall).toEqual(hi.overall);
  });
});

describe("guards", () => {
  it("rejects a base too thin for its edge rounds and a fade that does not fit", () => {
    expect(() => createRoundPendant(params({ baseThicknessMm: 0.5 }))).toThrow();
    expect(() => createRoundPendant(params({ terrainFadeMm: 9 }))).toThrow();
  });
});
