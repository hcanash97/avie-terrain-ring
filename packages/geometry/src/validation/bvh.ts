/**
 * Bounding-volume hierarchy over triangles for ray casts (wall thickness) and
 * triangle-pair overlap queries (self-intersection). Pure; deterministic.
 */
// Module-level helpers: closures created per call are slow in hot loops.
const sub = (u: number[], v: number[]) => [u[0]! - v[0]!, u[1]! - v[1]!, u[2]! - v[2]!];
const dot = (u: number[], v: number[]) => u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!;
const lerp3 = (A: number[], B: number[], C: number[], u: number, v: number) => [
  A[0]! + u * (B[0]! - A[0]!) + v * (C[0]! - A[0]!),
  A[1]! + u * (B[1]! - A[1]!) + v * (C[1]! - A[1]!),
  A[2]! + u * (B[2]! - A[2]!) + v * (C[2]! - A[2]!)
];

export type Tri = { positions: ArrayLike<number>; indices: ArrayLike<number> };

type Node = { min: number[]; max: number[]; left: number; right: number; start: number; count: number };

export class TriangleBVH {
  readonly order: Uint32Array;
  private readonly nodes: Node[] = [];
  private readonly bmin: Float64Array;
  private readonly bmax: Float64Array;
  private readonly centroid: Float64Array;

  constructor(private readonly mesh: Tri) {
    const n = mesh.indices.length / 3;
    this.order = new Uint32Array(n).map((_, i) => i);
    this.bmin = new Float64Array(n * 3);
    this.bmax = new Float64Array(n * 3);
    this.centroid = new Float64Array(n * 3);
    const P = mesh.positions, I = mesh.indices;
    for (let t = 0; t < n; t++)
      for (let k = 0; k < 3; k++) {
        const a = P[I[t * 3]! * 3 + k]!, b = P[I[t * 3 + 1]! * 3 + k]!, c = P[I[t * 3 + 2]! * 3 + k]!;
        this.bmin[t * 3 + k] = Math.min(a, b, c);
        this.bmax[t * 3 + k] = Math.max(a, b, c);
        this.centroid[t * 3 + k] = (a + b + c) / 3;
      }
    if (n > 0) this.build(0, n);
  }

  private build(start: number, count: number): number {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = start; i < start + count; i++) {
      const t = this.order[i]!;
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k]!, this.bmin[t * 3 + k]!);
        max[k] = Math.max(max[k]!, this.bmax[t * 3 + k]!);
      }
    }
    const id = this.nodes.length;
    this.nodes.push({ min, max, left: -1, right: -1, start, count });
    if (count <= 8) return id;
    const ext = [max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!];
    const axis = ext[0]! >= ext[1]! && ext[0]! >= ext[2]! ? 0 : ext[1]! >= ext[2]! ? 1 : 2;
    const slice = Array.from(this.order.subarray(start, start + count));
    slice.sort((a, b) => this.centroid[a * 3 + axis]! - this.centroid[b * 3 + axis]!);
    this.order.set(slice, start);
    const half = count >> 1;
    const left = this.build(start, half);
    const right = this.build(start + half, count - half);
    const node = this.nodes[id]!;
    node.left = left; node.right = right; node.count = 0;
    return id;
  }

  /** Nearest hit distance along a unit ray, ignoring triangle `skip`; Infinity if none. */
  raycast(o: number[], d: number[], skip: number, maxT = Infinity): { t: number; tri: number } {
    let best = maxT, bestTri = -1;
    const stack = [0];
    const inv = d.map((v) => 1 / v);
    while (stack.length) {
      const node = this.nodes[stack.pop()!]!;
      // slab test
      let t0 = 0, t1 = best;
      for (let k = 0; k < 3; k++) {
        let a = (node.min[k]! - o[k]!) * inv[k]!, b = (node.max[k]! - o[k]!) * inv[k]!;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) break;
      }
      if (t0 > t1) continue;
      if (node.count > 0) {
        for (let i = node.start; i < node.start + node.count; i++) {
          const tri = this.order[i]!;
          if (tri === skip) continue;
          const t = this.rayTriangle(o, d, tri);
          if (t > 1e-6 && t < best) { best = t; bestTri = tri; }
        }
      } else {
        stack.push(node.left, node.right);
      }
    }
    return { t: bestTri < 0 ? Infinity : best, tri: bestTri };
  }

  /** Closest point on the surface to `p` within `maxDist`; dist is Infinity if none. */
  nearest(p: number[], maxDist = Infinity): { dist: number; point: number[]; tri: number } {
    let best = maxDist * maxDist, bestPoint: number[] = [], bestTri = -1;
    const stack = [0];
    while (stack.length) {
      const node = this.nodes[stack.pop()!]!;
      let d2 = 0;
      for (let k = 0; k < 3; k++) {
        const v = p[k]! < node.min[k]! ? node.min[k]! - p[k]! : p[k]! > node.max[k]! ? p[k]! - node.max[k]! : 0;
        d2 += v * v;
      }
      if (d2 >= best) continue;
      if (node.count > 0) {
        for (let i = node.start; i < node.start + node.count; i++) {
          const tri = this.order[i]!;
          const q = this.closestOnTriangle(p, tri);
          const e = (q[0]! - p[0]!) ** 2 + (q[1]! - p[1]!) ** 2 + (q[2]! - p[2]!) ** 2;
          if (e < best) { best = e; bestPoint = q; bestTri = tri; }
        }
      } else {
        stack.push(node.left, node.right);
      }
    }
    return { dist: bestTri < 0 ? Infinity : Math.sqrt(best), point: bestPoint, tri: bestTri };
  }

  /** Closest point on triangle `tri` to `p` (Ericson, Real-Time Collision Detection 5.1.5). */
  closestOnTriangle(p: number[], tri: number): number[] {
    const P = this.mesh.positions, I = this.mesh.indices;
    const A = [P[I[tri * 3]! * 3]!, P[I[tri * 3]! * 3 + 1]!, P[I[tri * 3]! * 3 + 2]!];
    const B = [P[I[tri * 3 + 1]! * 3]!, P[I[tri * 3 + 1]! * 3 + 1]!, P[I[tri * 3 + 1]! * 3 + 2]!];
    const C = [P[I[tri * 3 + 2]! * 3]!, P[I[tri * 3 + 2]! * 3 + 1]!, P[I[tri * 3 + 2]! * 3 + 2]!];
    const ab = sub(B, A), ac = sub(C, A), ap = sub(p, A);
    const d1 = dot(ab, ap), d2 = dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return A;
    const bp = sub(p, B), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) return B;
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) return lerp3(A, B, C, d1 / (d1 - d3), 0);
    const cp = sub(p, C), d5 = dot(ab, cp), d6 = dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) return C;
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) return lerp3(A, B, C, 0, d2 / (d2 - d6));
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
      return [B[0]! + w * (C[0]! - B[0]!), B[1]! + w * (C[1]! - B[1]!), B[2]! + w * (C[2]! - B[2]!)];
    }
    const denom = 1 / (va + vb + vc);
    return lerp3(A, B, C, vb * denom, vc * denom);
  }

  /** Möller–Trumbore; returns t or -1. */
  rayTriangle(o: number[], d: number[], tri: number): number {
    const P = this.mesh.positions, I = this.mesh.indices;
    const a = I[tri * 3]! * 3, b = I[tri * 3 + 1]! * 3, c = I[tri * 3 + 2]! * 3;
    const e1 = [P[b]! - P[a]!, P[b + 1]! - P[a + 1]!, P[b + 2]! - P[a + 2]!];
    const e2 = [P[c]! - P[a]!, P[c + 1]! - P[a + 1]!, P[c + 2]! - P[a + 2]!];
    const p = [d[1]! * e2[2]! - d[2]! * e2[1]!, d[2]! * e2[0]! - d[0]! * e2[2]!, d[0]! * e2[1]! - d[1]! * e2[0]!];
    const det = e1[0]! * p[0]! + e1[1]! * p[1]! + e1[2]! * p[2]!;
    if (Math.abs(det) < 1e-14) return -1;
    const inv = 1 / det;
    const s = [o[0]! - P[a]!, o[1]! - P[a + 1]!, o[2]! - P[a + 2]!];
    const u = (s[0]! * p[0]! + s[1]! * p[1]! + s[2]! * p[2]!) * inv;
    if (u < 0 || u > 1) return -1;
    const q = [s[1]! * e1[2]! - s[2]! * e1[1]!, s[2]! * e1[0]! - s[0]! * e1[2]!, s[0]! * e1[1]! - s[1]! * e1[0]!];
    const v = (d[0]! * q[0]! + d[1]! * q[1]! + d[2]! * q[2]!) * inv;
    if (v < 0 || u + v > 1) return -1;
    return (e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) * inv;
  }

  /** Calls `visit(a, b)` once for every pair of triangles whose boxes overlap (a < b). */
  overlappingPairs(visit: (a: number, b: number) => void): void {
    const overlap = (x: Node, y: Node) =>
      x.min[0]! <= y.max[0]! && x.max[0]! >= y.min[0]! &&
      x.min[1]! <= y.max[1]! && x.max[1]! >= y.min[1]! &&
      x.min[2]! <= y.max[2]! && x.max[2]! >= y.min[2]!;
    const triOverlap = (a: number, b: number) => {
      for (let k = 0; k < 3; k++)
        if (this.bmin[a * 3 + k]! > this.bmax[b * 3 + k]! || this.bmax[a * 3 + k]! < this.bmin[b * 3 + k]!) return false;
      return true;
    };
    const stack: [number, number][] = [[0, 0]];
    while (stack.length) {
      const [i, j] = stack.pop()!;
      const A = this.nodes[i]!, B = this.nodes[j]!;
      if (!overlap(A, B)) continue;
      if (A.count > 0 && B.count > 0) {
        for (let x = A.start; x < A.start + A.count; x++)
          for (let y = B.start; y < B.start + B.count; y++) {
            const a = this.order[x]!, b = this.order[y]!;
            if (i === j && y <= x) continue;
            if (a !== b && triOverlap(a, b)) visit(Math.min(a, b), Math.max(a, b));
          }
      } else if (i === j) {
        stack.push([A.left, A.left], [A.right, A.right], [A.left, A.right]);
      } else if (A.count > 0) {
        stack.push([i, B.left], [i, B.right]);
      } else if (B.count > 0) {
        stack.push([A.left, j], [A.right, j]);
      } else {
        stack.push([A.left, B.left], [A.left, B.right], [A.right, B.left], [A.right, B.right]);
      }
    }
  }
}
