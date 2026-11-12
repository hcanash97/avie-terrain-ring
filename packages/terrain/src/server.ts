import { sha256, verifyTerrainVersion } from "@avie/shared-types/server";
import { TERRAIN_ALGORITHM_VERSION } from "./processing";
import { decodeHeightmap, sourceFromGrid } from "./snapshot";
/** Caller must authorize the design separately. Reads only supplied saved bytes:
 * no fetching, replacement source, or live-data fallback on checksum failure.
 * Content verification alone does not establish customer/manufacturer approval.
 */
export function replayTerrainSource(versionInput: unknown, bytes: Uint8Array) {
  const version = verifyTerrainVersion(versionInput),
    p = version.parameters,
    m = p.heightmap;
  if (p.terrainAlgorithmVersion !== TERRAIN_ALGORITHM_VERSION)
    throw new Error("Unsupported terrain algorithm version");
  if (sha256(bytes) !== m.checksum)
    throw new Error("Saved heightmap checksum mismatch");
  const samples = decodeHeightmap(bytes, m.cols, m.rows);
  const source = sourceFromGrid(samples, {
    cols: m.cols,
    rows: m.rows,
    widthM: p.extentM.width,
    heightM: p.extentM.height,
  });
  return { version, source };
}
