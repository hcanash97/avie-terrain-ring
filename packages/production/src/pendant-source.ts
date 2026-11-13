/**
 * Builds the round pendant prototype for a package, from saved terrain, with
 * the same generator as the internal preview at a fixed production resolution.
 * Every dimension other than the catalogue diameter comes from the preview-only
 * profile, so the result can never be more than review-only.
 */
import { buildTerrain, frameFor, sampleFrame, type Detail } from "@avie/terrain";
import { METAL_DENSITY_G_CM3 } from "@avie/geometry/terrain-ring";
import { createRoundPendant, pendantDimensions } from "@avie/geometry/terrain-pendant";
import { getPreset, pendantPreviewNumbers } from "@avie/product-types";
import { weld, type IndexedMesh } from "./mesh";
import { loadSavedTerrain, type Metal } from "./ring-source";

export const PENDANT_PRESET_ID = "pendant-round-classic";
export const PENDANT_PRODUCTION_RESOLUTION = { cols: 480, radial: 150, angular: 480, round: 8, bail: 96 } as const;
const PRESET_LENGTH_M: Record<string, number> = {
  "Snowdon, GB": 6000, "Ben Nevis, GB": 7000, "Matterhorn, CH": 6000, "Table Mountain, ZA": 8000,
  "Mount Fuji, JP": 20000, "Grand Canyon, US": 16000, "Lake District, GB": 18000
};

export type PendantConfiguration = {
  place: string;
  lengthM?: number; // ground distance across the diameter; defaults to the place's preset
  bearingDeg: number;
  terrainHeight: number;
  detail: Detail;
  metal: Metal;
  finish: "polished" | "satin";
};

export function buildProductionPendant(config: PendantConfiguration) {
  const preset = getPreset(PENDANT_PRESET_ID);
  if (preset.outline.shape !== "round" || preset.outline.diameterMm.value === null) throw new Error("The pendant prototype must be round with a diameter");
  const diameterMm = preset.outline.diameterMm.value;
  const preview = pendantPreviewNumbers();
  const lengthM = config.lengthM ?? PRESET_LENGTH_M[config.place] ?? 6000;
  const dims = { faceLengthMm: diameterMm, faceWidthMm: diameterMm, maxReliefMm: preview.maximumReliefMm };
  const { source } = loadSavedTerrain(config.place);
  const area = frameFor(lengthM, config.bearingDeg, dims);
  const R = PENDANT_PRODUCTION_RESOLUTION;
  const terrain = buildTerrain(source, area, dims, { terrainHeight: config.terrainHeight, detail: config.detail }, R.cols);
  const pendant = createRoundPendant({
    diameterMm,
    baseThicknessMm: preview.baseThicknessMm,
    edgeRoundMm: preview.edgeRoundMm,
    terrainFadeMm: preview.terrainFadeMm,
    terrain,
    bail: preview.bail,
    resolution: { radial: R.radial, angular: R.angular, round: R.round, bail: R.bail },
  });
  const body: IndexedMesh = weld({ positions: pendant.body.positions, indices: pendant.body.indices, surfaceLabels: pendant.body.surfaceLabels });
  const bail: IndexedMesh = weld({ positions: pendant.bail!.positions, indices: pendant.bail!.indices });
  return {
    preset,
    preview,
    diameterMm,
    lengthM,
    area,
    terrain,
    body,
    bail,
    assembly: pendant.assembly!,
    dimensions: pendantDimensions(pendant),
    elevations: { data: sampleFrame(source, area, R.cols, terrain.rows), cols: R.cols, rows: terrain.rows },
    densityGcm3: METAL_DENSITY_G_CM3[config.metal],
  };
}
