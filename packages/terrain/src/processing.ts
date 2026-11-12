/**
 * Raw frame elevations + customer settings → the 0..1 grid the ring displaces.
 * Pure, so it is unit-tested and can run unchanged on the production worker.
 *
 * RELIEF SEMANTICS (what the "Terrain height" slider means)
 *   reliefMm = min(terrainHeight × style.maxReliefMm, MAX_EXAGGERATION × trueScaleMm)
 *   - terrainHeight (5–100%) is a share of the style's maximum relief, so every
 *     place can be made to read on the ring.
 *   - trueScaleMm is the relief a 1:1 scale model of this frame would have.
 *     Capping at MAX_EXAGGERATION × true scale stops nearly flat ground (where the
 *     data range is mostly noise) being stretched into dramatic fake topography.
 *   - Before that, ELEVATION_NOISE_M is subtracted from the range: global
 *     elevation data has roughly 2–4 m of vertical error, so differences that
 *     small are treated as flat rather than amplified.
 *   - The UI shows the resulting exaggeration (reliefMm ÷ trueScaleMm).
 *
 * DETAIL is defined in millimetres on the finished ring, because what survives
 * casting and hand polishing depends on physical feature size, not data pixels.
 */
import {
  edgeAwareBlur,
  blur,
  minMax,
  normalise,
  sampleFrame,
  type FrameArea,
  type TerrainSource,
} from "./heightmap";
import type { TerrainRelief, TerrainMountDimensions } from "./types";

/** Preserved processing rules extracted from the Terra ring engine. */
export const TERRAIN_ALGORITHM_VERSION = "terrain/v1";

export type Detail = "low" | "medium" | "high";

/** Smallest feature kept (Gaussian sigma, mm on the ring) and gentle crispening. */
export const DETAIL: Record<Detail, { smoothMm: number; sharpen: number }> = {
  low: { smoothMm: 0.16, sharpen: 0 },
  medium: { smoothMm: 0.08, sharpen: 0 },
  high: { smoothMm: 0.04, sharpen: 0 }, // sharpening off: see review of 12 Nov; compare 0.02/0.04/0.06
};
/** Scale of features the crispening acts on (mm on the ring). */
const SHARPEN_RADIUS_MM = 0.3;
/** Never exaggerate more than this many times true scale. */
export const MAX_EXAGGERATION = 30;
/** Vertical error typical of global elevation data (SRTM-class); ranges below this are noise. */
export const ELEVATION_NOISE_M = 3;

export type ProcessedTerrain = TerrainRelief & {
  rangeM: number;
  trueScaleMm: number;
  /** Vertical exaggeration vs. a true-scale model at this face size. */
  exaggeration: number;
};

export function frameFor(
  lengthM: number,
  bearingDeg: number,
  weight: TerrainMountDimensions,
): FrameArea {
  return {
    lengthM,
    widthM: (lengthM * weight.faceWidthMm) / weight.faceLengthMm,
    bearingDeg,
  };
}

export function reliefFor(
  rangeM: number,
  lengthM: number,
  weight: TerrainMountDimensions,
  terrainHeight: number,
) {
  const trueScaleMm =
    lengthM > 0 ? rangeM * (weight.faceLengthMm / lengthM) : 0;
  const signalScaleMm =
    lengthM > 0
      ? Math.max(0, rangeM - ELEVATION_NOISE_M) *
        (weight.faceLengthMm / lengthM)
      : 0;
  const reliefMm = Math.min(
    weight.maxReliefMm * terrainHeight,
    MAX_EXAGGERATION * signalScaleMm,
  );
  return {
    trueScaleMm,
    reliefMm,
    exaggeration: trueScaleMm > 0 ? reliefMm / trueScaleMm : 0,
  };
}

export function buildTerrain(
  source: TerrainSource,
  area: FrameArea,
  weight: TerrainMountDimensions,
  settings: { terrainHeight: number; detail: Detail },
  cols: number,
): ProcessedTerrain {
  const rows = Math.max(
    8,
    Math.round((cols * weight.faceWidthMm) / weight.faceLengthMm),
  );
  const mmPerCell = weight.faceLengthMm / (cols - 1);
  // Clamp below sea level to 0 m so bathymetry doesn't carve coastlines.
  const raw = sampleFrame(source, area, cols, rows).map((v) => Math.max(0, v));
  const [min, max] = minMax(raw);
  const rangeM = max - min;

  const { smoothMm, sharpen } = DETAIL[settings.detail];
  let shaped =
    settings.detail === "high"
      ? edgeAwareBlur(raw, cols, rows, smoothMm / mmPerCell)
      : blur(raw, cols, rows, smoothMm / mmPerCell);
  if (sharpen > 0) {
    const base = blur(raw, cols, rows, SHARPEN_RADIUS_MM / mmPerCell);
    shaped = shaped.map((v, i) => v + (v - base[i]!) * sharpen);
  }

  const relief = reliefFor(
    rangeM,
    area.lengthM,
    weight,
    settings.terrainHeight,
  );
  return { data: normalise(shaped), cols, rows, rangeM, ...relief };
}
