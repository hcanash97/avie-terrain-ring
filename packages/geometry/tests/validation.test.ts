import { describe, expect, it } from "vitest";
import { SURFACE, validateMesh, type ConstraintProfile, type Mesh } from "../src/validation/common";
import { rimAngleCheck } from "../src/validation/ring";

/** Closed, outward-wound box from (0,0,0) to (sx,sy,sz), 12 triangles. */
function box(sx: number, sy: number, sz: number, offset: [number, number, number] = [0, 0, 0], base = 0) {
  const [ox, oy, oz] = offset;
  const v = [
    [0, 0, 0], [sx, 0, 0], [sx, sy, 0], [0, sy, 0],
    [0, 0, sz], [sx, 0, sz], [sx, sy, sz], [0, sy, sz]
  ].flatMap(([x, y, z]) => [x! + ox, y! + oy, z! + oz]);
  const f = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]
  ].flatMap((t) => t.map((i) => i + base));
  return { positions: v, indices: f };
}
const mesh = (b: { positions: number[]; indices: number[] }): Mesh => ({
  positions: new Float32Array(b.positions),
  indices: new Uint32Array(b.indices)
});

const profile: ConstraintProfile = { id: "test", approved: false, minWallMm: 1.0, minFeatureMm: null, maxReliefMm: 3 };
const run = (m: Mesh, p = profile) => validateMesh(m, { productType: "test", profile: p, densityGcm3: 10 });

describe("mesh validation", () => {
  it("passes a clean 10 mm cube, but only 'held for review' without an approved profile", () => {
    const r = run(mesh(box(10, 10, 10)));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.status).toBe("held_for_review");
    expect(r.checks.volumeAndMass!.measured).toEqual({ volumeCm3: 1, massG: 10 });
    expect(r.wall.minMm).toBeCloseTo(10, 3);
    expect(r.checks.minimumFeatureSize!.status).toBe("not_run");
  });

  it("returns 'pass' only with an approved profile", () => {
    expect(run(mesh(box(10, 10, 10)), { ...profile, approved: true }).status).toBe("pass");
  });

  it("detects a hole", () => {
    const b = box(10, 10, 10);
    b.indices.splice(0, 3);
    const r = run(mesh(b));
    expect(r.status).toBe("fail");
    expect(r.errors.map((e) => e.code)).toContain("NOT_WATERTIGHT");
  });

  it("detects a flipped face", () => {
    const b = box(10, 10, 10);
    [b.indices[0], b.indices[1]] = [b.indices[1]!, b.indices[0]!];
    expect(run(mesh(b)).errors.map((e) => e.code)).toContain("INCONSISTENT_ORIENTATION");
  });

  it("detects inward normals", () => {
    const b = box(10, 10, 10);
    for (let i = 0; i < b.indices.length; i += 3) [b.indices[i], b.indices[i + 1]] = [b.indices[i + 1]!, b.indices[i]!];
    expect(run(mesh(b)).errors.map((e) => e.code)).toContain("INWARD_NORMALS");
  });

  it("measures a 0.5 mm wall and fails it against a 1.0 mm minimum", () => {
    const r = run(mesh(box(10, 10, 0.5)));
    expect(r.wall.minMm).toBeCloseTo(0.5, 3);
    const e = r.errors.find((x) => x.code === "MINIMUM_WALL_THICKNESS");
    expect(e?.required).toBe(1.0);
    expect(e?.measured).toBeCloseTo(0.5, 3);
  });

  it("detects two shells that pass through each other", () => {
    const a = box(10, 10, 10), b = box(10, 10, 10, [4.3, 3.7, 5.1], 8); // crossings land inside faces, not on diagonals
    const r = run(mesh({ positions: [...a.positions, ...b.positions], indices: [...a.indices, ...b.indices] }));
    const codes = r.errors.map((e) => e.code);
    expect(codes).toContain("SELF_INTERSECTIONS");
    expect(codes).toContain("MULTIPLE_SHELLS");
  });

  it("fails relief over the product maximum", () => {
    const r = validateMesh(mesh(box(10, 10, 10)), { productType: "test", profile, densityGcm3: 10, reliefMm: 3.5 });
    expect(r.errors.map((e) => e.code)).toContain("MAXIMUM_RELIEF");
  });
});

/**
 * Box triangles in order: 0–1 z=0, 2–3 z=sz, 4–5 y=0, 6–7 x=sx, 8–9 y=sy, 10–11 x=0.
 * Label the y=0 face as the inner (finger) surface and every other face as terrain.
 */
const fingerBelow = () => Uint8Array.from({ length: 12 }, (_, t) => (t === 4 || t === 5 ? SURFACE.inner : SURFACE.terrain));
const labelled = (m: Mesh, p: ConstraintProfile) =>
  validateMesh(m, { productType: "test", profile: p, densityGcm3: 10, surfaceLabels: fingerBelow() });

describe("thickness split by surface", () => {
  it("a narrow fin on solid metal fails feature size, not structural wall", () => {
    // 0.25 mm wide, 3 mm tall: plenty of metal above the finger, but a knife-thin feature.
    const r = labelled(mesh(box(0.25, 3, 6)), { ...profile, minWallMm: 1.0, minFeatureMm: 0.5 });
    expect(r.wall.p1Mm).toBeCloseTo(3, 3);
    expect(r.feature!.p1Mm).toBeLessThan(0.26);
    const codes = r.errors.map((e) => e.code);
    expect(codes).toContain("MINIMUM_FEATURE_SIZE");
    expect(codes).not.toContain("MINIMUM_WALL_THICKNESS");
  });

  it("a thin slab over the finger fails structural wall", () => {
    const r = labelled(mesh(box(10, 0.3, 10)), { ...profile, minWallMm: 1.0 });
    expect(r.wall.p1Mm).toBeCloseTo(0.3, 3);
    expect(r.errors.map((e) => e.code)).toContain("MINIMUM_WALL_THICKNESS");
  });

  it("broad terrain reads as wide features", () => {
    const r = labelled(mesh(box(6, 3, 6)), { ...profile, minFeatureMm: 0.5 });
    expect(r.feature!.minMm).toBeGreaterThan(0.5);
    expect(r.errors).toEqual([]);
  });

  it("reports feature size and rim without judging them when no minimum is set", () => {
    const r = labelled(mesh(box(0.25, 3, 6)), { ...profile, minWallMm: null });
    expect(r.checks.minimumFeatureSize!.status).toBe("not_run");
    expect(r.checks.minimumFeatureSize!.measured).toBeDefined();
    expect(r.checks.minimumWallThickness!.status).toBe("not_run");
    expect(r.errors).toEqual([]);
  });

  it("rejects labels that do not match the triangles", () => {
    expect(() => validateMesh(mesh(box(1, 1, 1)), { productType: "test", profile, densityGcm3: 10, surfaceLabels: new Uint8Array(3) })).toThrow();
  });
});

describe("rim angle", () => {
  const face = { faceLengthMm: 10, faceWidthMm: 8, cornerRadiusMm: 1, reliefMm: 1 };
  const cols = 101, rows = 81, dz = 8 / (rows - 1);
  const field = (f: (x: number, zFromEdge: number) => number) => {
    const data = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) data[j * cols + i] = f(-5 + i * 0.1, j * dz);
    return { ...face, data, cols, rows };
  };

  it("is 90° for flat terrain and is reported, not judged, without a minimum", () => {
    const r = rimAngleCheck(field(() => 0.5), null);
    expect(r.check.status).toBe("not_run");
    expect((r.check.measured as Record<string, number>).minDeg).toBeCloseTo(90, 6);
    expect(r.error).toBeUndefined();
  });

  it("measures a cliff rising into the rim and fails it against a minimum", () => {
    // Rises 1 mm over the last 0.3 mm before the −Z edge.
    const r = rimAngleCheck(field((_x, d) => Math.max(0, 1 - d / 0.3)), 45);
    const measured = (r.check.measured as Record<string, number>).minDeg;
    expect(measured).toBeCloseTo(90 - (Math.atan2(0.5, 0.15) * 180) / Math.PI, 0);
    expect(r.check.status).toBe("fail");
    expect(r.error?.code).toBe("MINIMUM_RIM_ANGLE");
  });

  it("ignores the plan corners, where the height map edge lies outside the head", () => {
    const r = rimAngleCheck(field((x, d) => (Math.abs(x) > 4.05 ? Math.max(0, 1 - d / 0.3) : 0)), 45);
    expect(r.check.status).toBe("pass");
  });
});
