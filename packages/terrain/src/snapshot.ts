import { z } from "zod";
import { sampleBilinear, type TerrainSource } from "./heightmap";
const gridSchema = z.strictObject({
  cols: z.number().int().min(2).max(4096),
  rows: z.number().int().min(2).max(4096),
  widthM: z.number().finite().positive().max(1000000),
  heightM: z.number().finite().positive().max(1000000),
});
/** Decode an explicitly little-endian source grid; checksum verification is server-only. */
export function decodeHeightmap(
  bytes: Uint8Array,
  cols: number,
  rows: number,
): Float32Array {
  gridSchema.pick({ cols: true, rows: true }).parse({ cols, rows });
  if (bytes.byteLength !== cols * rows * 4)
    throw new Error("Heightmap byte length does not match dimensions");
  const data = new Float32Array(cols * rows),
    view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < data.length; i++) {
    const v = view.getFloat32(i * 4, true);
    if (!Number.isFinite(v))
      throw new Error("Heightmap contains missing or non-finite samples");
    data[i] = v;
  }
  return data;
}
/** Saved source convention: rows north-to-south, columns west-to-east around
 * the design centre. Own the sample buffer; caller mutations cannot alter replay.
 * Out-of-coverage requests fail rather than inventing clamped terrain.
 */
export function sourceFromGrid(
  data: Float32Array,
  metadata: unknown,
): TerrainSource {
  const m = gridSchema.parse(metadata);
  if (data.length !== m.cols * m.rows || !data.every(Number.isFinite))
    throw new Error("Invalid saved elevation grid");
  const samples = data.slice();
  return Object.freeze({
    radiusM: Math.min(m.widthM, m.heightM) / 2,
    elevationAt: (eastM: number, northM: number) => {
      if (
        !Number.isFinite(eastM) ||
        !Number.isFinite(northM) ||
        Math.abs(eastM) > m.widthM / 2 + 1e-7 ||
        Math.abs(northM) > m.heightM / 2 + 1e-7
      )
        throw new RangeError(
          "Requested terrain lies outside the saved source coverage",
        );
      return sampleBilinear(
        samples,
        m.cols,
        m.rows,
        0.5 + eastM / m.widthM,
        0.5 - northM / m.heightM,
      );
    },
  });
}
