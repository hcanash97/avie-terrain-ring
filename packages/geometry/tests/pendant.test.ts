import { describe, expect, it } from "vitest";
import { frameFor, type TerrainRelief } from "@avie/terrain";
import {
  circleOutline,
  createPendant,
  createPendantBody,
  outlineDistance,
  SURFACE_LABEL,
  type PendantAttachment,
  type PendantBodyParameters,
} from "../src/products/terrain-pendant";
import { validateMesh } from "../src/validation/common";

/** Synthetic terrain: f(u, v) with u west→east, v north→south. */
function field(f: (u: number, v: number) => number, n = 121, reliefMm = 1.4): TerrainRelief {
  const data = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = f(i / (n - 1), j / (n - 1));
  return { data, cols: n, rows: n, reliefMm };
}
const hills = field((u, v) => 0.5 + 0.5 * Math.sin(u * 9) * Math.cos(v * 7));
const RES = { rings: 48, angular: 200, round: 5 };
const body = (over: Partial<PendantBodyParameters> = {}): PendantBodyParameters => ({
  outline: circleOutline(18), baseThicknessMm: 2.6, edgeRoundMm: 0.4, fadeMm: 0, coverage: { mode: "full" }, terrain: hills, resolution: RES, ...over,
});
const profile = { id: "test", approved: false, minWallMm: null, minFeatureMm: null, maxReliefMm: null };
const pts = (m: { positions: Float32Array }) => Array.from({ length: m.positions.length / 3 }, (_, i) => [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!] as const);
const extent = (m: { positions: Float32Array }, k: 0 | 1 | 2) => { const v = pts(m).map((p) => p[k]); return Math.max(...v) - Math.min(...v); };
const OUTLINES = { circle: circleOutline(18), block: { widthMm: 12, heightMm: 20, cornerRadiusMm: 0.6 }, cushion: { widthMm: 16, heightMm: 16, cornerRadiusMm: 3.5 } };

describe("pendant body", () => {
  it.each(Object.entries(OUTLINES))("%s: exact outline, flat back at y = 0, closed and labelled", (_name, outline) => {
    const m = createPendantBody(body({ outline }));
    expect(extent(m, 0)).toBeCloseTo(outline.widthMm, 6);
    expect(extent(m, 2)).toBeCloseTo(outline.heightMm, 6);
    expect(Math.min(...pts(m).map((p) => p[1]))).toBe(0);
    for (const [x, , z] of pts(m)) expect(outlineDistance(outline, x, z)).toBeLessThan(1e-6); // nothing outside the outline
    const r = validateMesh(m, { productType: "terrain_pendant", profile, densityGcm3: 10, surfaceLabels: m.surfaceLabels });
    expect(r.errors).toEqual([]);
    expect(new Set(m.surfaceLabels)).toEqual(new Set([SURFACE_LABEL.body, SURFACE_LABEL.terrain, SURFACE_LABEL.back, SURFACE_LABEL.rim]));
  });

  it("keeps terrain inside the face when it fades, and lets the wall rise to it when it does not", () => {
    const faded = createPendantBody(body({ fadeMm: 1, edgeRoundMm: 0.3, baseThicknessMm: 1 }));
    for (const [x, y, z] of pts(faded)) if (outlineDistance(circleOutline(18), x, z, 0.3) > -1e-6) expect(y).toBeLessThanOrEqual(1 + 1e-6);
    const crisp = createPendantBody(body());
    const rimTop = Math.max(...pts(crisp).filter(([x, , z]) => outlineDistance(circleOutline(18), x, z) > -1e-6).map((p) => p[1]));
    expect(rimTop).toBeGreaterThan(2.6 - 0.4 + 0.1); // the side wall carries the terrain at the edge
  });

  it("puts north at the top (−Z) and east at +X; nothing is mirrored", () => {
    const heightNear = (t: TerrainRelief, x: number, z: number) => {
      const m = createPendantBody(body({ terrain: t }));
      let best = Infinity, y = 0;
      for (const [px, py, pz] of pts(m)) { const d = Math.hypot(px - x, pz - z); if (py > 0.01 && d < best) { best = d; y = py; } }
      return y;
    };
    const north = field((_u, v) => (v < 0.3 ? 1 : 0));
    expect(heightNear(north, 0, -5)).toBeGreaterThan(heightNear(north, 0, 5) + 1);
    const east = field((u) => (u > 0.7 ? 1 : 0));
    expect(heightNear(east, 5, 0)).toBeGreaterThan(heightNear(east, -5, 0) + 1);
  });

  it("raises only ground above the level, leaving a flat field below", () => {
    const ramp = field((u) => u); // rises west to east
    const m = createPendantBody(body({ terrain: ramp, coverage: { mode: "above_level", level: 0.5 } }));
    // Top-surface points (not the back) in the low western half sit exactly on the flat field.
    for (const [x, y, z] of pts(m)) if (y > 1 && x < -1 && outlineDistance(circleOutline(18), x, z, 0.4) < -0.01) expect(y).toBeCloseTo(2.6, 6);
    expect(Math.max(...pts(m).filter(([x]) => x > 6).map((p) => p[1]))).toBeGreaterThan(3);
  });

  it("crops a frame of the body's own aspect rather than stretching it", () => {
    const area = frameFor(6000, 0, { faceLengthMm: 12, faceWidthMm: 20, maxReliefMm: 1.4 });
    expect(area.widthM / area.lengthM).toBeCloseTo(20 / 12, 9);
  });

  it("rejects impossible proportions", () => {
    expect(() => createPendantBody(body({ baseThicknessMm: 0.5 }))).toThrow();
    expect(() => createPendantBody(body({ outline: { widthMm: 10, heightMm: 10, cornerRadiusMm: 6 } }))).toThrow();
    expect(() => createPendantBody(body({ fadeMm: 9 }))).toThrow();
  });
});

describe("attachments are part of one solid", () => {
  const cases: [string, keyof typeof OUTLINES, number, PendantAttachment][] = [
    ["channel through a circle", "circle", 2.6, { kind: "through_hole", diameterMm: 1.6, centreFromTopMm: 2.2, centreHeightMm: 1.3 }],
    ["channel through a block", "block", 3.6, { kind: "through_hole", diameterMm: 1.8, centreFromTopMm: 2.2, centreHeightMm: 1.8 }],
    ["tab on a cushion", "cushion", 1.6, { kind: "tab", widthMm: 4, thicknessMm: 0.9, openingHeightMm: 3, openingDepthMm: 2.4, embedMm: 1 }],
    ["loop on a circle", "circle", 1.0, { kind: "loop", openingHeightMm: 3, openingDepthMm: 2, wallMm: 1, embedMm: 0.6 }],
  ];
  it.each(cases)("%s: a single shell with one hole through it", async (_name, outline, base, attachment) => {
    const p = await createPendant({ ...body({ outline: OUTLINES[outline], baseThicknessMm: base, edgeRoundMm: 0.3 }), attachment });
    expect(p.genus).toBe(1);
    expect(p.checks.every((c) => c.ok)).toBe(true);
    const r = validateMesh(p.mesh, { productType: "terrain_pendant", profile, densityGcm3: 10, surfaceLabels: p.mesh.surfaceLabels });
    expect(r.errors).toEqual([]);
    expect(p.mesh.surfaceLabels?.length).toBe(p.mesh.indices.length / 3);
    expect(new Set(p.mesh.surfaceLabels).has(SURFACE_LABEL.terrain)).toBe(true);
  }, 60000);

  it("removes the channel's volume and nothing else", async () => {
    const solid = await createPendant({ ...body({ outline: OUTLINES.block, baseThicknessMm: 3.6, terrain: null }), attachment: { kind: "none" } });
    const hole = await createPendant({ ...body({ outline: OUTLINES.block, baseThicknessMm: 3.6, terrain: null }), attachment: { kind: "through_hole", diameterMm: 1.8, centreFromTopMm: 2.2, centreHeightMm: 1.8 } });
    const expected = Math.PI * 0.9 * 0.9 * 12; // channel runs the full width
    expect(solid.dimensions.volumeMm3 - hole.dimensions.volumeMm3).toBeGreaterThan(expected * 0.95);
    expect(solid.dimensions.volumeMm3 - hole.dimensions.volumeMm3).toBeLessThan(expected * 1.01);
    expect(hole.dimensions.overall).toEqual(solid.dimensions.overall);
  }, 60000);

  it("flags a channel that would break through the base", async () => {
    const p = await createPendant({ ...body({ baseThicknessMm: 1.0, edgeRoundMm: 0.3 }), attachment: { kind: "through_hole", diameterMm: 1.6, centreFromTopMm: 2.2, centreHeightMm: 0.5 } });
    expect(p.checks.find((c) => c.name === "holeInsideBase")?.ok).toBe(false);
  }, 60000);

  it("reports body dimensions from the outline and overall dimensions with the attachment", async () => {
    const p = await createPendant({ ...body({ baseThicknessMm: 1.0, edgeRoundMm: 0.3, fadeMm: 1 }), attachment: { kind: "loop", openingHeightMm: 3, openingDepthMm: 2, wallMm: 1, embedMm: 0.6 } });
    expect(p.dimensions.body).toMatchObject({ widthMm: 18, heightMm: 18 });
    expect(p.dimensions.overall.heightMm).toBeCloseTo(18 + 5 - 0.6, 2);
  }, 60000);

  it("agrees between preview and production resolution", async () => {
    const a: PendantAttachment = { kind: "through_hole", diameterMm: 1.6, centreFromTopMm: 2.2, centreHeightMm: 1.3 };
    const lo = await createPendant({ ...body({ resolution: { rings: 80, angular: 280, round: 5 } }), attachment: a });
    const hi = await createPendant({ ...body({ resolution: { rings: 150, angular: 480, round: 8 } }), attachment: a });
    expect(lo.dimensions.body).toEqual({ ...hi.dimensions.body, depthMm: lo.dimensions.body.depthMm });
    expect(Math.abs(lo.dimensions.body.depthMm - hi.dimensions.body.depthMm)).toBeLessThan(0.03);
    expect(Math.abs(lo.dimensions.volumeMm3 - hi.dimensions.volumeMm3) / hi.dimensions.volumeMm3).toBeLessThan(0.01);
  }, 120000);
});
