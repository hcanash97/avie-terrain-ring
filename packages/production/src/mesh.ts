/**
 * Indexed triangle mesh used for manufacturing output (millimetres, 1:1).
 * The preview generator emits separate surface strips that share positions but
 * not indices; production output welds them into one indexed shell first.
 */
export type IndexedMesh = { positions: Float32Array; indices: Uint32Array };

/** Merge vertices that coincide within `toleranceMm`, and drop triangles that collapse. */
export function weld(mesh: IndexedMesh, toleranceMm = 1e-5): IndexedMesh {
  const { positions: P, indices: I } = mesh;
  const scale = 1 / toleranceMm;
  const map = new Map<string, number>();
  const remap = new Uint32Array(P.length / 3);
  const out: number[] = [];
  for (let i = 0; i < P.length / 3; i++) {
    const key = `${Math.round(P[i * 3]! * scale)},${Math.round(P[i * 3 + 1]! * scale)},${Math.round(P[i * 3 + 2]! * scale)}`;
    let j = map.get(key);
    if (j === undefined) {
      j = out.length / 3;
      map.set(key, j);
      out.push(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!);
    }
    remap[i] = j;
  }
  const tris: number[] = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = remap[I[t]!]!, b = remap[I[t + 1]!]!, c = remap[I[t + 2]!]!;
    if (a !== b && b !== c && a !== c) tris.push(a, b, c);
  }
  return { positions: new Float32Array(out), indices: new Uint32Array(tris) };
}

export function boundingBox(mesh: IndexedMesh) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const P = mesh.positions;
  for (let i = 0; i < P.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, P[i + k]!);
      max[k] = Math.max(max[k]!, P[i + k]!);
    }
  return { min, max, size: [max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!] };
}

/** Signed volume in mm³ (positive when faces are wound outward). */
export function signedVolume(mesh: IndexedMesh): number {
  const { positions: P, indices: I } = mesh;
  let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]! * 3, b = I[t + 1]! * 3, c = I[t + 2]! * 3;
    v +=
      (P[a]! * (P[b + 1]! * P[c + 2]! - P[b + 2]! * P[c + 1]!) -
        P[a + 1]! * (P[b]! * P[c + 2]! - P[b + 2]! * P[c]!) +
        P[a + 2]! * (P[b]! * P[c + 1]! - P[b + 1]! * P[c]!)) / 6;
  }
  return v;
}
