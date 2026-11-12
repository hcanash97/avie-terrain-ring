import { z } from "zod";
import {
  attachmentSchema,
  deepFreeze,
  faceShapeSchema,
  finiteSchema,
  finishSchema,
  identifierSchema,
  materialSchema,
  productIdSchema,
  versionSchema,
} from "@avie/shared-types";
const positive = finiteSchema.positive();
export const constraintProfileSchema = z
  .strictObject({
    id: identifierSchema,
    version: versionSchema,
    productType: productIdSchema,
    approval: z.literal("provisional"),
    minWidthMm: positive.nullable(),
    maxWidthMm: positive.nullable(),
    minHeightMm: positive.nullable(),
    maxHeightMm: positive.nullable(),
    minWallMm: positive.nullable(),
    minFeatureMm: positive.nullable(),
    maxReliefMm: positive.nullable(),
    maxVolumeCm3: positive.nullable(),
    maxTerrainExtentM: positive.nullable(),
    materials: z.array(materialSchema).min(1),
    finishes: z.array(finishSchema).min(1),
    shapes: z.array(faceShapeSchema).min(1),
    attachments: z.array(attachmentSchema).min(1),
  })
  .refine(
    (p) =>
      (p.minWidthMm === null ||
        p.maxWidthMm === null ||
        p.minWidthMm <= p.maxWidthMm) &&
      (p.minHeightMm === null ||
        p.maxHeightMm === null ||
        p.minHeightMm <= p.maxHeightMm),
    { message: "Invalid dimension interval" },
  );
const materials = materialSchema.options,
  finishes = finishSchema.options;
function profile(
  id: string,
  productType: z.infer<typeof productIdSchema>,
  limits: Partial<z.input<typeof constraintProfileSchema>>,
) {
  return constraintProfileSchema.parse({
    id,
    version: 1,
    productType,
    approval: "provisional",
    minWidthMm: null,
    maxWidthMm: null,
    minHeightMm: null,
    maxHeightMm: null,
    minWallMm: null,
    minFeatureMm: null,
    maxReliefMm: null,
    maxVolumeCm3: null,
    maxTerrainExtentM: null,
    materials,
    finishes,
    shapes: ["cushion"],
    attachments: ["none"],
    ...limits,
  });
}
export const constraints = deepFreeze({
  legacyRing: profile("legacy-ring-preview", "terrain_ring", {
    minWidthMm: 5.5,
    maxWidthMm: 13,
    minHeightMm: 10.5,
    maxHeightMm: 14,
    maxReliefMm: 2.8,
    shapes: ["bar", "cushion"],
  }),
  terrain_ring: profile("ring-candidate", "terrain_ring", {
    minWidthMm: 12,
    maxWidthMm: 20,
    minHeightMm: 12,
    maxHeightMm: 20,
    minWallMm: 1.8,
    minFeatureMm: 0.6,
    maxReliefMm: 3.5,
    shapes: ["cushion", "rounded_square"],
  }),
  terrain_pendant: profile("pendant-candidate", "terrain_pendant", {
    minWidthMm: 14,
    maxWidthMm: 22,
    minHeightMm: 14,
    maxHeightMm: 22,
    minWallMm: 1.4,
    minFeatureMm: 0.6,
    maxReliefMm: 2.5,
    shapes: ["round", "oval", "cushion", "hexagonal"],
    attachments: ["integrated_loop", "fixed_bail", "removable_bail"],
  }),
  terrain_signet: profile("signet-candidate", "terrain_signet", {
    minWidthMm: 14,
    maxWidthMm: 20,
    minHeightMm: 14,
    maxHeightMm: 20,
    minWallMm: 1.8,
    minFeatureMm: 0.6,
    maxReliefMm: 3,
    shapes: ["oval", "cushion", "round", "shield"],
  }),
  terrain_cufflinks: profile("cufflinks-candidate", "terrain_cufflinks", {
    attachments: ["paired_post"],
  }),
  terrain_charm: profile("charm-candidate", "terrain_charm", {
    attachments: ["integrated_loop", "removable_bail"],
    shapes: ["round", "cushion"],
  }),
  terrain_tie_bar: profile("tie-bar-candidate", "terrain_tie_bar", {
    attachments: ["clip"],
    shapes: ["rectangular"],
  }),
  terrain_bracelet: profile("bracelet-candidate", "terrain_bracelet", {
    attachments: ["bracelet_panel"],
  }),
  terrain_locket: profile("locket-candidate", "terrain_locket", {
    attachments: ["hinged_compartment"],
    shapes: ["oval", "round"],
  }),
  terrain_object: profile("object-candidate", "terrain_object", {
    attachments: ["base"],
    shapes: ["rectangular", "round"],
  }),
});
