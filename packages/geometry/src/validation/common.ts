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

export const VALIDATOR_VERSION = "mesh-validation/v3";

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
 * Surface labels, one per triangle, supplied by the product generator. They let
 * thickness be reported by what it means rather than as one mixed figure:
 *   - inner: the finger (or back) surface. Rays that start or end here measure
 *     the metal between the outside and the wearer: STRUCTURAL wall.
 *   - terrain: relief and its rim. Thin readings between two terrain points
 *     measure how sharp or narrow a feature is, not how much metal is behind it.
 *   - rim: where terrain meets the product's wall (edge round and wall strip).
 *     Judged by a product-specific rim check, not the feature measure.
 *   - channel / attachment: walls of a cut chain channel, or a loop or tab joined
 *     on. Reported apart from terrain; rays ending on them are not body edges.
 *   - body: everything else (band, shoulders, side walls, edge rounds).
 */
export const SURFACE = { body: 0, terrain: 1, inner: 2, rim: 3, channel: 4, attachment: 5 } as const;
export type SurfaceLabel = (typeof SURFACE)[keyof typeof SURFACE];

type RaySample = { t: number; from: number; to: number; at: number[]; tri: number };

/**
 * Inward ray cast from triangle centroids: distance to where the ray leaves the
 * solid. Inner-surface triangles are all sampled (there are few of them); the
 * rest are sampled evenly up to `maxSamples`.
 */
export function rayThickness(m: Mesh, bvh: TriangleBVH, labels?: ArrayLike<number>, maxSamples = 60000) {
  const I = m.indices;
  const n = I.length / 3;
  const stride = Math.max(1, Math.ceil(n / maxSamples));
  const samples: RaySample[] = [];
  let misses = 0;
  for (let t = 0; t < n; t++) {
    const from = labels ? labels[t]! : SURFACE.body;
    if (t % stride !== 0 && from !== SURFACE.inner) continue;
    const a = vertex(m, I[t * 3]!), b = vertex(m, I[t * 3 + 1]!), c = vertex(m, I[t * 3 + 2]!);
    const nn = cross(sub(b, a), sub(c, a));
    const len = Math.hypot(...nn);
    if (len === 0) continue;
    const dir = nn.map((x) => -x / len);
    const o = [(a[0]! + b[0]! + c[0]!) / 3, (a[1]! + b[1]! + c[1]!) / 3, (a[2]! + b[2]! + c[2]!) / 3];
    const hit = bvh.raycast(o, dir, t);
    if (!Number.isFinite(hit.t)) { misses++; continue; }
    samples.push({ t: hit.t, from, to: labels ? labels[hit.tri]! : SURFACE.body, at: o, tri: t });
  }
  return { samples, misses };
}

/** Distribution summary of a set of thickness readings (mm), with the location of the smallest. */
export function summarise(readings: { t: number; at: number[] }[]) {
  const values = readings.map((r) => r.t).sort((x, y) => x - y);
  let minAt: number[] = [];
  let min = Infinity;
  for (const r of readings) if (r.t < min) { min = r.t; minAt = r.at; }
  const q = (p: number) => values[Math.min(values.length - 1, Math.floor(p * (values.length - 1)))] ?? NaN;
  return { samples: values.length, minMm: min, p1Mm: q(0.01), p5Mm: q(0.05), medianMm: q(0.5), minAt, values };
}

/** Backwards-compatible single figure over every sampled triangle (no surface split). */
export function wallThickness(m: Mesh, bvh: TriangleBVH, maxSamples = 60000) {
  const { samples, misses } = rayThickness(m, bvh, undefined, maxSamples);
  return { ...summarise(samples), misses };
}

/** Largest feature diameter reported; anything at least this wide reads as this value. */
export const FEATURE_CAP_MM = 2;

/**
 * Feature size by the sphere method ("shrinking ball", Ma et al. 2012): the
 * diameter of the largest ball that fits inside the metal while touching the
 * surface at the sample point. Small at sharp crests, narrow ridges and
 * knife-edges, whatever direction they face; large wherever the surface is
 * backed by broad metal. Sampled on terrain triangles only.
 */
export function featureSize(m: Mesh, bvh: TriangleBVH, labels: ArrayLike<number>, maxSamples = 12000) {
  const I = m.indices;
  const terrain: number[] = [];
  for (let t = 0; t < I.length / 3; t++) if (labels[t] === SURFACE.terrain) terrain.push(t);
  const stride = Math.max(1, Math.ceil(terrain.length / maxSamples));
  const readings: { t: number; at: number[] }[] = [];
  for (let k = 0; k < terrain.length; k += stride) {
    const t = terrain[k]!;
    const a = vertex(m, I[t * 3]!), b = vertex(m, I[t * 3 + 1]!), c = vertex(m, I[t * 3 + 2]!);
    const nn = cross(sub(b, a), sub(c, a));
    const len = Math.hypot(...nn);
    if (len === 0) continue;
    const d = nn.map((x) => -x / len);
    const o = [(a[0]! + b[0]! + c[0]!) / 3, (a[1]! + b[1]! + c[1]!) / 3, (a[2]! + b[2]! + c[2]!) / 3];
    // A ball touching o along d cannot be wider than the inward ray reading, so start there.
    const ray = bvh.raycast(o, d, t);
    let r = Math.min(FEATURE_CAP_MM, ray.t) / 2;
    for (let iter = 0; iter < 60; iter++) {
      const centre = o.map((x, i) => x + d[i]! * r);
      const near = bvh.nearest(centre, r * (1 - 1e-6));
      if (!Number.isFinite(near.dist)) break; // nothing inside the ball: it fits
      const v = sub(near.point, o);
      const along = dot(v, d);
      if (along <= 1e-12) break;
      // Ball through o (tangent there) and the intruding point.
      const next = dot(v, v) / (2 * along);
      if (!(next < r)) break;
      r = next;
      if (r < 1e-4) break;
    }
    readings.push({ t: 2 * r, at: o });
  }
  return summarise(readings);
}

/** Triangles narrower than this (smallest altitude) are reported as near-degenerate slivers. */
export const NEAR_DEGENERATE_ALTITUDE_MM = 1e-4;

/** Triangle shape: slivers are valid geometry but trouble some slicing and CAM software. */
export function triangleQuality(m: Mesh) {
  const I = m.indices;
  let nearDegenerate = 0, minAltitude = Infinity, maxEdge = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = vertex(m, I[t]!), b = vertex(m, I[t + 1]!), c = vertex(m, I[t + 2]!);
    const edges = [Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))];
    const longest = Math.max(...edges);
    const altitude = longest > 0 ? Math.hypot(...cross(sub(b, a), sub(c, a))) / longest : 0;
    if (altitude < NEAR_DEGENERATE_ALTITUDE_MM) nearDegenerate++;
    minAltitude = Math.min(minAltitude, altitude);
    maxEdge = Math.max(maxEdge, longest);
  }
  return { nearDegenerate, minAltitudeMm: minAltitude, maxEdgeMm: maxEdge };
}

/**
 * Topology at a glance: connected shells, open / non-manifold / mis-oriented
 * edges, and the genus (holes through the solid) from Euler's formula, valid
 * when the mesh is a single closed shell.
 */
export function topologySummary(m: Mesh) {
  const topo = edgeTopology(m);
  const used = new Set<number>();
  const edges = new Set<string>();
  const I = m.indices;
  for (let t = 0; t < I.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = I[t + e]!, b = I[t + ((e + 1) % 3)]!;
      used.add(a);
      edges.add(a < b ? `${a},${b}` : `${b},${a}`);
    }
  const shells = shellCount(m);
  const euler = used.size - edges.size + I.length / 3;
  const closed = topo.boundary === 0 && topo.nonManifold === 0;
  return { shells, genus: shells === 1 && closed ? (2 - euler) / 2 : null, boundaryEdges: topo.boundary, nonManifoldEdges: topo.nonManifold, misorientedEdges: topo.misoriented };
}

export type CommonInputs = {
  productType: string;
  profile: ConstraintProfile;
  densityGcm3: number;
  /** Relief measured by the product (top of terrain above its base), if applicable. */
  reliefMm?: number;
  /** One SURFACE label per triangle. Without labels, thickness cannot be split by meaning. */
  surfaceLabels?: ArrayLike<number>;
};

export function validateMesh(
  m: Mesh,
  inputs: CommonInputs
): ValidationReport & { wall: ReturnType<typeof wallThickness>; feature: ReturnType<typeof summarise> | null } {
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

  const quality = triangleQuality(m);
  checks.triangleQuality = {
    status: quality.nearDegenerate === 0 ? "pass" : "warn",
    method: `smallest altitude of each triangle; below ${NEAR_DEGENERATE_ALTITUDE_MM} mm counts as a near-degenerate sliver`,
    measured: { nearDegenerate: quality.nearDegenerate, minAltitudeMm: +quality.minAltitudeMm.toExponential(2), maxEdgeMm: +quality.maxEdgeMm.toFixed(3) },
    note: "Reported, not judged: slivers are valid geometry, but some slicing and CAM software handles them poorly.",
  };
  if (quality.nearDegenerate) warnings.push({ code: "NEAR_DEGENERATE_TRIANGLES", message: "Mesh contains near-degenerate sliver triangles.", measured: quality.nearDegenerate });

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

  // --- Thickness, split by what it means --------------------------------------
  const labels = inputs.surfaceLabels;
  if (labels && labels.length !== m.indices.length / 3) throw new Error("surfaceLabels must have one entry per triangle");
  const rays = rayThickness(m, bvh, labels);
  const fmt = (w: ReturnType<typeof summarise>) => ({ minMm: +w.minMm.toFixed(3), p1Mm: +w.p1Mm.toFixed(3), p5Mm: +w.p5Mm.toFixed(3), medianMm: +w.medianMm.toFixed(3), samples: w.samples });
  const at = (w: ReturnType<typeof summarise>) => w.minAt.map((v) => +v.toFixed(3));
  const structural = summarise(labels ? rays.samples.filter((r) => r.from === SURFACE.inner || r.to === SURFACE.inner) : rays.samples);
  const wall = { ...structural, misses: rays.misses };
  const wallMethod = labels
    ? "structural: inward ray cast from triangle centroids, counting only rays that start or end on the inner (finger) surface, i.e. metal between the outside and the wearer; judged on the 1st percentile"
    : "inward ray cast from every sampled triangle centroid (surfaces not labelled, so terrain sharpness and edge rounds are mixed in); judged on the 1st percentile";
  if (profile.minWallMm === null) {
    checks.minimumWallThickness = { status: "not_run", method: wallMethod, measured: { ...fmt(structural), misses: rays.misses }, location: at(structural), note: "Measured only: no minimum is set in this constraint profile." };
  } else {
    const ok = structural.p1Mm >= profile.minWallMm;
    checks.minimumWallThickness = { status: ok ? "pass" : "fail", method: wallMethod, measured: { ...fmt(structural), misses: rays.misses }, required: profile.minWallMm, location: at(structural) };
    if (!ok) fail("MINIMUM_WALL_THICKNESS", "Metal between the outside and the finger falls below the minimum wall thickness.", +structural.p1Mm.toFixed(3), profile.minWallMm);
  }
  if (rays.misses) warnings.push({ code: "WALL_RAY_MISSES", message: "Some thickness rays escaped the solid; check for open regions.", measured: rays.misses });

  let feature: ReturnType<typeof summarise> | null = null;
  if (labels) {
    const body = (x: number) => x === SURFACE.body;
    const edges = summarise(rays.samples.filter((r) => body(r.from) && body(r.to)));
    checks.edgeRayThickness = {
      status: "not_run",
      method: "inward ray cast between body surfaces (band, shoulders, side walls), not touching the finger or terrain",
      measured: fmt(edges),
      location: at(edges),
      note: "Reported only, not judged: at convex edge rounds a ray crosses the round itself, so small readings here describe the edge radius, not missing metal."
    };
    feature = featureSize(m, bvh, labels);
    const measured = fmt(feature);
    const method = `sphere method on terrain relief triangles (rim excluded): diameter of the largest ball inside the metal touching each point (shrinking ball); capped at ${FEATURE_CAP_MM} mm; judged on the 1st percentile`;
    if (profile.minFeatureMm === null) {
      checks.minimumFeatureSize = { status: "not_run", method, measured, location: at(feature), note: "Measured only: no minimum feature size is set in this constraint profile." };
    } else {
      const ok = feature.p1Mm >= profile.minFeatureMm;
      checks.minimumFeatureSize = { status: ok ? "pass" : "fail", method, measured, required: profile.minFeatureMm, location: at(feature) };
      if (!ok) fail("MINIMUM_FEATURE_SIZE", "Terrain features are narrower or sharper than the minimum feature size.", +feature.p1Mm.toFixed(3), profile.minFeatureMm);
    }
  } else {
    checks.minimumFeatureSize = { status: "not_run", method: "sphere method on terrain triangles", note: "Surfaces are not labelled, so terrain cannot be told apart from the body." };
  }

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
    wall,
    feature
  };
}

/** Add a product-specific check to a report, keeping validity and status consistent. */
export function withCheck<R extends ValidationReport>(report: R, name: string, check: Check, error?: ValidationError): R {
  const errors = error ? [...report.errors, error] : report.errors;
  const valid = errors.length === 0;
  return {
    ...report,
    checks: { ...report.checks, [name]: check },
    errors,
    valid,
    status: !valid ? "fail" : report.constraintProfile.approved ? "pass" : "held_for_review"
  };
}
