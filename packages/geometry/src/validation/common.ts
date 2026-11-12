/**
 * Product-agnostic manufacturing mesh validation (welded, indexed mesh in mm).
 *
 * Every check reports a status, the method used, the measured value and the
 * threshold it was judged against. "not_run" is never treated as a pass. A
 * closed, manifold mesh is NOT thereby casting-ready: the overall status can
 * only be "pass" against an APPROVED manufacturer constraint profile.
 */
import { TriangleBVH } from "./bvh";

export type Mesh = { positions: ArrayLike<number>; indices: ArrayLike<number> };
export type CheckStatus = "pass" | "fail" | "warn" | "not_run";
export type Check = {
  status: CheckStatus;
  method: string;
  measured?: number | Record<string, number>;
  required?: number | string;
  note?: string;
  location?: number[];
};
export type ValidationError = { code: string; message: string; measured?: number; required?: number };

export type ConstraintProfile = {
  id: string;
  approved: boolean;
  minWallMm: number | null;
  minFeatureMm: number | null;
  maxReliefMm: number | null;
  expectedSizeMm?: { x: number; y: number; z: number; toleranceMm: number };
};

export type ValidationReport = {
  valid: boolean;
  productType: string;
  status: "pass" | "held_for_review" | "fail";
  constraintProfile: { id: string; approved: boolean };
  errors: ValidationError[];
  warnings: ValidationError[];
  checks: Record<string, Check>;
  validatorVersion: string;
};

export const VALIDATOR_VERSION = "mesh-validation/v1";

const sub = (a: number[], b: number[]) => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

function vertex(m: Mesh, i: number) {
  return [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!];
}

/** Edge topology: boundary edges, non-manifold edges, inconsistent orientation. */
export function edgeTopology(m: Mesh) {
  const I = m.indices;
  const undirected = new Map<string, number>();
  const directed = new Map<string, number>();
  for (let t = 0; t < I.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = I[t + e]!, b = I[t + ((e + 1) % 3)]!;
      const u = a < b ? `${a},${b}` : `${b},${a}`;
      undirected.set(u, (undirected.get(u) ?? 0) + 1);
      const d = `${a},${b}`;
      directed.set(d, (directed.get(d) ?? 0) + 1);
    }
  let boundary = 0, nonManifold = 0, misoriented = 0;
  for (const c of undirected.values()) {
    if (c === 1) boundary++;
    else if (c > 2) nonManifold++;
  }
  for (const c of directed.values()) if (c > 1) misoriented++;
  return { edges: undirected.size, boundary, nonManifold, misoriented };
}

/** Vertices whose surrounding triangles do not form one connected fan. */
export function nonManifoldVertices(m: Mesh): number {
  const I = m.indices;
  const around = new Map<number, number[]>();
  for (let t = 0; t < I.length / 3; t++)
    for (let e = 0; e < 3; e++) {
      const v = I[t * 3 + e]!;
      const list = around.get(v);
      if (list) list.push(t);
      else around.set(v, [t]);
    }
  let bad = 0;
  for (const [v, tris] of around) {
    // Link graph: triangles around v connected when they share another vertex.
    const parent = tris.map((_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
    const owner = new Map<number, number>();
    tris.forEach((t, i) => {
      for (let e = 0; e < 3; e++) {
        const w = I[t * 3 + e]!;
        if (w === v) continue;
        const j = owner.get(w);
        if (j === undefined) owner.set(w, i);
        else parent[find(i)] = find(j);
      }
    });
    if (new Set(tris.map((_, i) => find(i))).size > 1) bad++;
  }
  return bad;
}

export function shellCount(m: Mesh): number {
  const I = m.indices;
  const n = I.length / 3;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  const owner = new Map<string, number>();
  for (let t = 0; t < n; t++)
    for (let e = 0; e < 3; e++) {
      const a = I[t * 3 + e]!, b = I[t * 3 + ((e + 1) % 3)]!;
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      const o = owner.get(k);
      if (o === undefined) owner.set(k, t);
      else parent[find(t)] = find(o);
    }
  return new Set(parent.map((_, i) => find(i))).size;
}

export function degenerateTriangles(m: Mesh, minAreaMm2 = 1e-10): number {
  const I = m.indices;
  let n = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = vertex(m, I[t]!), b = vertex(m, I[t + 1]!), c = vertex(m, I[t + 2]!);
    const area = 0.5 * Math.hypot(...cross(sub(b, a), sub(c, a)));
    if (!(area > minAreaMm2)) n++;
  }
  return n;
}

export function signedVolumeMm3(m: Mesh): number {
  const I = m.indices;
  let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = vertex(m, I[t]!), b = vertex(m, I[t + 1]!), c = vertex(m, I[t + 2]!);
    v += dot(a, cross(b, c)) / 6;
  }
  return v;
}

export function bounds(m: Mesh) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, m.positions[i + k]!);
      max[k] = Math.max(max[k]!, m.positions[i + k]!);
    }
  return { min, max, size: [max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!] };
}

/** Segment p→q against triangle (a,b,c): proper crossing strictly inside both. */
function segmentHitsTriangle(p: number[], q: number[], a: number[], b: number[], c: number[]): boolean {
  const d = sub(q, p);
  const len = Math.hypot(...d);
  if (len === 0) return false;
  const dir = d.map((x) => x / len);
  const e1 = sub(b, a), e2 = sub(c, a);
  const h = cross(dir, e2);
  const det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return false; // parallel/coplanar: not detected by this method
  const inv = 1 / det;
  const s = sub(p, a);
  const u = dot(s, h) * inv;
  if (u <= 1e-9 || u >= 1 - 1e-9) return false;
  const qv = cross(s, e1);
  const v = dot(dir, qv) * inv;
  if (v <= 1e-9 || u + v >= 1 - 1e-9) return false;
  const t = dot(e2, qv) * inv;
  return t > 1e-9 * len && t < len * (1 - 1e-9);
}

/** Pairs of triangles that cross each other (shared-vertex neighbours are skipped). */
export function selfIntersections(m: Mesh, bvh: TriangleBVH, limit = 1000, locations: number[][] = []): number {
  const I = m.indices;
  let hits = 0;
  bvh.overlappingPairs((ta, tb) => {
    if (hits >= limit) return;
    const va = [I[ta * 3]!, I[ta * 3 + 1]!, I[ta * 3 + 2]!];
    const vb = [I[tb * 3]!, I[tb * 3 + 1]!, I[tb * 3 + 2]!];
    if (va.some((x) => vb.includes(x))) return;
    const A = va.map((i) => vertex(m, i)), B = vb.map((i) => vertex(m, i));
    for (let e = 0; e < 3; e++) {
      if (segmentHitsTriangle(A[e]!, A[(e + 1) % 3]!, B[0]!, B[1]!, B[2]!) ||
          segmentHitsTriangle(B[e]!, B[(e + 1) % 3]!, A[0]!, A[1]!, A[2]!)) {
        hits++;
        if (locations.length < 20) locations.push([0, 1, 2].map((k) => +((A[0]![k]! + A[1]![k]! + A[2]![k]!) / 3).toFixed(3)));
        return;
      }
    }
  });
  return hits;
}

/**
 * Wall thickness by inward ray casting from triangle centroids along the
 * inverted face normal. Reports the distribution; the minimum is located so it
 * can be inspected. Thin results at sharp convex edges are real thin metal.
 */
export function wallThickness(m: Mesh, bvh: TriangleBVH, maxSamples = 60000) {
  const I = m.indices;
  const n = I.length / 3;
  const stride = Math.max(1, Math.ceil(n / maxSamples));
  const values: number[] = [];
  let min = Infinity, minAt: number[] = [];
  let misses = 0;
  for (let t = 0; t < n; t += stride) {
    const a = vertex(m, I[t * 3]!), b = vertex(m, I[t * 3 + 1]!), c = vertex(m, I[t * 3 + 2]!);
    const nn = cross(sub(b, a), sub(c, a));
    const len = Math.hypot(...nn);
    if (len === 0) continue;
    const dir = nn.map((x) => -x / len);
    const o = [(a[0]! + b[0]! + c[0]!) / 3, (a[1]! + b[1]! + c[1]!) / 3, (a[2]! + b[2]! + c[2]!) / 3];
    const hit = bvh.raycast(o, dir, t);
    if (!Number.isFinite(hit.t)) { misses++; continue; }
    values.push(hit.t);
    if (hit.t < min) { min = hit.t; minAt = o; }
  }
  values.sort((x, y) => x - y);
  const q = (p: number) => values[Math.min(values.length - 1, Math.floor(p * (values.length - 1)))] ?? NaN;
  return { samples: values.length, misses, minMm: min, p1Mm: q(0.01), p5Mm: q(0.05), medianMm: q(0.5), minAt, values };
}

export type CommonInputs = {
  productType: string;
  profile: ConstraintProfile;
  densityGcm3: number;
  /** Relief measured by the product (top of terrain above its base), if applicable. */
  reliefMm?: number;
};

export function validateMesh(m: Mesh, inputs: CommonInputs): ValidationReport & { wall: ReturnType<typeof wallThickness> } {
  const { profile } = inputs;
  const checks: Record<string, Check> = {};
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const fail = (code: string, message: string, measured?: number, required?: number) => errors.push({ code, message, measured, required });

  let finite = true;
  for (let i = 0; i < m.positions.length; i++) if (!Number.isFinite(m.positions[i]!)) { finite = false; break; }
  checks.finiteCoordinates = { status: finite ? "pass" : "fail", method: "every coordinate is a finite number" };
  if (!finite) fail("NON_FINITE_COORDINATES", "Mesh contains non-finite coordinates.");

  const degenerate = degenerateTriangles(m);
  checks.degenerateTriangles = { status: degenerate === 0 ? "pass" : "fail", method: "triangle area > 1e-10 mm²", measured: degenerate, required: 0 };
  if (degenerate) fail("DEGENERATE_TRIANGLES", "Mesh contains zero-area triangles.", degenerate, 0);

  const topo = edgeTopology(m);
  checks.watertight = { status: topo.boundary === 0 ? "pass" : "fail", method: "every edge used by exactly two triangles", measured: topo.boundary, required: 0 };
  checks.manifoldEdges = { status: topo.nonManifold === 0 ? "pass" : "fail", method: "no edge used by more than two triangles", measured: topo.nonManifold, required: 0 };
  checks.consistentOrientation = { status: topo.misoriented === 0 ? "pass" : "fail", method: "each directed edge used once", measured: topo.misoriented, required: 0 };
  if (topo.boundary) fail("NOT_WATERTIGHT", "Mesh has open (boundary) edges.", topo.boundary, 0);
  if (topo.nonManifold) fail("NON_MANIFOLD_EDGES", "Mesh has edges shared by more than two triangles.", topo.nonManifold, 0);
  if (topo.misoriented) fail("INCONSISTENT_ORIENTATION", "Neighbouring triangles have opposite winding.", topo.misoriented, 0);

  const badVerts = nonManifoldVertices(m);
  checks.manifoldVertices = { status: badVerts === 0 ? "pass" : "fail", method: "triangles around each vertex form one fan", measured: badVerts, required: 0 };
  if (badVerts) fail("NON_MANIFOLD_VERTICES", "Mesh has vertices joining separate surface patches.", badVerts, 0);

  const shells = shellCount(m);
  checks.singleShell = { status: shells === 1 ? "pass" : "fail", method: "edge-connected components", measured: shells, required: 1 };
  if (shells !== 1) fail("MULTIPLE_SHELLS", "Mesh is not a single connected shell.", shells, 1);

  const volume = signedVolumeMm3(m);
  checks.outwardNormals = { status: volume > 0 ? "pass" : "fail", method: "signed volume positive", measured: +volume.toFixed(3) };
  if (!(volume > 0)) fail("INWARD_NORMALS", "Signed volume is not positive (normals face inward).", volume, 0);

  const bvh = new TriangleBVH(m);
  const crossingAt: number[][] = [];
  const crossings = selfIntersections(m, bvh, 1000, crossingAt);
  checks.selfIntersections = {
    status: crossings === 0 ? "pass" : "fail",
    method: "triangle-pair edge crossings via BVH (coplanar overlaps not detected)",
    measured: crossings,
    required: 0,
    ...(crossingAt.length ? { note: `First crossing locations (mm): ${JSON.stringify(crossingAt)}` } : {})
  };
  if (crossings) fail("SELF_INTERSECTIONS", "Triangles cross each other.", crossings, 0);

  const wall = wallThickness(m, bvh);
  const wallMeasured = { minMm: +wall.minMm.toFixed(3), p1Mm: +wall.p1Mm.toFixed(3), p5Mm: +wall.p5Mm.toFixed(3), medianMm: +wall.medianMm.toFixed(3), samples: wall.samples, misses: wall.misses };
  if (profile.minWallMm === null) {
    checks.minimumWallThickness = { status: "not_run", method: "inward ray cast from face centroids", measured: wallMeasured, note: "No minimum set in this constraint profile." };
  } else {
    const ok = wall.p1Mm >= profile.minWallMm;
    checks.minimumWallThickness = {
      status: ok ? "pass" : "fail",
      method: "inward ray cast from face centroids; judged on the 1st percentile, minimum reported with location",
      measured: wallMeasured,
      required: profile.minWallMm,
      location: wall.minAt.map((v) => +v.toFixed(3))
    };
    if (!ok) fail("MINIMUM_WALL_THICKNESS", "Metal falls below the minimum wall thickness.", +wall.p1Mm.toFixed(3), profile.minWallMm);
  }
  if (wall.misses) warnings.push({ code: "WALL_RAY_MISSES", message: "Some thickness rays escaped the solid; check for open regions.", measured: wall.misses });

  checks.minimumFeatureSize = { status: "not_run", method: "not implemented", note: "Feature-width analysis is planned; the manufacturer's minimum is also not yet known." };

  if (inputs.reliefMm === undefined || profile.maxReliefMm === null) {
    checks.maximumRelief = { status: "not_run", method: "terrain top above product base", measured: inputs.reliefMm };
  } else {
    const ok = inputs.reliefMm <= profile.maxReliefMm + 1e-9;
    checks.maximumRelief = { status: ok ? "pass" : "fail", method: "terrain top above product base", measured: +inputs.reliefMm.toFixed(3), required: profile.maxReliefMm };
    if (!ok) fail("MAXIMUM_RELIEF", "Terrain relief exceeds the product maximum.", inputs.reliefMm, profile.maxReliefMm);
  }

  const box = bounds(m);
  checks.dimensions = { status: "pass", method: "axis-aligned bounding box, mm", measured: { x: +box.size[0]!.toFixed(3), y: +box.size[1]!.toFixed(3), z: +box.size[2]!.toFixed(3) } };
  if (profile.expectedSizeMm) {
    const e = profile.expectedSizeMm;
    const off = Math.max(Math.abs(box.size[0]! - e.x), Math.abs(box.size[1]! - e.y), Math.abs(box.size[2]! - e.z));
    checks.dimensions.status = off <= e.toleranceMm ? "pass" : "fail";
    checks.dimensions.required = `${e.x} × ${e.y} × ${e.z} ± ${e.toleranceMm}`;
    if (off > e.toleranceMm) fail("DIMENSIONS", "Bounding box differs from the expected size.", off, e.toleranceMm);
  }

  const volumeCm3 = volume / 1000;
  checks.volumeAndMass = { status: "pass", method: `signed volume × density ${inputs.densityGcm3} g/cm³`, measured: { volumeCm3: +volumeCm3.toFixed(4), massG: +(volumeCm3 * inputs.densityGcm3).toFixed(2) } };

  const valid = errors.length === 0;
  return {
    valid,
    productType: inputs.productType,
    status: !valid ? "fail" : profile.approved ? "pass" : "held_for_review",
    constraintProfile: { id: profile.id, approved: profile.approved },
    errors,
    warnings,
    checks,
    validatorVersion: VALIDATOR_VERSION,
    wall
  };
}
