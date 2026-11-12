import { z } from "zod";
import {
  deepFreeze,
  productIdSchema,
  type ProductId,
} from "@avie/shared-types";
import { constraints } from "./constraints";
export const productTypeSchema = z.strictObject({
  id: productIdSchema,
  name: z.string(),
  description: z.string(),
  status: z.enum(["active", "planned", "future"]),
  previewAvailable: z.boolean(),
  purchasable: z.literal(false),
  geometryImplemented: z.boolean(),
  requiresSize: z.boolean(),
  supportsTerrainDesign: z.literal(true),
  supportsBandWidth: z.boolean(),
  mountPolicyId: z.string(),
  mountVersion: z.literal(1),
  optionSchemaId: z.string(),
  supportsChain: z.boolean(),
  engravingIntent: z.enum(["interior", "reverse", "optional"]),
  engravingImplemented: z.literal(false),
  supportsMultipleLocations: z.literal(false),
  complexity: z.enum(["low_medium", "medium", "medium_high", "high"]),
  constraintProfileId: z.string(),
  pricingRuleId: z.string(),
  exportProfile: z.literal("mesh-review-only"),
  qc: z.array(z.string()).min(1),
  shopifyMapping: z.null(),
});
const names = [
  "Ring",
  "Pendant",
  "Signet",
  "Cufflinks",
  "Charm",
  "Tie Bar",
  "Bracelet",
  "Locket",
  "Object",
];
const descriptions = [
  "Existing integrated terrain signet",
  "Terrain relief in a pendant body with a chain attachment",
  "Planned distinct signet head; form to be approved",
  "Paired terrain jewellery; no geometry yet",
  "Small terrain piece with an attachment",
  "Terrain panel with a tie clip",
  "Terrain panel with wrist sizing",
  "Terrain face with a compartment",
  "Terrain sculpture on a base",
];
export const productTypes = deepFreeze(
  Object.fromEntries(
    productIdSchema.options.map((id, i) => [
      id,
      productTypeSchema.parse({
        id,
        name: `À Vie Terra ${names[i]}`,
        description: descriptions[i],
        status: i === 0 ? "active" : i < 3 ? "planned" : "future",
        previewAvailable: i === 0,
        purchasable: false,
        geometryImplemented: i === 0,
        requiresSize: [0, 2, 6].includes(i),
        supportsTerrainDesign: true,
        supportsBandWidth: [0, 2].includes(i),
        mountPolicyId:
          i === 0
            ? "legacy-integrated-ring"
            : i === 1
              ? "pendant-contained-candidate"
              : i === 2
                ? "distinct-signet-candidate"
                : "unimplemented",
        mountVersion: 1,
        optionSchemaId: `${id}/options-v1`,
        supportsChain: [1, 4, 7].includes(i),
        engravingIntent:
          i === 0 || i === 2 ? "interior" : i === 8 ? "optional" : "reverse",
        engravingImplemented: false,
        supportsMultipleLocations: false,
        complexity:
          i === 7
            ? "high"
            : i >= 6
              ? "medium_high"
              : i === 1 || i === 4 || i === 5
                ? "low_medium"
                : "medium",
        constraintProfileId: constraints[id].id,
        pricingRuleId: `${id}-uncosted`,
        exportProfile: "mesh-review-only",
        qc: [
          "closed_manifold",
          "outward_normals",
          "self_intersections",
          "global_wall_thickness",
          "feature_width",
          "dimensions",
          "relief",
          "volume",
          "estimated_mass",
          "units_scale_orientation",
          ...(i === 1
            ? [
                "attachment_aperture",
                "attachment_strength",
                "engraving_clearance",
              ]
            : ["terrain_boundary"]),
        ],
        shopifyMapping: null,
      }),
    ]),
  ) as Record<ProductId, z.infer<typeof productTypeSchema>>,
);
export function getProductType(id: unknown) {
  return productTypes[productIdSchema.parse(id)];
}
