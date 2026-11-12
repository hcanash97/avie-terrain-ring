import type { TerrainProductMesh } from "./types";

/** Joins sharper than this keep separate shading normals (an intentional crease). */
export const CREASE_ANGLE_DEG = 40;

/**
 * Crease-aware normals. Each vertex first gets the area-weighted normal of its
 * own strip; vertices that share a position (where strips meet) are then
 * averaged only with neighbours whose normals are within CREASE_ANGLE_DEG.
 * Smooth joins shade continuously; intentional edges such as the terrain
 * perimeter stay crisp. This does not alter geometry or hide slope errors.
 */
export function weldedNormals(
  mesh: Pick<TerrainProductMesh, "positions" | "indices">,
): Float32Array {
  const { positions: P, indices: I } = mesh;
  const count = P.length / 3;
  const own = new Float64Array(count * 3);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]!,
      b = I[t + 1]!,
      c = I[t + 2]!;
    const ux = P[b * 3]! - P[a * 3]!,
      uy = P[b * 3 + 1]! - P[a * 3 + 1]!,
      uz = P[b * 3 + 2]! - P[a * 3 + 2]!;
    const vx = P[c * 3]! - P[a * 3]!,
      vy = P[c * 3 + 1]! - P[a * 3 + 1]!,
      vz = P[c * 3 + 2]! - P[a * 3 + 2]!;
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx; // length = 2 × area
    for (const v of [a, b, c]) {
      own[v * 3] = own[v * 3]! + nx;
      own[v * 3 + 1] = own[v * 3 + 1]! + ny;
      own[v * 3 + 2] = own[v * 3 + 2]! + nz;
    }
  }
  const unit = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) {
    const len = Math.hypot(own[i * 3]!, own[i * 3 + 1]!, own[i * 3 + 2]!) || 1;
    unit[i * 3] = own[i * 3]! / len;
    unit[i * 3 + 1] = own[i * 3 + 1]! / len;
    unit[i * 3 + 2] = own[i * 3 + 2]! / len;
  }
  const groups = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const k = `${Math.round(P[i * 3]! * 1e5)},${Math.round(P[i * 3 + 1]! * 1e5)},${Math.round(P[i * 3 + 2]! * 1e5)}`;
    const g = groups.get(k);
    if (g) g.push(i);
    else groups.set(k, [i]);
  }
  const cosLimit = Math.cos((CREASE_ANGLE_DEG * Math.PI) / 180);
  const out = new Float32Array(count * 3);
  for (const members of groups.values()) {
    for (const i of members) {
      let x = 0,
        y = 0,
        z = 0;
      for (const j of members) {
        const dot =
          unit[i * 3]! * unit[j * 3]! +
          unit[i * 3 + 1]! * unit[j * 3 + 1]! +
          unit[i * 3 + 2]! * unit[j * 3 + 2]!;
        if (dot >= cosLimit) {
          x += own[j * 3]!;
          y += own[j * 3 + 1]!;
          z += own[j * 3 + 2]!;
        }
      }
      const len = Math.hypot(x, y, z) || 1;
      out[i * 3] = x / len;
      out[i * 3 + 1] = y / len;
      out[i * 3 + 2] = z / len;
    }
  }
  return out;
}

/** Signed volume (mm³) via the divergence theorem. Positive if normals face out. */
export function meshVolume(
  mesh: Pick<TerrainProductMesh, "positions" | "indices">,
): number {
  const { positions: P, indices: I } = mesh;
  let volume = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]! * 3,
      b = I[t + 1]! * 3,
      c = I[t + 2]! * 3;
    volume +=
      (P[a]! * (P[b + 1]! * P[c + 2]! - P[b + 2]! * P[c + 1]!) -
        P[a + 1]! * (P[b]! * P[c + 2]! - P[b + 2]! * P[c]!) +
        P[a + 2]! * (P[b]! * P[c + 1]! - P[b + 1]! * P[c]!)) /
      6;
  }
  return volume;
}

/**
 * Watertightness and orientation check: every directed edge must be matched by
 * exactly one reverse edge (compared by position, since surfaces don't share
 * vertices). Returns the number of unmatched edges (0 = closed, consistent).
 */
export function openEdgeCount(
  mesh: Pick<TerrainProductMesh, "positions" | "indices">,
): number {
  const { positions: P, indices: I } = mesh;
  const key = (i: number) =>
    `${Math.round(P[i * 3]! * 1e4)},${Math.round(P[i * 3 + 1]! * 1e4)},${Math.round(P[i * 3 + 2]! * 1e4)}`;
  const edges = new Map<string, number>();
  for (let t = 0; t < I.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = key(I[t + e]!);
      const b = key(I[t + ((e + 1) % 3)]!);
      if (a === b) continue;
      const reverse = `${b}>${a}`;
      const count = edges.get(reverse);
      if (count) {
        if (count === 1) edges.delete(reverse);
        else edges.set(reverse, count - 1);
      } else {
        const forward = `${a}>${b}`;
        edges.set(forward, (edges.get(forward) ?? 0) + 1);
      }
    }
  }
  let open = 0;
  for (const c of edges.values()) open += c;
  return open;
}
