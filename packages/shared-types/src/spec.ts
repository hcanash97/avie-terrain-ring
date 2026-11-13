import { z } from "zod";

/**
 * A single specification value with its provenance. Unknown requirements stay
 * null with an owner; they never become numbers by default.
 *
 * status:
 *   proposed              a design candidate (for example a size tier), not approved
 *   preview_only          a temporary value that lets a preview render; never production
 *   awaiting_design       a design decision À Vie has not made yet
 *   awaiting_manufacturer a manufacturing requirement the maker has not supplied
 *   awaiting_supplier     a finding, chain, mechanism or setting not yet chosen or specified
 *   approved              agreed by a named person, with a source
 *   not_applicable        does not apply to this preset (for example a circle's corner radius)
 */
export const specStatusSchema = z.enum([
  "proposed",
  "preview_only",
  "awaiting_design",
  "awaiting_manufacturer",
  "awaiting_supplier",
  "approved",
  "not_applicable",
]);
export type SpecStatus = z.infer<typeof specStatusSchema>;

/** Who decides a value. */
export const specOwnerSchema = z.enum(["avie", "coding_agent", "manufacturer", "supplier_or_setter"]);
export type SpecOwner = z.infer<typeof specOwnerSchema>;

const AWAITING = ["awaiting_design", "awaiting_manufacturer", "awaiting_supplier", "not_applicable"] as const;

export function specValueSchema<T extends z.ZodType>(value: T) {
  return z
    .strictObject({
      value: value.nullable(),
      status: specStatusSchema,
      owner: specOwnerSchema,
      source: z.string().min(1).nullable(),
      approvedBy: z.string().min(1).nullable(),
      note: z.string().min(1).nullable(),
    })
    .superRefine((s, ctx) => {
      // Generic inference loses `value` here; read it untyped (the shape is validated above).
      const value = (s as unknown as { value: unknown }).value;
      const issue = (message: string) => ctx.addIssue({ code: "custom", message });
      if ((AWAITING as readonly string[]).includes(s.status) && value !== null)
        issue(`A value that is ${s.status} must be null`);
      if (s.status === "approved" && (value === null || !s.approvedBy || !s.source))
        issue("An approved value needs a value, a source and who approved it");
      if (s.status !== "approved" && s.approvedBy !== null) issue("Only approved values may name an approver");
      if ((s.status === "proposed" || s.status === "preview_only") && (value === null || !s.source))
        issue(`A ${s.status} value needs a value and a source`);
      if (s.status === "awaiting_design" && s.owner !== "avie") issue("Design decisions are owned by À Vie");
      if (s.status === "awaiting_manufacturer" && s.owner !== "manufacturer") issue("Manufacturing requirements are owned by the manufacturer");
      if (s.status === "awaiting_supplier" && s.owner !== "supplier_or_setter") issue("Findings and settings are owned by the supplier or setter");
    });
}
export const specNumberSchema = specValueSchema(z.number().finite());
export const specTextSchema = specValueSchema(z.string().min(1));
export type SpecValue<T> = {
  value: T | null;
  status: SpecStatus;
  owner: SpecOwner;
  source: string | null;
  approvedBy: string | null;
  note: string | null;
};

/** Builders, so catalogue data reads plainly and cannot mislabel its provenance. */
export const spec = {
  proposed: <T>(value: T, source: string, note: string | null = null): SpecValue<T> => ({ value, status: "proposed", owner: "avie", source, approvedBy: null, note }),
  previewOnly: <T>(value: T, source: string, note: string | null = null): SpecValue<T> => ({ value, status: "preview_only", owner: "coding_agent", source, approvedBy: null, note }),
  awaitingDesign: <T>(note: string): SpecValue<T> => ({ value: null, status: "awaiting_design", owner: "avie", source: null, approvedBy: null, note }),
  awaitingManufacturer: <T>(note: string): SpecValue<T> => ({ value: null, status: "awaiting_manufacturer", owner: "manufacturer", source: null, approvedBy: null, note }),
  awaitingSupplier: <T>(note: string): SpecValue<T> => ({ value: null, status: "awaiting_supplier", owner: "supplier_or_setter", source: null, approvedBy: null, note }),
  notApplicable: <T>(note: string): SpecValue<T> => ({ value: null, status: "not_applicable", owner: "coding_agent", source: null, approvedBy: null, note }),
};

/** True only for values a production process may rely on. */
export const isApproved = (s: SpecValue<unknown>) => s.status === "approved" && s.value !== null;
