/**
 * Builds a pendant prototype for a package, from saved terrain, with the same
 * generator and style parameters as the internal preview, at a fixed
 * production resolution. Body size comes from the catalogue (proposed); all
 * other dimensions from the style's preview-only profile, so the result can
 * never be more than review-only.
 */
import { buildTerrain, frameFor, sampleFrame } from "@avie/terrain";
import { pendantPrototypeConfigurationSchema } from "@avie/shared-types";
import type { z } from "zod";
import { METAL_DENSITY_G_CM3 } from "@avie/geometry/terrain-ring";
import { createPendant } from "@avie/geometry/terrain-pendant";
import { resolvePendantPrototype, pendantStyleParameters } from "@avie/product-types";
import type { IndexedMesh } from "./mesh";
import { loadSavedTerrain } from "./ring-source";

export const PENDANT_PRODUCTION_RESOLUTION = { cols: 480, rings: 150, angular: 480, round: 8, attachmentSegments: 96 } as const;
const PRESET_LENGTH_M: Record<string, number> = {
  "Snowdon, GB": 6000, "Ben Nevis, GB": 7000, "Matterhorn, CH": 6000, "Table Mountain, ZA": 8000,
  "Mount Fuji, JP": 20000, "Grand Canyon, US": 16000, "Lake District, GB": 18000
};

export type PendantConfiguration = z.input<typeof pendantPrototypeConfigurationSchema>;

export async function buildProductionPendant(input: PendantConfiguration) {
  const config = pendantPrototypeConfigurationSchema.parse(input);
  const { presetId, style: styleId } = config;
  const capability = resolvePendantPrototype({ productType: "terrain_pendant", contractVersion: 1, configurationVersion: config.configurationVersion, presetId, style: styleId });
  const preset = capability.preset;
  const params = pendantStyleParameters(presetId, styleId, config.coverage);
  const lengthM = config.lengthM ?? PRESET_LENGTH_M[config.place] ?? 6000;
  const dims = { faceLengthMm: params.outline.widthMm, faceWidthMm: params.outline.heightMm, maxReliefMm: params.maximumReliefMm };
  const { source } = loadSavedTerrain(config.place);
  const area = frameFor(lengthM, config.bearingDeg, dims);
  const R = PENDANT_PRODUCTION_RESOLUTION;
  const terrain = buildTerrain(source, area, dims, { terrainHeight: config.terrainHeight, detail: config.detail }, R.cols);
  const built = await createPendant({ ...params, terrain, resolution: { rings: R.rings, angular: R.angular, round: R.round }, attachmentSegments: R.attachmentSegments });
  const mesh: IndexedMesh = { positions: built.mesh.positions, indices: built.mesh.indices, surfaceLabels: built.mesh.surfaceLabels };
  return {
    preset,
    config,
    selection: capability.selection,
    generatorVersion: capability.geometryVersion,
    style: capability.style,
    params,
    lengthM,
    area,
    terrain,
    mesh,
    built,
    elevations: { data: sampleFrame(source, area, R.cols, terrain.rows), cols: R.cols, rows: terrain.rows },
    densityGcm3: METAL_DENSITY_G_CM3[config.metal],
  };
}
