/**
 * Development-only values that let a prototype render before the manufacturer
 * has supplied real requirements. Every value is preview_only: shown in the
 * preview and the report, and never eligible for production (checkout and
 * manufacturing release read only `manufacturing` requirements, which stay
 * unapproved).
 */
import { spec, type SpecValue } from "@avie/shared-types";

const SOURCE = "Proposed by the coding agent; preview use approved by À Vie on 13 Nov 2026 (not a manufacturing value)";

export const PENDANT_PREVIEW_PROFILE = Object.freeze({
  id: "pendant-preview-dev-1",
  appliesTo: ["pendant-round-classic"] as readonly string[],
  values: {
    baseThicknessMm: spec.previewOnly(1.0, SOURCE, "Body below the terrain baseline."),
    maximumReliefMm: spec.previewOnly(1.5, SOURCE, "Terrain at 100% height."),
    edgeRoundMm: spec.previewOnly(0.3, SOURCE, "Front and back edge rounds."),
    terrainFadeMm: spec.previewOnly(1.0, SOURCE, "Band inside the edge round over which terrain eases to the plain face."),
    bailOpeningHeightMm: spec.previewOnly(3.0, SOURCE, "Integrated loop clear opening, vertical."),
    bailOpeningDepthMm: spec.previewOnly(2.0, SOURCE, "Integrated loop clear opening, front to back."),
    bailWallMm: spec.previewOnly(1.0, SOURCE, "Loop section diameter."),
    bailEmbedMm: spec.previewOnly(0.6, SOURCE, "How far the loop reaches into the rim. Visual overlap only; not a joint."),
  } satisfies Record<string, SpecValue<number>>,
});

/** Plain numbers for the generator, refusing anything that is not preview-only. */
export function pendantPreviewNumbers() {
  const v = PENDANT_PREVIEW_PROFILE.values;
  for (const [k, s] of Object.entries(v)) if (s.status !== "preview_only" || s.value === null) throw new Error(`${k} is not a preview-only value`);
  return {
    profileId: PENDANT_PREVIEW_PROFILE.id,
    baseThicknessMm: v.baseThicknessMm.value!,
    maximumReliefMm: v.maximumReliefMm.value!,
    edgeRoundMm: v.edgeRoundMm.value!,
    terrainFadeMm: v.terrainFadeMm.value!,
    bail: { openingHeightMm: v.bailOpeningHeightMm.value!, openingDepthMm: v.bailOpeningDepthMm.value!, wallMm: v.bailWallMm.value!, embedMm: v.bailEmbedMm.value! },
  };
}
