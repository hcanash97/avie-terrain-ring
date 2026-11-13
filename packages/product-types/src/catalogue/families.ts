/**
 * Proposed presets for the new product families. Body dimensions are aesthetic
 * candidates for comparison, not approved sizes. Every structural, finding and
 * mechanism value is null with an owner until it is supplied and approved.
 */
import type { SpecValue } from "@avie/shared-types";
import {
  PLANNED,
  cushion,
  design,
  designText,
  hexagon,
  maker,
  makerText,
  oval,
  rectangle,
  round,
  supplier,
  supplierMm,
  tablet,
  terrainManufacturing,
  variant,
  type Tier,
} from "./build";
import type { Family, Preset, PresetStatus, Variant } from "./types";
import type { ProductId } from "@avie/shared-types";

type Group = {
  family: Family;
  productId: ProductId | null;
  noun: string;
  shapes: Record<string, Tier[]>;
  design?: Record<string, SpecValue<number> | SpecValue<string>>;
  manufacturing: Record<string, SpecValue<number> | SpecValue<string>>;
  components?: Record<string, SpecValue<number> | SpecValue<string>>;
  variants: Variant[];
  notes?: string[];
  status?: PresetStatus;
};

function expand(g: Group): Preset[] {
  return Object.entries(g.shapes).flatMap(([shape, tiers]) =>
    tiers.map(([tier, outline]) => ({
      id: `${g.family.replace(/_/g, "-")}-${shape}-${tier}`,
      family: g.family,
      productId: g.productId,
      label: `${tier[0]!.toUpperCase()}${tier.slice(1)} ${shape} ${g.noun}`,
      sizeTier: tier,
      status: g.status ?? PLANNED,
      outline,
      design: g.design ?? {},
      manufacturing: g.manufacturing,
      components: g.components ?? {},
      variants: g.variants,
      notes: g.notes ?? [],
    })),
  );
}

const terrainWindow = () => designText("Area of the face available to the landscape (inside any border).");
const reverseEngravingArea = () => designText("Area available for reverse engraving.");
/** Paired products: the relationship is always explicit, never silently mirrored. */
const PAIR: Variant[] = [
  variant("pair-same-location-same-orientation", "Same location, same orientation", "planned"),
  variant("pair-same-location-mirrored", "Same location, explicitly mirrored composition", "planned", "Mirroring is a customer choice, never applied automatically to real terrain."),
  variant("pair-different-locations", "Different locations", "planned"),
];

// --- Pendants (first expansion product) -------------------------------------
const pendants = expand({
  family: "pendant",
  productId: "terrain_pendant",
  noun: "terrain pendant",
  shapes: {
    round: [["petite", round(14)], ["classic", round(18)], ["statement", round(22)]],
    oval: [["petite", oval(12, 16)], ["classic", oval(15, 20)], ["statement", oval(18, 24)]],
    cushion: [["petite", cushion(12, 12)], ["classic", cushion(16, 16)], ["statement", cushion(20, 20)]],
    tablet: [["petite", tablet(10, 16)], ["classic", tablet(12, 20)], ["statement", tablet(15, 25)]],
    hexagon: [["petite", hexagon(14)], ["classic", hexagon(18)], ["statement", hexagon(22)]],
  },
  design: {
    terrainWindow: terrainWindow(),
    borderWidthMm: design("Depends on the chosen face treatment (terrain to edge or within a frame)."),
    borderHeightMm: design("Depends on the chosen face treatment."),
    reverseFinish: designText("Plain reverse finish (polished or satin)."),
  },
  manufacturing: {
    ...terrainManufacturing(),
    bailWallThicknessMm: maker("Bail wall thickness."),
    bailInternalWidthMm: maker("Bail opening width; must suit the chosen chain and its end fittings."),
    bailInternalHeightMm: maker("Bail opening height; must suit the chosen chain and its end fittings."),
    bailClearanceAllowanceMm: maker("Clearance between bail and chain."),
    attachmentJunction: makerText("How and where the bail joins the body."),
    reverseEngravingDepthMm: maker("Reverse engraving depth."),
  },
  components: {
    chainSku: supplier("Approved supplied chain; never generated procedurally."),
  },
  variants: [
    variant("terrain-to-edge", "Terrain to the edge", "planned"),
    variant("terrain-in-plain-frame", "Terrain within a plain frame", "planned"),
    variant("terrain-in-gemstone-surround", "Terrain within a gemstone-set surround", "future"),
    variant("engraved-reverse", "Terrain front, engraved reverse", "future", "Engraving geometry is not implemented."),
    variant("two-sided-terrain", "Two-sided terrain", "future"),
    variant("integrated-visible-bail", "Integrated visible bail", "planned", "Proposed first attachment for the prototype."),
    variant("articulated-bail", "Separate articulated bail", "future"),
    variant("concealed-rear-bail", "Concealed rear bail", "future"),
    variant("chain-none", "Pendant only", "planned"),
    variant("chain-40cm", "40 cm chain", "planned"),
    variant("chain-45cm", "45 cm chain", "planned"),
    variant("chain-50cm", "50 cm chain", "planned"),
    variant("chain-60cm", "60 cm chain", "planned"),
  ],
  notes: ["Dimensions exclude the bail; overall dimensions are reported separately.", "Bail geometry must match the selected chain and its end fittings."],
});

// --- Charms --------------------------------------------------------------------
const charms = expand({
  family: "charm",
  productId: "terrain_charm",
  noun: "terrain charm",
  shapes: {
    round: [["petite", round(8)], ["classic", round(10)], ["larger", round(12)]],
    oval: [["petite", oval(7, 10)], ["classic", oval(9, 12)], ["larger", oval(11, 14)]],
    cushion: [["petite", cushion(8, 8)], ["classic", cushion(10, 10)], ["larger", cushion(12, 12)]],
    tablet: [["petite", tablet(6, 10)], ["classic", tablet(8, 12)], ["larger", tablet(10, 14)]],
  },
  design: { terrainWindow: terrainWindow(), reverseEngravingArea: reverseEngravingArea(), attachmentOrientation: designText("How the charm hangs.") },
  manufacturing: {
    ...terrainManufacturing(),
    loopDimensions: makerText("Loop size and section."),
    minimumAttachmentSectionMm: maker("Thinnest allowed section at the attachment."),
    engravingDimensions: makerText("Engraving size and depth."),
  },
  components: {
    attachmentFindingSku: supplier("Approved clasp or loop finding."),
    compatibleChainOrBraceletSku: supplier("Chain or bracelet the charm is sold for."),
    claspSpecification: supplier("Clasp specification for removable charms."),
  },
  variants: [
    variant("necklace-charm", "Necklace charm", "planned"),
    variant("bracelet-charm", "Bracelet charm", "planned"),
    variant("fixed-loop", "Fixed-loop charm", "planned"),
    variant("removable", "Removable charm on an approved clasp finding", "planned"),
    variant("engraved-reverse", "Terrain front, engraved reverse", "future"),
    variant("diamond-accent", "Diamond-accent charm", "future"),
  ],
  notes: ["A charm is its own small-scale product, not a scaled-down pendant.", "The smallest sizes need a terrain-readability review; complex landscapes may not read."],
});

// --- Earrings --------------------------------------------------------------------
const studs = expand({
  family: "stud_earrings",
  productId: null,
  noun: "terrain stud earrings",
  shapes: {
    round: [["petite", round(6)], ["classic", round(8)], ["statement", round(10)]],
    cushion: [["petite", cushion(6, 6)], ["classic", cushion(8, 8)], ["statement", cushion(10, 10)]],
    oval: [["petite", oval(5, 7)], ["classic", oval(6, 9)], ["statement", oval(8, 11)]],
  },
  design: { postPosition: designText("Post position on the back, pending a balance review."), postAxis: designText("Post direction relative to the face.") },
  manufacturing: {
    ...terrainManufacturing(),
    postAttachmentSpecification: makerText("How the post is joined."),
    maximumMassPerEarringG: maker("Comfortable maximum mass per ear."),
  },
  components: {
    postFindingSku: supplier("Approved post finding."),
    backFindingSku: supplier("Approved back finding."),
    postDiameterMm: supplierMm("From the approved post finding."),
    postLengthMm: supplierMm("From the approved post finding."),
  },
  variants: [...PAIR, variant("plain-frame", "Plain frame", "planned"), variant("gemstone-accent", "Gemstone accent or surround", "future")],
  notes: ["Mass is reported per earring and per pair.", "Petite sizes are experimental for terrain legibility."],
});

const drops = expand({
  family: "drop_earrings",
  productId: null,
  noun: "terrain drop earrings",
  shapes: {
    round: [["small", round(10)], ["medium", round(13)], ["large", round(16)]],
    oval: [["small", oval(8, 12)], ["medium", oval(10, 16)], ["large", oval(12, 20)]],
    tablet: [["small", tablet(7, 12)], ["medium", tablet(9, 16)], ["large", tablet(11, 20)]],
  },
  design: { overallDropMm: design("Complete hanging length including findings.") },
  manufacturing: {
    ...terrainManufacturing(),
    jointClearanceMm: maker("Clearance at moving joints."),
    mechanicalAttachmentSpecification: makerText("How the drop attaches."),
    maximumMassPerEarringG: maker("Comfortable maximum mass per ear."),
  },
  components: { findingSku: supplier("Approved stud, hook or hoop finding."), findingDimensions: supplier("From the approved finding.") },
  variants: [
    ...PAIR,
    variant("from-plain-stud", "Terrain drop from a plain stud", "planned"),
    variant("from-hook", "Terrain drop from an approved hook", "planned"),
    variant("from-diamond-stud", "Terrain drop from a diamond-set stud", "future"),
    variant("detachable-from-hoop", "Detachable drop from a supplied hoop", "planned"),
  ],
  notes: ["Body size excludes the stud, hook and joining components."],
});

// --- Bracelets --------------------------------------------------------------------
const chainBracelets = expand({
  family: "chain_bracelet",
  productId: "terrain_bracelet",
  noun: "terrain medallion bracelet",
  shapes: {
    round: [["petite", round(10)], ["classic", round(13)], ["statement", round(16)]],
    oval: [["petite", oval(12, 9)], ["classic", oval(16, 11)], ["statement", oval(20, 13)]],
    "horizontal-tablet": [["petite", tablet(18, 6)], ["classic", tablet(24, 8)], ["statement", tablet(30, 10)]],
    cushion: [["petite", cushion(10, 10)], ["classic", cushion(13, 13)], ["statement", cushion(16, 16)]],
  },
  design: {
    attachmentPoints: designText("Where the chain joins the element."),
    reverseProfile: designText("Shape of the back against the wrist."),
    centralElementCurvature: design("Curvature of the element, if any."),
  },
  manufacturing: {
    ...terrainManufacturing(),
    fitAllowanceMm: maker("Difference between wrist circumference and finished length."),
    connectionStrength: makerText("Connection strength requirement."),
  },
  components: {
    chainSku: supplier("Approved bracelet chain."),
    claspSku: supplier("Approved clasp."),
    linkDimensions: supplier("From the approved chain."),
  },
  variants: [
    variant("length-custom-wrist", "Custom wrist measurement", "planned", "Wrist circumference is stored separately from finished length."),
    variant("length-150", "150 mm finished length", "planned"),
    variant("length-165", "165 mm finished length", "planned"),
    variant("length-180", "180 mm finished length", "planned"),
    variant("length-195", "195 mm finished length", "planned"),
  ],
  notes: ["For oval and tablet elements, width runs across the wrist and height along the arm.", "Lengths are prototype catalogue choices, not a fit chart."],
});

/** Cuffs and bangles: no generic sizes yet; one placeholder records the required measurements. */
const cuff: Preset = {
  id: "cuff-bangle-custom",
  family: "cuff_bangle",
  productId: "terrain_bracelet",
  label: "Terrain cuff or bangle (measurements to be agreed)",
  sizeTier: "custom",
  status: PLANNED,
  outline: {
    shape: "rectangle",
    widthMm: design("Terrain panel width."),
    heightMm: design("Terrain panel height."),
    cornerRadiusMm: design("Panel corner radius."),
  },
  design: {
    innerMajorAxisMm: design("Inner major axis."),
    innerMinorAxisMm: design("Inner minor axis."),
    internalPerimeterMm: design("Internal perimeter."),
    bandWidthMm: design("Band width."),
    bandThicknessMm: design("Band thickness."),
    openingGapMm: design("Opening gap (open cuffs)."),
    handEntryRequirement: designText("Hand-entry requirement (closed bangles); wrist size alone is not enough."),
  },
  manufacturing: { ...terrainManufacturing(), sizingMethod: makerText("Agreed sizing method.") },
  components: { hingeAndClaspSku: supplier("Hinge and clasp (hinged bangles).") },
  variants: [variant("open-cuff", "Open cuff", "planned"), variant("closed-bangle", "Closed bangle", "planned"), variant("hinged-bangle", "Hinged bangle", "planned")],
  notes: ["No generic small/medium/large sizes until construction and sizing are agreed."],
};

// --- Lockets (consultation only) -------------------------------------------------------
const lockets = expand({
  family: "locket",
  productId: "terrain_locket",
  noun: "terrain locket",
  shapes: {
    round: [["small", round(18)], ["classic", round(22)], ["statement", round(26)]],
    oval: [["small", oval(15, 20)], ["classic", oval(18, 24)], ["statement", oval(21, 28)]],
    cushion: [["small", cushion(16, 16)], ["classic", cushion(20, 20)], ["statement", cushion(24, 24)]],
  },
  design: { overallDepthMm: design("Overall depth with both shells."), compartmentDimensions: designText("Photo compartment size.") },
  manufacturing: {
    ...terrainManufacturing(),
    shellThicknessMm: maker("Shell thickness."),
    hingeDimensions: makerText("Hinge and pin."),
    closureEngagement: makerText("Closure engagement and tolerances."),
    openingAngleDeg: maker("Opening angle."),
    photoInsertAllowanceMm: maker("Photo-insert allowance."),
    assemblyClearancesMm: maker("Assembly clearances."),
  },
  components: {
    frontShell: makerText("Front shell (generated)."),
    rearShell: makerText("Rear shell (generated)."),
    hinge: supplier("Hinge."),
    hingePin: supplier("Hinge pin."),
    closure: supplier("Closure."),
    bail: supplier("Bail."),
    internalInsert: supplier("Internal insert or photo frame."),
  },
  variants: [
    variant("photo-compartment", "Terrain exterior with photograph compartment", "future"),
    variant("engraved-reverse", "Terrain front, engraved reverse", "future"),
    variant("two-landscapes", "Two exterior landscapes", "future"),
    variant("diamond-frame", "Diamond-framed locket", "future"),
  ],
  notes: ["An assembly, not a pendant with a cavity. Consultation only until physically proven.", "Dimensions exclude the bail."],
});

// --- Cufflinks --------------------------------------------------------------------
const cufflinks = expand({
  family: "cufflinks",
  productId: "terrain_cufflinks",
  noun: "terrain cufflinks",
  shapes: {
    round: [["understated", round(12)], ["classic", round(15)], ["statement", round(18)]],
    oval: [["understated", oval(14, 10)], ["classic", oval(17, 12)], ["statement", oval(20, 14)]],
    cushion: [["understated", cushion(12, 12)], ["classic", cushion(15, 15)], ["statement", cushion(18, 18)]],
    rectangle: [["understated", rectangle(15, 10)], ["classic", rectangle(18, 12)], ["statement", rectangle(21, 14)]],
  },
  design: { stemPosition: designText("Stem position on the back."), assemblyMethod: designText("How face and mechanism are joined.") },
  manufacturing: {
    ...terrainManufacturing(),
    joiningSpecification: makerText("Joining specification."),
    mechanicalClearancesMm: maker("Mechanical clearances."),
    totalMassPerCufflinkG: maker("Total mass per cufflink."),
  },
  components: {
    mechanismSupplierSku: supplier("Manufacturer-selected mechanism; no invented swivel."),
    stemLengthMm: supplierMm("From the selected mechanism."),
    backDimensions: supplier("From the selected mechanism."),
  },
  variants: [
    ...PAIR,
    variant("pair-same-landscape-different-crops", "Same landscape, different crops", "planned"),
    variant("swivel", "Terrain face on a supplied swivel mechanism", "planned"),
    variant("fixed-back", "Fixed-back", "planned"),
    variant("double-ended", "Double-ended", "planned"),
    variant("chain-linked", "Chain-linked double-ended", "planned"),
    variant("engraved-reverse", "Engraved reverse", "future"),
    variant("gemstone-accent", "Gemstone accent", "future"),
  ],
});

// --- Brooches, lapel pins, tie slides (bespoke enquiry) ------------------------------
const brooches = expand({
  family: "brooch",
  productId: null,
  noun: "terrain brooch",
  shapes: {
    round: [["small", round(25)], ["medium", round(35)], ["large", round(45)]],
    oval: [["medium", oval(20, 30)], ["large", oval(28, 40)]],
    "landscape-rectangle": [["medium", rectangle(30, 18)], ["large", rectangle(40, 24)]],
  },
  design: { pinPosition: designText("Pin position."), pinDirection: designText("Pin direction."), garmentContactProfile: designText("Back profile against the garment.") },
  manufacturing: { ...terrainManufacturing(), mechanicalLimits: makerText("Pin assembly mechanical limits.") },
  components: { pinAssemblySku: supplier("Approved pin assembly."), closureType: supplier("Closure type."), pinDimensions: supplier("From the approved pin.") },
  variants: [],
  notes: ["Bespoke enquiry only at first."],
});

const lapelPins = expand({
  family: "lapel_pin",
  productId: null,
  noun: "terrain lapel pin",
  shapes: {
    round: [["small", round(8)], ["medium", round(10)], ["large", round(12)]],
    cushion: [["small", cushion(8, 8)], ["medium", cushion(10, 10)], ["large", cushion(12, 12)]],
  },
  manufacturing: terrainManufacturing(),
  components: { pinFindingSku: supplier("Approved pin finding.") },
  variants: [],
  notes: ["Bespoke enquiry only at first."],
});

const tieSlides = expand({
  family: "tie_slide",
  productId: "terrain_tie_bar",
  noun: "terrain tie slide",
  shapes: {
    bar: [["small", rectangle(45, 5)], ["medium", rectangle(50, 6)], ["large", rectangle(55, 7)]],
  },
  manufacturing: {
    ...terrainManufacturing(),
    clipMechanics: makerText("Clip mechanics, working gap, material behaviour and grip."),
  },
  variants: [],
  notes: ["Dimensions describe the visible decorative face only.", "Bespoke enquiry only at first."],
});

/** The first pendant prototype: geometry exists for review only (Milestone B). */
const withPrototype = (ps: Preset[]) =>
  ps.map((p) => (p.id === "pendant-round-classic" ? { ...p, status: { ...p.status, implementation: "prototype" as const } } : p));

export const familyPresets: Preset[] = [
  ...withPrototype(pendants),
  ...charms,
  ...studs,
  ...drops,
  ...chainBracelets,
  cuff,
  ...lockets,
  ...cufflinks,
  ...brooches,
  ...lapelPins,
  ...tieSlides,
];
