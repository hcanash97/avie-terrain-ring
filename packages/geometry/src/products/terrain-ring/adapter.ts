import {
  buildTerrain,
  frameFor,
  type TerrainSource,
  type Detail,
} from "@avie/terrain";
import { createRingMesh, type RingParameters } from "./geometry";

export type RingPreviewInput = Omit<
  RingParameters,
  "terrain" | "resolution"
> & {
  source: TerrainSource;
  lengthM: number;
  bearingDeg: number;
  terrainHeight: number;
  detail: Detail;
  flat: boolean;
  resolution: RingParameters["resolution"] & { cols: number };
};
/** Existing preview adapter. Retains the legacy footprint-matched crop and LOD.
 * This is not the signed configuration/production export path.
 */
export function generateTerrainRingPreview(input: RingPreviewInput) {
  const terrain = buildTerrain(
    input.source,
    frameFor(input.lengthM, input.bearingDeg, input.weight),
    input.weight,
    { terrainHeight: input.terrainHeight, detail: input.detail },
    input.resolution.cols,
  );
  const mesh = createRingMesh({
    innerDiameterMm: input.innerDiameterMm,
    weight: input.weight,
    shoulder: input.shoulder,
    profile: input.profile,
    terrain: input.flat ? null : terrain,
    constraints: input.constraints,
    resolution: input.resolution,
  });
  return { terrain, mesh };
}
