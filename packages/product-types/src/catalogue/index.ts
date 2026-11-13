import { z } from "zod";
import { familyPresets } from "./families";
import { ringPresets } from "./ring";
import { presetSchema, type Preset } from "./types";

export * from "./types";
export * from "./availability";
export * from "./gemstones";
export * from "./preview-profiles";
export { RING_SIZING, RING_STYLES, RING_SHOULDERS, RING_INNER_PROFILES } from "./ring";
export { PROPOSED_SOURCE } from "./build";

/**
 * Registry entries the catalogue deliberately excludes. "terrain_object" (a
 * terrain sculpture on a base) falls outside À Vie fine jewellery; it stays in
 * the database enum so no record is broken, but no preset maps to it.
 */
export const RETIRED_PRODUCT_IDS = ["terrain_object"] as const;

/** Every preset, validated. Signet heads are future ring styles (see RING_STYLES), not a separate family here. */
export const CATALOGUE: readonly Preset[] = Object.freeze(z.array(presetSchema).parse([...ringPresets, ...familyPresets]));

export function getPreset(id: string): Preset {
  const p = CATALOGUE.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown catalogue preset "${id}"`);
  return p;
}
