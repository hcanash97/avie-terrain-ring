/**
 * The existing terrain ring, extracted from the geometry presets (the single
 * source of truth). Nothing here changes ring output: values are read from
 * `facePreset`, never copied.
 */
import { facePreset, type HeadShape, type Weight } from "@avie/geometry/terrain-ring";
import type { SpecValue } from "@avie/shared-types";
import { maker, makerText, terrainManufacturing, variant } from "./build";
import type { Outline, Preset, Variant } from "./types";

const DESIGN_APPROVAL = "À Vie (owner)";
const DESIGN_SOURCE = "Implemented ring preset (packages/geometry terrain-ring facePreset); slim profile directed by the owner on 12 Nov 2026";
/** Design approval only: these are the implemented, owner-directed proportions, not manufacturing approval. */
const designed = <T>(value: T, note: string | null = null): SpecValue<T> => ({
  value,
  status: "approved",
  owner: "avie",
  source: DESIGN_SOURCE,
  approvedBy: DESIGN_APPROVAL,
  note,
});

export const RING_SIZING = {
  system: "UK",
  tableVersion: "uk-iso8653-convention/v1",
  source: "terrain-ring/src/geometry/ring-sizing.ts",
  note: "UK letters H–Z with half sizes, from the ISO 8653 convention (A = 37.8 mm inner circumference, +1.25 mm per letter). Not yet confirmed against the maker's mandrels.",
} as const;

export const RING_SHOULDERS: Variant[] = [
  variant("straight", "Straight shoulders", "implemented"),
  variant("classic", "Classic shoulders", "implemented"),
  variant("curved", "Curved shoulders", "implemented"),
];
export const RING_INNER_PROFILES: Variant[] = [
  variant("flat", "Flat inner profile", "implemented"),
  variant("classic", "Comfort inner profile", "implemented", "Comfort fit adds up to 0.12 mm at the band centre; ring size is set by the inner diameter at the edges."),
  variant("d_shape", "D-shape band", "implemented"),
];

/** Ring head styles. Only bar and cushion exist; the rest are registered possibilities. */
export const RING_STYLES: Variant[] = [
  variant("bar", "Rectangular / bar head", "implemented"),
  variant("cushion", "Cushion head", "implemented"),
  variant("round", "Round head", "future"),
  variant("oval", "Oval head", "future"),
  variant("shield", "Shield head", "future"),
  variant("octagonal", "Octagonal head", "future"),
  variant("slim-terrain-band", "Slim terrain band", "future"),
  variant("wide-terrain-band", "Wide terrain band", "future"),
];

const WEIGHTS: Weight[] = ["slim", "standard", "bold"];
const SHAPES: HeadShape[] = ["bar", "cushion"];

function ringPreset(shape: HeadShape, weight: Weight): Preset {
  const p = facePreset(weight, shape);
  // Head length runs across the finger; head width runs along it.
  const outline: Outline =
    shape === "bar"
      ? { shape: "rectangle", widthMm: designed(p.faceLengthMm), heightMm: designed(p.faceWidthMm), cornerRadiusMm: designed(p.cornerRadiusMm) }
      : {
          shape: "cushion",
          widthMm: designed(p.faceLengthMm),
          heightMm: designed(p.faceWidthMm),
          cornerRadiusMm: designed(p.cornerRadiusMm),
          outlineMethod: designed<string>("rounded_rectangle"),
        };
  return {
    id: `ring-${shape}-${weight}`,
    family: "ring",
    productId: "terrain_ring",
    label: `${p.label} ${shape === "bar" ? "bar" : "cushion"} terrain ring`,
    sizeTier: weight,
    status: { design: "approved", implementation: "implemented", manufacturing: "review_required", storefront: "enquiry_only" },
    outline,
    design: {
      headLengthMm: designed(p.faceLengthMm, "Across the finger."),
      headWidthMm: designed(p.faceWidthMm, "Along the finger."),
      headBaseThicknessMm: designed(p.headHeightMm, "Metal under the terrain table."),
      bandWidthMm: designed(p.bandWidthMm, "At the palm."),
      bandThicknessMm: designed(p.bandThicknessMm),
      terrainReliefMaxMm: designed(p.maxReliefMm, "Design maximum; 'terrain height' is a share of this."),
      ringSizeSystem: designed<string>(RING_SIZING.system),
      sizingTableVersion: {
        value: RING_SIZING.tableVersion,
        status: "proposed",
        owner: "avie",
        source: RING_SIZING.source,
        approvedBy: null,
        note: RING_SIZING.note,
      },
    },
    manufacturing: {
      ...terrainManufacturing(),
      minimumStructuralWallMm: maker("Minimum metal between the outside and the finger, per alloy."),
      sizingChartConfirmation: makerText("Confirm the UK size chart against the maker's mandrels."),
    },
    components: {},
    variants: [...RING_SHOULDERS, ...RING_INNER_PROFILES],
    notes: [
      "Overall dimensions depend on the ring size and are reported by the generator.",
      "Validation open item: 12 cushion configurations on Matterhorn and Table Mountain read below the 0.9 mm design substrate on structural wall (not yet investigated).",
    ],
  };
}

export const ringPresets: Preset[] = SHAPES.flatMap((shape) => WEIGHTS.map((weight) => ringPreset(shape, weight)));
