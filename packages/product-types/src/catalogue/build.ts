/** Small builders so catalogue data stays readable and its provenance consistent. */
import { spec, type SpecValue } from "@avie/shared-types";
import type { Outline, PresetStatus, Variant } from "./types";

export const PROPOSED_SOURCE = "À Vie prototype catalogue, 13 Nov 2026 (proposed aesthetic preset, not approved)";

export const mm = (value: number, note: string | null = null) => spec.proposed(value, PROPOSED_SOURCE, note);
export const maker = (note: string) => spec.awaitingManufacturer<number>(note);
export const makerText = (note: string) => spec.awaitingManufacturer<string>(note);
export const supplier = (note: string) => spec.awaitingSupplier<string>(note);
export const supplierMm = (note: string) => spec.awaitingSupplier<number>(note);
export const design = (note: string) => spec.awaitingDesign<number>(note);
export const designText = (note: string) => spec.awaitingDesign<string>(note);

export const round = (d: number): Outline => ({ shape: "round", diameterMm: mm(d) });
export const oval = (w: number, h: number): Outline => ({ shape: "oval", widthMm: mm(w), heightMm: mm(h) });
export const cushion = (w: number, h: number): Outline => ({
  shape: "cushion",
  widthMm: mm(w),
  heightMm: mm(h),
  cornerRadiusMm: design("Corner radius not yet chosen for this cushion size."),
  outlineMethod: spec.proposed<string>("rounded_rectangle", PROPOSED_SOURCE, "A true cushion curve may replace the rounded rectangle later; they are not treated as identical."),
});
export const tablet = (w: number, h: number): Outline => ({
  shape: "tablet",
  widthMm: mm(w),
  heightMm: mm(h),
  cornerTreatment: spec.awaitingDesign<string>("Corner treatment (square, chamfered or radiused) not yet chosen."),
});
export const rectangle = (w: number, h: number): Outline => ({
  shape: "rectangle",
  widthMm: mm(w),
  heightMm: mm(h),
  cornerRadiusMm: design("Corner radius not yet chosen."),
});
export const hexagon = (acrossFlats: number): Outline => ({
  shape: "hexagon",
  acrossFlatsMm: mm(acrossFlats, "Regular hexagon measured across flats."),
  orientation: spec.awaitingDesign<string>("Point-up or flat-up orientation not yet chosen."),
});

/** The state of every new (non-ring) preset today. */
export const PLANNED: PresetStatus = { design: "proposed", implementation: "planned", manufacturing: "unassessed", storefront: "hidden" };

export const variant = (id: string, label: string, implementation: Variant["implementation"], note: string | null = null): Variant => ({ id, label, implementation, note });

/** Requirements common to every terrain product, owned by the manufacturer. */
export const terrainManufacturing = (): Record<string, SpecValue<number>> => ({
  baseThicknessMm: maker("Body thickness below the terrain baseline, per alloy."),
  maximumReliefMm: maker("Maximum terrain height above the baseline."),
  minimumFeatureWidthMm: maker("Narrowest terrain feature that casts and survives finishing."),
  minimumRimAngleDeg: maker("Sharpest edge allowed where terrain meets the body edge."),
  minimumEdgeRadiusMm: maker("Smallest edge radius on the body."),
  maximumFinishedMassG: maker("Finished-weight limit, if any."),
});

export type Tier = [tier: string, outline: Outline];
