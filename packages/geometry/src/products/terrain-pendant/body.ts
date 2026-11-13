/**
 * Terrain pendant body for any rounded-rectangle outline.
 *
 * Coordinates (millimetres, right-handed), the piece lying face-up: origin at
 * the body centre on the back plane (back at y = 0); +Y relief; +X right seen
 * from the front with the top of the piece at −Z. Terrain north points to −Z
 * and east to +X; the landscape fills the outline's own aspect (cropped from a
 * frame of the same width and height, never stretched).
 *
 * Profile, from the centre of the face outward and round to the back:
 *   face (terrain) → top edge round → side wall → back edge round → flat back.
 * Face rings scale the face edge towards the centre; rim rings are true inward
 * offsets of the outline, so edge rounds keep their radius on any shape.
 *
 * Terrain coverage:
 *   full         relief everywhere, fading to the plain face over `fadeMm`
 *                (0 = terrain runs to the edge and the side wall rises to meet it)
 *   above_level  only ground above `level` (0–1 of the relief) is raised; lower
 *                ground stays a flat polished field (the "island" look)
 */
import { sampleBilinear, type TerrainRelief } from "@avie/terrain";
import type { TerrainProductMesh } from "../shared/types";
import { outlineDistance, outlinePoint, validateOutline, type PendantOutline } from "./outline";

export type TerrainCoverage = { mode: "full" } | { mode: "above_level"; level: number };

export type PendantBodyParameters = {
  outline: PendantOutline;
  baseThicknessMm: number;
  edgeRoundMm: number;
  fadeMm: number;
  coverage: TerrainCoverage;
  /** Processed terrain over a frame of the outline's width × height; null = plain face. */
  terrain: TerrainRelief | null;
  resolution: { rings: number; angular: number; round: number };
};

export const SURFACE_LABEL = { body: 0, terrain: 1, back: 2, rim: 3 } as const;

const smootherstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export function createPendantBody(p: PendantBodyParameters): TerrainProductMesh {
  const o = p.outline, e = p.edgeRoundMm, base = p.baseThicknessMm;
  validateOutline(o);
  if (!(e > 0 && base >= 2 * e)) throw new Error("Base must be at least twice the edge round");
  if (!(e < Math.min(o.widthMm, o.heightMm) / 4)) throw new Error("Edge round too large for the outline");
  if (!(p.fadeMm >= 0 && p.fadeMm < Math.min(o.widthMm, o.heightMm) / 2 - e)) throw new Error("Terrain fade must fit inside the face");
  if (p.coverage.mode === "above_level" && !(p.coverage.level >= 0 && p.coverage.level < 1)) throw new Error("Coverage level must lie in [0, 1)");
  const { rings, angular, round } = p.resolution;

  const lift = (x: number, z: number) => {
    if (!p.terrain) return 0;
    const t = p.terrain;
    const u = Math.min(1, Math.max(0, x / o.widthMm + 0.5));
    const v = Math.min(1, Math.max(0, z / o.heightMm + 0.5));
    let h = sampleBilinear(t.data, t.cols, t.rows, u, v);
    if (p.coverage.mode === "above_level") h = Math.max(0, (h - p.coverage.level) / (1 - p.coverage.level));
    const inside = -outlineDistance(o, x, z, e); // distance inside the face edge
    const mask = p.fadeMm === 0 ? (inside >= -1e-9 ? 1 : 0) : smootherstep(inside / p.fadeMm);
    return h * t.reliefMm * mask;
  };

  const positions: number[] = [];
  const lifts: number[] = [];
  const push = (x: number, y: number, z: number, l: number) => { positions.push(x, y + l, z); lifts.push(l); };
  const thetas = Array.from({ length: angular }, (_, j) => (2 * Math.PI * j) / angular);
  const faceEdge = thetas.map((th) => outlinePoint(o, th, e));
  const edgeLift = faceEdge.map(([x, z]) => lift(x, z));

  type Ring = "face" | "rim" | "back";
  const ringKind: Ring[] = [];
  const top = 0;
  push(0, base, 0, lift(0, 0));
  // Face rings: the face edge scaled towards the centre.
  for (let i = 1; i <= rings; i++) {
    const s = i / rings;
    thetas.forEach((_, j) => { const [x, z] = faceEdge[j]!; push(s * x, base, s * z, lift(s * x, s * z)); });
    ringKind.push("face");
  }
  // Top edge round, then the side wall, riding on the terrain at the edge.
  for (let k = 1; k <= round; k++) {
    const a = (Math.PI / 2) * (k / round);
    const inset = e - e * Math.sin(a), y = base - e + e * Math.cos(a);
    thetas.forEach((th, j) => { const [x, z] = outlinePoint(o, th, inset); push(x, y, z, edgeLift[j]!); });
    ringKind.push("rim");
  }
  // Back edge round (starting at the bottom of the side wall), then the flat back.
  for (let k = 0; k <= round; k++) {
    const a = (Math.PI / 2) * (k / round);
    const inset = e - e * Math.cos(a), y = e - e * Math.sin(a);
    thetas.forEach((th) => { const [x, z] = outlinePoint(o, th, inset); push(x, y, z, 0); });
    ringKind.push(k === round ? "back" : "rim");
  }
  for (let i = rings - 1; i >= 1; i--) {
    const s = i / rings;
    faceEdge.forEach(([x, z]) => push(s * x, 0, s * z, 0));
    ringKind.push("back");
  }
  const bottom = positions.length / 3;
  push(0, 0, 0, 0);

  const v = (ring: number, j: number) => 1 + ring * angular + (j % angular);
  const tris: { a: number; b: number; c: number; label: number }[] = [];
  const raised = (...ids: number[]) => ids.some((i) => lifts[i]! > 1e-6);
  const labelFor = (kind: Ring, ...ids: number[]) =>
    kind === "face" ? (raised(...ids) ? SURFACE_LABEL.terrain : SURFACE_LABEL.body) : kind === "back" ? SURFACE_LABEL.back : raised(...ids) ? SURFACE_LABEL.rim : SURFACE_LABEL.body;
  for (let j = 0; j < angular; j++) tris.push({ a: top, b: v(0, j + 1), c: v(0, j), label: labelFor("face", top, v(0, j), v(0, j + 1)) });
  for (let i = 0; i < ringKind.length - 1; i++) {
    const kind = ringKind[i] === "face" && ringKind[i + 1] === "face" ? "face" : ringKind[i] === "back" && ringKind[i + 1] === "back" ? "back" : "rim";
    for (let j = 0; j < angular; j++) {
      const a = v(i, j), b = v(i, j + 1), c = v(i + 1, j), d = v(i + 1, j + 1);
      tris.push({ a, b, c: d, label: labelFor(kind, a, b, d) }, { a, b: d, c, label: labelFor(kind, a, d, c) });
    }
  }
  const last = ringKind.length - 1;
  for (let j = 0; j < angular; j++) tris.push({ a: bottom, b: v(last, j), c: v(last, j + 1), label: SURFACE_LABEL.back });

  tris.sort((x, y) => (x.label === SURFACE_LABEL.terrain ? 0 : 1) - (y.label === SURFACE_LABEL.terrain ? 0 : 1));
  const indices = new Uint32Array(tris.flatMap((t) => [t.a, t.b, t.c]));
  const mesh: TerrainProductMesh = {
    positions: new Float32Array(positions),
    indices,
    shade: new Float32Array(lifts.length).fill(1),
    faceTriangleCount: tris.filter((t) => t.label === SURFACE_LABEL.terrain).length,
    triangleCount: tris.length,
    terrainBlend: Float32Array.from(lifts, (l) => Math.min(1, l / 0.05)),
    terrainAdapted: false,
    surfaceLabels: Uint8Array.from(tris.map((t) => t.label)),
  };
  if (signedVolume(mesh) < 0) {
    const I = mesh.indices;
    for (let t = 0; t < I.length; t += 3) [I[t + 1], I[t + 2]] = [I[t + 2]!, I[t + 1]!];
  }
  return mesh;
}

export function signedVolume(m: { positions: ArrayLike<number>; indices: ArrayLike<number> }) {
  const P = m.positions, I = m.indices;
  let vol = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]! * 3, b = I[t + 1]! * 3, c = I[t + 2]! * 3;
    vol += (P[a]! * (P[b + 1]! * P[c + 2]! - P[b + 2]! * P[c + 1]!) - P[a + 1]! * (P[b]! * P[c + 2]! - P[b + 2]! * P[c]!) + P[a + 2]! * (P[b]! * P[c + 1]! - P[b + 1]! * P[c]!)) / 6;
  }
  return vol;
}
