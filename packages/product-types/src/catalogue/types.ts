/**
 * Catalogue presets: proposed shapes and sizes with explicit provenance.
 *
 * Coordinate and measurement conventions (all products, millimetres):
 *   - Body width / height: maximum extent of the jewellery body, excluding
 *     attachments. Diameter for circles. Hexagons are measured across flats.
 *   - Overall dimensions include attachments and are reported by the generator.
 *   - Base thickness: body below the terrain baseline. Terrain relief: height
 *     above that baseline. Overall depth: front to back including relief.
 *   - Flat products (right-handed, the piece lying face-up): origin at the
 *     body centre on the back plane, +Y the relief direction, +X right seen
 *     from the front with the attachment at the top, attachment towards −Z.
 *     Terrain north points towards the attachment. Rings keep their existing
 *     convention (ring axis = Z, relief +Y).
 *
 * A preset in this catalogue is NOT a launch decision. What a preset may be
 * used for is decided by `availabilityOf`, from the explicit enabled list plus
 * the approvals recorded here.
 */
import { z } from "zod";
import { productIdSchema, specNumberSchema, specTextSchema, type SpecValue } from "@avie/shared-types";

export const familySchema = z.enum([
  "ring",
  "pendant",
  "charm",
  "stud_earrings",
  "drop_earrings",
  "chain_bracelet",
  "cuff_bangle",
  "locket",
  "cufflinks",
  "brooch",
  "lapel_pin",
  "tie_slide",
]);
export type Family = z.infer<typeof familySchema>;

export const statusSchema = z.strictObject({
  design: z.enum(["proposed", "reviewed", "approved"]),
  implementation: z.enum(["planned", "prototype", "implemented"]),
  manufacturing: z.enum(["unassessed", "review_required", "approved", "rejected"]),
  storefront: z.enum(["hidden", "enquiry_only", "purchasable"]),
});
export type PresetStatus = z.infer<typeof statusSchema>;

/** Body outline. Shapes are distinct: a rounded rectangle is not silently a true cushion. */
export const outlineSchema = z.discriminatedUnion("shape", [
  z.strictObject({ shape: z.literal("round"), diameterMm: specNumberSchema }),
  z.strictObject({ shape: z.literal("oval"), widthMm: specNumberSchema, heightMm: specNumberSchema }),
  z.strictObject({
    shape: z.literal("cushion"),
    widthMm: specNumberSchema,
    heightMm: specNumberSchema,
    cornerRadiusMm: specNumberSchema,
    outlineMethod: specTextSchema, // e.g. rounded rectangle now; a true cushion curve later
  }),
  z.strictObject({ shape: z.literal("tablet"), widthMm: specNumberSchema, heightMm: specNumberSchema, cornerTreatment: specTextSchema }),
  z.strictObject({ shape: z.literal("rectangle"), widthMm: specNumberSchema, heightMm: specNumberSchema, cornerRadiusMm: specNumberSchema }),
  z.strictObject({ shape: z.literal("hexagon"), acrossFlatsMm: specNumberSchema, orientation: specTextSchema }),
]);
export type Outline = z.infer<typeof outlineSchema>;

/** A variant (attachment, treatment, construction…) and whether it is built. */
export const variantSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  implementation: z.enum(["planned", "prototype", "implemented", "future"]),
  note: z.string().min(1).nullable(),
});
export type Variant = z.infer<typeof variantSchema>;

const specs = z.record(z.string(), z.union([specNumberSchema, specTextSchema]));

export const presetSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  family: familySchema,
  /** Link to the product-type registry and database enum; null until the family is registered there. */
  productId: productIdSchema.nullable(),
  label: z.string().min(1),
  sizeTier: z.string().min(1),
  status: statusSchema,
  outline: outlineSchema,
  /** Other design dimensions and choices (band, head, terrain window, fit…). */
  design: specs,
  /** Requirements a production process may rely on only once approved. */
  manufacturing: specs,
  /** Supplied findings and components (chains, posts, mechanisms…). */
  components: specs,
  variants: z.array(variantSchema),
  notes: z.array(z.string().min(1)),
});
export type Preset = z.infer<typeof presetSchema>;

export type Spec = SpecValue<number> | SpecValue<string>;
