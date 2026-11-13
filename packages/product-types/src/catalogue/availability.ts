/**
 * What a preset may be used for. A registry entry is not a launch decision:
 * nothing is available unless it is listed in ENABLED_PRESETS, and even then
 * checkout and manufacturing release also need recorded approvals.
 */
import { isApproved } from "@avie/shared-types";
import type { Preset } from "./types";

export type Availability = {
  prototype: boolean;
  internalPreview: boolean;
  customerEnquiry: boolean;
  checkout: boolean;
  manufacturingRelease: boolean;
};
const NONE: Availability = { prototype: false, internalPreview: false, customerEnquiry: false, checkout: false, manufacturingRelease: false };

/** The explicit list. Anything not here is unavailable for every purpose. */
export const ENABLED_PRESETS: Readonly<Record<string, Partial<Availability>>> = Object.freeze({
  // Existing ring: shown publicly for enquiries ("contact us" / quote), never checkout.
  "ring-bar-slim": { prototype: true, internalPreview: true, customerEnquiry: true },
  "ring-bar-standard": { prototype: true, internalPreview: true, customerEnquiry: true },
  "ring-bar-bold": { prototype: true, internalPreview: true, customerEnquiry: true },
  "ring-cushion-slim": { prototype: true, internalPreview: true, customerEnquiry: true },
  "ring-cushion-standard": { prototype: true, internalPreview: true, customerEnquiry: true },
  "ring-cushion-bold": { prototype: true, internalPreview: true, customerEnquiry: true },
  // Pendant style prototypes (circle, block, charm) in every size: internal
  // preview only, built with preview-only style profiles.
  ...Object.fromEntries(
    ["round", "tablet", "cushion"].flatMap((shape) =>
      ["petite", "classic", "statement"].map((tier) => [`pendant-${shape}-${tier}`, { prototype: true, internalPreview: true }]),
    ),
  ),
});

/** Why a requested use is not allowed; empty when allowed. */
export function availabilityOf(preset: Preset, enabled: Readonly<Record<string, Partial<Availability>>> = ENABLED_PRESETS) {
  const listed = { ...NONE, ...(enabled[preset.id] ?? {}) };
  const blockedBy: Record<keyof Availability, string[]> = { prototype: [], internalPreview: [], customerEnquiry: [], checkout: [], manufacturingRelease: [] };
  const unapproved = Object.entries(preset.manufacturing)
    .filter(([, v]) => !isApproved(v))
    .map(([k]) => k);
  for (const key of Object.keys(blockedBy) as (keyof Availability)[])
    if (!(preset.id in enabled) || !listed[key]) blockedBy[key].push("not enabled for this use");
  if (preset.status.implementation === "planned") blockedBy.internalPreview.push("no geometry implemented");
  if (preset.status.storefront === "hidden") blockedBy.customerEnquiry.push("hidden from the storefront");
  for (const key of ["checkout", "manufacturingRelease"] as const) {
    if (preset.status.manufacturing !== "approved") blockedBy[key].push(`manufacturing status is ${preset.status.manufacturing}`);
    if (unapproved.length) blockedBy[key].push(`unapproved manufacturing requirements: ${unapproved.join(", ")}`);
  }
  if (preset.status.storefront !== "purchasable") blockedBy.checkout.push(`storefront status is ${preset.status.storefront}`);
  const allowed = Object.fromEntries(Object.entries(blockedBy).map(([k, v]) => [k, v.length === 0])) as Availability;
  return { allowed, blockedBy };
}
