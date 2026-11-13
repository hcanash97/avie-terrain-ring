import { z } from "zod";
import { finiteSchema, finishSchema, materialSchema, versionSchema } from "./primitives";
import { spec, specNumberSchema, specTextSchema } from "./spec";

/** Internal prototype contract. The legacy saved-product contract remains readable. */
export const pendantStyleIdSchema = z.enum(["tablet_slider", "cushion_tab", "round_slider", "round_loop"]);
export type PendantStyleId = z.infer<typeof pendantStyleIdSchema>;
export const pendantCoverageSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("full") }),
  z.strictObject({ mode: z.literal("above_level"), level: finiteSchema.min(0).lt(1) }),
]);
export const pendantPrototypeSelectionSchema = z.strictObject({
  productType: z.literal("terrain_pendant"),
  contractVersion: z.literal(1),
  configurationVersion: versionSchema,
  presetId: z.string().regex(/^pendant-(round|tablet|cushion)-(petite|classic|statement)$/),
  style: pendantStyleIdSchema,
});
export const pendantPrototypeConfigurationSchema = z.strictObject({
  presetId: pendantPrototypeSelectionSchema.shape.presetId.default("pendant-round-classic"),
  style: pendantStyleIdSchema.default("round_slider"),
  configurationVersion: versionSchema.default(1),
  coverage: pendantCoverageSchema.optional(),
  place: z.string().trim().min(1).max(120),
  lengthM: finiteSchema.positive().max(1000000).optional(),
  bearingDeg: finiteSchema.min(-360).max(360),
  terrainHeight: finiteSchema.min(0).max(1),
  detail: z.enum(["low", "medium", "high"]),
  metal: materialSchema,
  finish: finishSchema,
});

/** Supplier facts stay unknown; nominal wire diameter does not establish fit. */
export const pendantChainSpecificationSchema = z.strictObject({
  chainSku: specTextSchema,
  chainSectionMm: specNumberSchema,
  largestEndFittingWidthMm: specNumberSchema,
  largestEndFittingHeightMm: specNumberSchema,
  assemblyRoute: specTextSchema,
  clearanceAllowanceMm: specNumberSchema,
});
export const unknownPendantChainSpecification = () => pendantChainSpecificationSchema.parse({
  chainSku: spec.awaitingSupplier("Approved supplied chain SKU."),
  chainSectionMm: spec.awaitingSupplier("Chain cross-section and orientation."),
  largestEndFittingWidthMm: spec.awaitingSupplier("Largest fitting that must pass through the attachment."),
  largestEndFittingHeightMm: spec.awaitingSupplier("Largest fitting that must pass through the attachment."),
  assemblyRoute: spec.awaitingSupplier("Threading orientation and assembly route, including clasp and connectors."),
  clearanceAllowanceMm: spec.awaitingManufacturer("Clearance required around the chosen chain and fittings."),
});

/**
 * Charm prototype contract: a small terrain piece on a fixed loop that lies in
 * the plane of the face, for a jump ring or clasp. Internal preview only.
 */
export const charmStyleIdSchema = z.enum(["round_charm", "cushion_charm", "tablet_charm"]);
export type CharmStyleId = z.infer<typeof charmStyleIdSchema>;
export const charmPrototypeSelectionSchema = z.strictObject({
  productType: z.literal("terrain_charm"),
  contractVersion: z.literal(1),
  configurationVersion: versionSchema,
  presetId: z.string().regex(/^charm-(round|tablet|cushion)-(petite|classic|larger)$/),
  style: charmStyleIdSchema,
});
