/**
 * Binary STL (little-endian). STL has no unit field: coordinates are written in
 * millimetres at 1:1 and the production spec states the unit explicitly.
 */
import type { IndexedMesh } from "./mesh";

/** 80-byte header text; must not start with "solid" (that marks ASCII STL). */
export function writeBinaryStl(mesh: IndexedMesh, header: string): Buffer {
  const { positions: P, indices: I } = mesh;
  const count = I.length / 3;
  const buf = Buffer.alloc(84 + count * 50);
  const text = header.replace(/^solid/i, "STL").slice(0, 80);
  buf.write(text.padEnd(80, " "), 0, 80, "ascii");
  buf.writeUInt32LE(count, 80);
  let o = 84;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]! * 3, b = I[t + 1]! * 3, c = I[t + 2]! * 3;
    const ux = P[b]! - P[a]!, uy = P[b + 1]! - P[a + 1]!, uz = P[b + 2]! - P[a + 2]!;
    const vx = P[c]! - P[a]!, vy = P[c + 1]! - P[a + 1]!, vz = P[c + 2]! - P[a + 2]!;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const v of [nx, ny, nz]) { buf.writeFloatLE(v, o); o += 4; }
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) { buf.writeFloatLE(P[i + k]!, o); o += 4; }
    buf.writeUInt16LE(0, o); o += 2;
  }
  return buf;
}

/** Reads a binary STL back as an unwelded triangle soup (for reopen checks). */
export function readBinaryStl(buf: Buffer): { header: string; mesh: IndexedMesh } {
  if (buf.length < 84) throw new Error("STL too short");
  const count = buf.readUInt32LE(80);
  if (buf.length !== 84 + count * 50) throw new Error(`STL size mismatch: header says ${count} triangles`);
  const positions = new Float32Array(count * 9);
  let o = 84;
  for (let t = 0; t < count; t++) {
    o += 12; // facet normal
    for (let k = 0; k < 9; k++) { positions[t * 9 + k] = buf.readFloatLE(o); o += 4; }
    o += 2;
  }
  const indices = new Uint32Array(count * 3).map((_, i) => i);
  return { header: buf.toString("ascii", 0, 80).trim(), mesh: { positions, indices } };
}
