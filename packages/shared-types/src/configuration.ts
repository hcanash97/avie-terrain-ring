import { z } from "zod";
import {
  attachmentSchema,
  engravingSchema,
  faceShapeSchema,
  finiteSchema,
  finishSchema,
  identifierSchema,
  materialSchema,
  productIdSchema,
  sha256Schema,
  signatureSchema,
  versionSchema,
} from "./primitives";
const dimension = finiteSchema.positive().max(100);
const diameter = finiteSchema.min(12).max(26);
export const productSelectionSchema = z.discriminatedUnion("productType", [
  z.strictObject({
    productType: z.literal("terrain_ring"),
    options: z.strictObject({
      weight: z.enum(["slim", "standard", "bold"]),
      headShape: z.enum(["bar", "cushion"]),
      innerDiameterMm: diameter,
      shoulder: z.enum(["straight", "classic", "curved"]),
      profile: z.enum(["flat", "classic", "d_shape"]),
    }),
  }),
  z.strictObject({
    productType: z.literal("terrain_pendant"),
    options: z.strictObject({
      faceShape: z.enum(["round", "oval", "cushion", "hexagonal"]),
      widthMm: dimension,
      heightMm: dimension,
      chainLengthCm: z.union([z.literal(45), z.literal(50), z.literal(60)]),
      attachment: z.enum(["integrated_loop", "fixed_bail", "removable_bail"]),
    }),
  }),
  z.strictObject({
    productType: z.literal("terrain_signet"),
    options: z.strictObject({
      faceShape: z.enum(["oval", "cushion", "round", "shield"]),
      widthMm: dimension,
      heightMm: dimension,
      innerDiameterMm: diameter,
      bandWidthMm: finiteSchema.min(2).max(10),
    }),
  }),
]);
export const cropSchema = z.discriminatedUnion("policy", [
  z.strictObject({ policy: z.literal("preserve_area") }),
  z
    .strictObject({
      policy: z.literal("explicit_crop"),
      u0: finiteSchema.min(0).lt(1),
      v0: finiteSchema.min(0).lt(1),
      u1: finiteSchema.gt(0).max(1),
      v1: finiteSchema.gt(0).max(1),
    })
    .refine((p) => p.u0 < p.u1 && p.v0 < p.v1, {
      message: "Crop must have positive ordered area",
    }),
]);
export const configurationInputSchema = z.strictObject({
  selection: productSelectionSchema,
  material: materialSchema,
  finish: finishSchema,
  engraving: engravingSchema,
  crop: cropSchema,
});
export const mountSchema = z.strictObject({
  policyId: identifierSchema,
  version: versionSchema,
  faceShape: faceShapeSchema,
  widthMm: dimension,
  heightMm: dimension,
  /** Null where the manufacturer has not supplied a value. */
  substrateMm: dimension.nullable(),
  reliefLimitMm: finiteSchema.min(0).max(10).nullable(),
  crop: cropSchema,
  units: z.literal("mm"),
  axes: z.literal("X-right_Y-relief_Z-face"),
  edgeTreatment: z.enum(["integrated", "bordered", "signet_head"]),
  attachment: attachmentSchema,
});
export const configurationContentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  shopId: z.uuid(),
  ownerSessionId: z.uuid(),
  terrainDesignId: z.uuid(),
  terrainVersionId: z.uuid(),
  terrainVersion: versionSchema,
  terrainHash: sha256Schema,
  input: configurationInputSchema,
  mount: mountSchema,
  constraintProfileId: identifierSchema,
  constraintVersion: versionSchema,
  constraintHash: sha256Schema,
  geometryVersion: identifierSchema,
  geometryImplemented: z.boolean(),
});
export const configurationVersionSchema = z.strictObject({
  id: z.uuid(),
  configurationId: z.uuid(),
  version: versionSchema,
  content: configurationContentSchema,
  configurationHash: sha256Schema,
  createdAt: z.iso.datetime(),
  signature: signatureSchema.nullable(),
});
export const productReferenceSchema = z.strictObject({
  productType: productIdSchema,
  configurationId: z.uuid(),
  configurationVersion: versionSchema,
  configurationHash: sha256Schema,
});
export type ConfigurationInput = z.infer<typeof configurationInputSchema>;
export type ProductSelection = z.infer<typeof productSelectionSchema>;
export type ConfigurationContent = z.infer<typeof configurationContentSchema>;
export type ConfigurationVersion = z.infer<typeof configurationVersionSchema>;
