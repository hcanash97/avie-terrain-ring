import { describe, expect, it } from "vitest";
import { validateMesh, type ConstraintProfile, type Mesh } from "../src/validation/common";

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
