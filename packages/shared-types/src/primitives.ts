import { z } from "zod";
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const versionSchema = z.number().int().positive().max(2147483647);
export const finiteSchema = z.number().finite();
export const identifierSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9._/-]+$/);
export const productIdSchema = z.enum([
  "terrain_ring",
  "terrain_pendant",
  "terrain_signet",
  "terrain_cufflinks",
  "terrain_charm",
  "terrain_tie_bar",
  "terrain_bracelet",
  "terrain_locket",
  "terrain_object",
]);
export type ProductId = z.infer<typeof productIdSchema>;
export const materialSchema = z.enum([
  "silver_925",
  "gold_9ct",
  "gold_14ct",
  "gold_18ct",
  "platinum_950",
]);
export const finishSchema = z.enum(["polished", "satin"]);
export const faceShapeSchema = z.enum([
  "bar",
  "round",
  "oval",
  "cushion",
  "hexagonal",
  "shield",
  "rounded_square",
  "rectangular",
]);
export const attachmentSchema = z.enum([
  "none",
  "integrated_loop",
  "fixed_bail",
  "removable_bail",
  "paired_post",
  "clip",
  "bracelet_panel",
  "hinged_compartment",
  "base",
]);
export const engravingSchema = z.discriminatedUnion("enabled", [
  z.strictObject({ enabled: z.literal(false) }),
  z.strictObject({
    enabled: z.literal(true),
    text: z.string().trim().min(1).max(80),
    location: z.enum(["interior", "reverse"]),
    fontId: identifierSchema,
    depthMm: finiteSchema.positive().max(1),
  }),
]);
export const signatureSchema = z.strictObject({
  algorithm: z.literal("HMAC-SHA256"),
  keyId: identifierSchema,
  value: sha256Schema,
});
export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
