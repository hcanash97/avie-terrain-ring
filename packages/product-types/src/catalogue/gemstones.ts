/**
 * Gemstone treatments are registered design ideas only. A visual stone is not a
 * setting: every setting dimension comes from the setter, and validation rejects
 * any configuration that asks for a stone today.
 */
import type { SpecValue } from "@avie/shared-types";
import { maker, supplier, variant } from "./build";
import type { Variant } from "./types";

export const GEMSTONE_TREATMENTS: Variant[] = [
  variant("single-accent-diamond", "Single accent diamond", "future"),
  variant("single-coloured-gemstone", "Single coloured gemstone", "future"),
  variant("plain-frame-one-stone", "Plain frame with one set stone", "future"),
  variant("diamond-set-surround", "Diamond-set surround", "future"),
  variant("diamond-stud-terrain-drop", "Diamond stud with suspended terrain drop", "future"),
];

/** What a gemstone option must specify before it can exist. All unresolved. */
export const GEMSTONE_REQUIREMENTS: Record<string, SpecValue<number> | SpecValue<string>> = {
  stoneType: supplier("Stone type."),
  stoneShape: supplier("Stone shape."),
  actualStoneDimensions: supplier("Measured stone dimensions (not a marketing size such as '1 mm diamond')."),
  settingStyle: supplier("Setting style."),
  settingComponentOrGeometryId: supplier("Setting component or approved geometry."),
  seatDepthMm: supplier("Seat depth."),
  bearingGeometry: supplier("Bearing geometry."),
  prongDimensions: supplier("Prong dimensions."),
  bezelThicknessMm: supplier("Bezel thickness."),
  stoneClearancesMm: supplier("Stone clearances."),
  minimumMetalBelowSeatMm: maker("Minimum metal below the seat."),
  settingSpacingMm: supplier("Setting spacing."),
};

/** Rejects every gemstone request until setting geometry and setter requirements are approved. */
export function assertGemstoneSupported(treatmentId: string): never {
  const known = GEMSTONE_TREATMENTS.some((t) => t.id === treatmentId);
  throw new Error(
    known
      ? `Gemstone treatment "${treatmentId}" is not available: setting geometry and setter requirements are not approved.`
      : `Unknown gemstone treatment "${treatmentId}".`,
  );
}
