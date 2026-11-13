/**
 * Charm styles for the prototype: a catalogue charm preset (shape and size)
 * made into a piece. Each is a small terrain body on a fixed loop that lies in
 * the plane of the face, so a jump ring or clasp passes through it front to
 * back and the face hangs forward. How a charm hangs is still À Vie's decision
 * (`design.attachmentOrientation`); this loop is a preview proposal only.
 *
 * Every number here is preview_only: it lets the prototype render and be
 * reviewed, and it can never make a preset eligible for production.
 */
import { charmPrototypeSelectionSchema, pendantCoverageSchema, spec, type CharmStyleId, type SpecValue } from "@avie/shared-types";
import type { PendantParameters, TerrainCoverage } from "@avie/geometry/terrain-pendant";
import { getPreset } from "./index";

const SOURCE = "Proposed by the coding agent for the charm prototypes, 13 Nov 2026 (preview only, not a manufacturing value)";
const pv = (value: number, note: string) => spec.previewOnly(value, SOURCE, note);

export type { CharmStyleId } from "@avie/shared-types";

export type CharmStyle = {
  id: CharmStyleId;
  /** Proposed customer-facing name (À Vie to approve). */
  label: string;
  profileId: string;
  expectedTopology: { shells: 1; genus: number; note: string };
  shape: "round" | "tablet" | "cushion";
  attachment: "eye";
  attachmentNote: string;
  defaultCoverage: TerrainCoverage;
  values: Record<string, SpecValue<number>>;
};

/** Shared by every charm shape: a small, protected face on a fixed loop. */
const common = () => ({
  baseThicknessMm: pv(1.2, "Body below the terrain baseline; also holds the loop's wire."),
  maximumReliefMm: pv(0.9, "Terrain at 100% height; lower than the pendants for a small piece that knocks against others."),
  edgeRoundMm: pv(0.3, "Front and back edge rounds."),
  terrainFadeMm: pv(0.5, "Band inside the edge over which terrain eases to a plain frame, protecting the relief at the edge."),
  loopOpeningHeightMm: pv(2.0, "Loop clear opening, vertical; not yet matched to any jump ring or clasp."),
  loopOpeningWidthMm: pv(1.6, "Loop clear opening, side to side; not yet matched to any jump ring or clasp."),
  loopWireMm: pv(0.9, "Loop wire diameter."),
  loopEmbedMm: pv(0.5, "Overlap used by the mesh union; joint strength is not assessed."),
});

const NOTE = "A fixed loop in the plane of the face; a jump ring or clasp passes through it front to back.";
const TOPOLOGY = { shells: 1 as const, genus: 1, note: "One hole: the opening of the loop." };

export const CHARM_STYLES: Record<CharmStyleId, CharmStyle> = {
  round_charm: {
    id: "round_charm",
    label: "Terrain Round Charm",
    profileId: "charm-round-preview-dev-1",
    expectedTopology: TOPOLOGY,
    shape: "round",
    attachment: "eye",
    attachmentNote: NOTE,
    defaultCoverage: { mode: "full" },
    values: common(),
  },
  cushion_charm: {
    id: "cushion_charm",
    label: "Terrain Cushion Charm",
    profileId: "charm-cushion-preview-dev-1",
    expectedTopology: TOPOLOGY,
    shape: "cushion",
    attachment: "eye",
    attachmentNote: NOTE,
    defaultCoverage: { mode: "full" },
    values: { ...common(), cornerRadiusRatio: pv(0.22, "Cushion corner radius as a share of the smaller side (the catalogue's radius is undecided).") },
  },
  tablet_charm: {
    id: "tablet_charm",
    label: "Terrain Tablet Charm",
    profileId: "charm-tablet-preview-dev-1",
    expectedTopology: TOPOLOGY,
    shape: "tablet",
    attachment: "eye",
    attachmentNote: NOTE,
    defaultCoverage: { mode: "full" },
    values: { ...common(), cornerRadiusMm: pv(0.5, "Plan corner radius (the catalogue's corner treatment is undecided).") },
  },
};

export const CHARM_SIZE_TIERS = ["petite", "classic", "larger"] as const;

/** Which preset ids a charm style can build (its catalogue shape in every size tier). */
export const charmStyleAppliesTo = (style: CharmStyleId) => CHARM_SIZE_TIERS.map((tier) => `charm-${CHARM_STYLES[style].shape}-${tier}`);

const n = (s: CharmStyle, k: string) => {
  const v = s.values[k];
  if (!v || v.status !== "preview_only" || v.value === null) throw new Error(`${s.id}.${k} is not a preview-only value`);
  return v.value;
};

/** Authoritative charm prototype resolution; does not enable sale or release. */
export function resolveCharmPrototype(input: unknown) {
  const selection = charmPrototypeSelectionSchema.parse(input);
  if (!charmStyleAppliesTo(selection.style).includes(selection.presetId))
    throw new Error(`Unsupported charm style/preset: ${selection.style}/${selection.presetId}; the ${selection.style} style needs a ${CHARM_STYLES[selection.style].shape}`);
  const preset = getPreset(selection.presetId);
  if (preset.productId !== "terrain_charm" || preset.status.implementation !== "prototype") throw new Error("Preset is not an implemented charm prototype");
  return { selection, preset, style: CHARM_STYLES[selection.style], geometryVersion: "charm-prototype/v1", manufacturingRelease: false as const };
}

/**
 * Generator parameters for a charm preset. Charms use the pendant body
 * generator (same terrain mapping, outline and edge treatment) with their own
 * preview-only values and a face-plane loop.
 */
export function charmStyleParameters(presetId: string, styleId: CharmStyleId, coverage?: TerrainCoverage): Omit<PendantParameters, "terrain" | "resolution"> & { maximumReliefMm: number; profileId: string } {
  const { style, preset } = resolveCharmPrototype({ productType: "terrain_charm", contractVersion: 1, configurationVersion: 1, presetId, style: styleId });
  const o = preset.outline;
  if (o.shape !== style.shape) throw new Error(`${presetId} is a ${o.shape}; the ${style.id} style needs a ${style.shape}`);
  const width = o.shape === "round" ? o.diameterMm.value : o.shape === "tablet" || o.shape === "cushion" ? o.widthMm.value : null;
  const height = o.shape === "round" ? o.diameterMm.value : o.shape === "tablet" || o.shape === "cushion" ? o.heightMm.value : null;
  if (width === null || height === null) throw new Error(`${presetId} has no proposed body size`);
  const corner = style.shape === "round" ? width / 2 : style.shape === "tablet" ? n(style, "cornerRadiusMm") : n(style, "cornerRadiusRatio") * Math.min(width, height);
  return {
    profileId: style.profileId,
    outline: { widthMm: width, heightMm: height, cornerRadiusMm: corner },
    baseThicknessMm: n(style, "baseThicknessMm"),
    edgeRoundMm: n(style, "edgeRoundMm"),
    fadeMm: n(style, "terrainFadeMm"),
    coverage: pendantCoverageSchema.parse(coverage ?? style.defaultCoverage),
    attachment: {
      kind: "eye",
      openingHeightMm: n(style, "loopOpeningHeightMm"),
      openingWidthMm: n(style, "loopOpeningWidthMm"),
      wallMm: n(style, "loopWireMm"),
      embedMm: n(style, "loopEmbedMm"),
    },
    maximumReliefMm: n(style, "maximumReliefMm"),
  };
}
