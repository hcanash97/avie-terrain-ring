import { z } from "zod";
import { finiteSchema, productIdSchema } from "./primitives";
export const checkSchema = z.strictObject({
  code: z.string().min(1),
  outcome: z.enum(["pass", "fail", "not_run", "not_applicable"]),
  message: z.string().min(1),
  measured: finiteSchema.nullable(),
  required: finiteSchema.nullable(),
  method: z.string().nullable(),
});
export const requiredValidationChecks = [
  "watertight",
  "manifold",
  "normals",
  "self_intersections",
  "wall_thickness",
  "feature_size",
  "relief",
  "volume",
  "dimensions",
  "units_scale_orientation",
  "manufacturer_approval",
  "terrain_boundary",
] as const;
export const validationReportSchema = z
  .strictObject({
    productType: productIdSchema,
    status: z.enum(["held_for_review", "rejected", "validated"]),
    checks: z.array(checkSchema),
  })
  .superRefine((r, c) => {
    if (new Set(r.checks.map((x) => x.code)).size !== r.checks.length)
      c.addIssue({ code: "custom", message: "Duplicate check codes" });
    if (
      r.status === "validated" &&
      ([
        ...requiredValidationChecks,
        ...(r.productType === "terrain_pendant"
          ? [
              "attachment_aperture",
              "attachment_strength",
              "engraving_clearance",
            ]
          : []),
      ].some(
        (code) =>
          !r.checks.some((x) => x.code === code && x.outcome === "pass"),
      ) ||
        r.checks.some((x) => x.outcome === "fail" || x.outcome === "not_run"))
    )
      c.addIssue({
        code: "custom",
        message: "Unknown or failed checks cannot establish validation",
      });
  });
export type ValidationCheck = z.infer<typeof checkSchema>;
