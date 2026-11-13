import { facePreset } from "@avie/geometry/terrain-ring";
import { configurationInputSchema, mountSchema } from "@avie/shared-types";
/** Resolves data only: this does not create geometry or validate global thickness. */
export function resolveMount(input: unknown) {
  const c = configurationInputSchema.parse(input),
    s = c.selection;
  if (s.productType === "terrain_ring") {
    // Read from the geometry presets (single source of truth), never a copied table.
    const preset = facePreset(s.options.weight, s.options.headShape);
    return mountSchema.parse({
      policyId: "legacy-integrated-ring",
      version: 1,
      faceShape: s.options.headShape,
      heightMm: preset.faceLengthMm,
      widthMm: preset.faceWidthMm,
      substrateMm: preset.headHeightMm,
      reliefLimitMm: preset.maxReliefMm,
      crop: c.crop,
      units: "mm",
      axes: "X-right_Y-relief_Z-face",
      edgeTreatment: "integrated",
      attachment: "none",
    });
  }
  const o = s.options;
  return mountSchema.parse({
    policyId:
      s.productType === "terrain_pendant"
        ? "pendant-contained-candidate"
        : "distinct-signet-candidate",
    version: 1,
    faceShape: o.faceShape,
    widthMm: o.widthMm,
    heightMm: o.heightMm,
    // Unknown until the manufacturer supplies them; never invented here.
    substrateMm: null,
    reliefLimitMm: null,
    crop: c.crop,
    units: "mm",
    axes: "X-right_Y-relief_Z-face",
    edgeTreatment:
      s.productType === "terrain_pendant" ? "bordered" : "signet_head",
    attachment:
      s.productType === "terrain_pendant" ? s.options.attachment : "none",
  });
}
