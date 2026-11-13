/**
 * Pendant styles for the prototype: how a catalogue preset (shape and size) is
 * made into a piece. The forms are general jewellery types (a tablet and a
 * medallion on a slider channel, a cushion on a folded tab, and an internal
 * disc-on-loop prototype), interpreted for À Vie; names are proposals for
 * À Vie to approve.
 *
 * Every number here is preview_only: it lets the prototype render and be
 * reviewed, and it can never make a preset eligible for production.
 */
import { spec, type SpecValue } from "@avie/shared-types";
import type { PendantParameters, TerrainCoverage } from "@avie/geometry/terrain-pendant";
import { getPreset } from "./index";
import { PENDANT_PREVIEW_PROFILE } from "./preview-profiles";

const SOURCE = "Proposed by the coding agent for the style prototypes, 13 Nov 2026 (preview only, not a manufacturing value)";
const pv = (value: number, note: string) => spec.previewOnly(value, SOURCE, note);

export type PendantStyleId = "tablet_slider" | "cushion_tab" | "round_slider" | "round_loop";

export type PendantStyle = {
  id: PendantStyleId;
  /** Proposed customer-facing name (À Vie to approve). */
  label: string;
  /** primary: the proposed collection; internal: kept for review, not offered. */
  collection: "primary" | "internal";
  profileId: string;
  /**
   * Expected topology of the finished solid: one shell, and this many holes
   * through it (the chain channel, or the opening of the loop or tab).
   */
  expectedTopology: { shells: 1; genus: number; note: string };
  /** Catalogue shape this style uses. */
  shape: "round" | "tablet" | "cushion";
  attachment: "through_hole" | "loop" | "tab";
  attachmentNote: string;
  defaultCoverage: TerrainCoverage;
  values: Record<string, SpecValue<number>>;
};

const loop = PENDANT_PREVIEW_PROFILE.values;

export const PENDANT_STYLES: Record<PendantStyleId, PendantStyle> = {
  tablet_slider: {
    id: "tablet_slider",
    label: "Terrain Tablet Pendant",
    collection: "primary",
    profileId: "pendant-tablet-slider-preview-dev-1",
    expectedTopology: { shells: 1, genus: 1, note: "One hole: the chain channel through the top." },
    shape: "tablet",
    attachment: "through_hole",
    attachmentNote: "A solid tablet; the chain passes through a hidden channel across the top.",
    defaultCoverage: { mode: "full" },
    values: {
      baseThicknessMm: pv(3.6, "Tablet thickness below the terrain baseline; holds the chain channel."),
      maximumReliefMm: pv(1.4, "Terrain at 100% height."),
      edgeRoundMm: pv(0.4, "Edge rounds."),
      terrainFadeMm: pv(0, "Terrain runs crisp to the edge."),
      cornerRadiusMm: pv(0.6, "Plan corner radius (the catalogue's corner treatment is undecided)."),
      channelDiameterMm: pv(1.8, "Chain channel diameter; not yet matched to any chain."),
      channelFromTopMm: pv(2.2, "Channel centre below the top edge."),
      channelHeightMm: pv(1.8, "Channel centre above the back."),
    },
  },
  cushion_tab: {
    id: "cushion_tab",
    label: "Terrain Cushion Pendant",
    collection: "primary",
    profileId: "pendant-cushion-tab-preview-dev-1",
    expectedTopology: { shells: 1, genus: 1, note: "One hole: the opening of the folded tab." },
    shape: "cushion",
    attachment: "tab",
    attachmentNote: "A flat strap folded over the top edge, joined to the cushion.",
    defaultCoverage: { mode: "full" },
    values: {
      baseThicknessMm: pv(1.6, "Body thickness below the terrain baseline."),
      maximumReliefMm: pv(1.4, "Terrain at 100% height."),
      edgeRoundMm: pv(0.5, "Edge rounds."),
      terrainFadeMm: pv(0, "Terrain runs to the edge."),
      cornerRadiusRatio: pv(0.22, "Cushion corner radius as a share of the smaller side (the catalogue's radius is undecided)."),
      tabWidthRatio: pv(0.25, "Tab width as a share of the body width."),
      tabThicknessMm: pv(0.9, "Tab strap thickness."),
      tabOpeningHeightMm: pv(3.0, "Tab clear opening, vertical; not yet matched to any chain."),
      tabOpeningDepthMm: pv(2.4, "Tab clear opening, front to back."),
      tabEmbedMm: pv(1.0, "How far the tab reaches into the top edge."),
    },
  },
  round_slider: {
    id: "round_slider",
    label: "Terrain Medallion",
    collection: "primary",
    profileId: "pendant-round-slider-preview-dev-1",
    expectedTopology: { shells: 1, genus: 1, note: "One hole: the chain channel through the top." },
    shape: "round",
    attachment: "through_hole",
    attachmentNote: "The chain passes through a hidden channel across the top of the disc.",
    defaultCoverage: { mode: "full" },
    values: {
      baseThicknessMm: pv(2.6, "Disc thickness below the terrain baseline; holds the chain channel."),
      maximumReliefMm: pv(1.2, "Terrain at 100% height."),
      edgeRoundMm: pv(0.4, "Front and back edge rounds."),
      terrainFadeMm: pv(0, "Terrain runs to the edge."),
      channelDiameterMm: pv(1.6, "Chain channel diameter; not yet matched to any chain."),
      channelFromTopMm: pv(2.2, "Channel centre below the top edge."),
      channelHeightMm: pv(1.3, "Channel centre above the back."),
    },
  },
  round_loop: {
    id: "round_loop",
    label: "Round loop pendant (internal prototype)",
    collection: "internal",
    profileId: PENDANT_PREVIEW_PROFILE.id,
    expectedTopology: { shells: 1, genus: 1, note: "One hole: the opening of the loop." },
    shape: "round",
    attachment: "loop",
    attachmentNote: "A round-section loop above the top edge, joined to the disc.",
    defaultCoverage: { mode: "full" },
    values: {
      baseThicknessMm: loop.baseThicknessMm,
      maximumReliefMm: loop.maximumReliefMm,
      edgeRoundMm: loop.edgeRoundMm,
      terrainFadeMm: loop.terrainFadeMm,
      loopOpeningHeightMm: loop.bailOpeningHeightMm,
      loopOpeningDepthMm: loop.bailOpeningDepthMm,
      loopWallMm: loop.bailWallMm,
      loopEmbedMm: loop.bailEmbedMm,
    },
  },
};

/** Size labels (proposed; À Vie to approve), always shown with millimetres. */
export const SIZE_LABELS = { petite: "Petite", classic: "Classic", statement: "Statement" } as const;

/**
 * Terrain coverage wording. "above_level" flattens everything below a chosen
 * share of the place's relief: a stylised treatment, NOT a land/water mask.
 * It is never a default; it applies only when chosen and is recorded.
 */
export const COVERAGE_LABELS = {
  full: "Full relief",
  above_level: "Flat below a chosen height (stylised; not a coastline)",
} as const;

/** "Classic · 12 × 20 mm": a size name never appears without its dimensions. */
export function sizeLabel(presetId: string): string {
  const p = getPreset(presetId);
  const o = p.outline;
  const mm =
    o.shape === "round" ? `Ø${o.diameterMm.value} mm` : o.shape === "hexagon" ? `${o.acrossFlatsMm.value} mm across flats` : `${o.widthMm.value} × ${o.heightMm.value} mm`;
  const name = SIZE_LABELS[p.sizeTier as keyof typeof SIZE_LABELS] ?? p.sizeTier;
  return `${name} · ${mm}`;
}

const n = (s: PendantStyle, k: string) => {
  const v = s.values[k];
  if (!v || v.status !== "preview_only" || v.value === null) throw new Error(`${s.id}.${k} is not a preview-only value`);
  return v.value;
};

/** Which preset ids a style can build (its catalogue shape in every size tier). */
export const styleAppliesTo = (style: PendantStyleId) => {
  const shape = PENDANT_STYLES[style].shape;
  return ["petite", "classic", "statement"].map((tier) => `pendant-${shape}-${tier}`);
};

/**
 * Generator parameters for a preset in a style. Body width and height come
 * from the catalogue (proposed); everything else from the style's preview-only
 * values. The terrain is supplied by the caller.
 */
export function pendantStyleParameters(presetId: string, styleId: PendantStyleId, coverage?: TerrainCoverage): Omit<PendantParameters, "terrain" | "resolution"> & { maximumReliefMm: number; profileId: string } {
  const style = PENDANT_STYLES[styleId];
  const preset = getPreset(presetId);
  const o = preset.outline;
  if (o.shape !== style.shape) throw new Error(`${presetId} is a ${o.shape}; the ${style.id} style needs a ${style.shape}`);
  const width = o.shape === "round" ? o.diameterMm.value : o.shape === "tablet" || o.shape === "cushion" ? o.widthMm.value : null;
  const height = o.shape === "round" ? o.diameterMm.value : o.shape === "tablet" || o.shape === "cushion" ? o.heightMm.value : null;
  if (width === null || height === null) throw new Error(`${presetId} has no proposed body size`);
  const corner =
    style.shape === "round" ? width / 2 : style.shape === "tablet" ? n(style, "cornerRadiusMm") : n(style, "cornerRadiusRatio") * Math.min(width, height);
  const attachment: PendantParameters["attachment"] =
    style.attachment === "through_hole"
      ? { kind: "through_hole", diameterMm: n(style, "channelDiameterMm"), centreFromTopMm: n(style, "channelFromTopMm"), centreHeightMm: n(style, "channelHeightMm") }
      : style.attachment === "loop"
        ? { kind: "loop", openingHeightMm: n(style, "loopOpeningHeightMm"), openingDepthMm: n(style, "loopOpeningDepthMm"), wallMm: n(style, "loopWallMm"), embedMm: n(style, "loopEmbedMm") }
        : {
            kind: "tab",
            widthMm: +(n(style, "tabWidthRatio") * width).toFixed(2),
            thicknessMm: n(style, "tabThicknessMm"),
            openingHeightMm: n(style, "tabOpeningHeightMm"),
            openingDepthMm: n(style, "tabOpeningDepthMm"),
            embedMm: n(style, "tabEmbedMm"),
          };
  return {
    profileId: style.profileId,
    outline: { widthMm: width, heightMm: height, cornerRadiusMm: corner },
    baseThicknessMm: n(style, "baseThicknessMm"),
    edgeRoundMm: n(style, "edgeRoundMm"),
    fadeMm: n(style, "terrainFadeMm"),
    coverage: coverage ?? style.defaultCoverage,
    attachment,
    maximumReliefMm: n(style, "maximumReliefMm"),
  };
}
