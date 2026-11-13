/**
 * Renders docs/catalogue-unresolved-decisions.md from the catalogue data, so
 * the report cannot drift from the code (a test compares the committed file).
 */
import type { SpecOwner, SpecValue } from "@avie/shared-types";
import { availabilityOf, type Availability } from "./availability";
import { GEMSTONE_REQUIREMENTS, GEMSTONE_TREATMENTS } from "./gemstones";
import { RING_STYLES } from "./ring";
import type { Family, Preset } from "./types";

const OWNER_TITLE: Record<SpecOwner, string> = {
  avie: "À Vie (design decisions)",
  manufacturer: "Manufacturer",
  supplier_or_setter: "Finding supplier or setter",
  coding_agent: "Coding agent",
};
const FAMILY_TITLE: Record<Family, string> = {
  ring: "Ring",
  pendant: "Pendant",
  charm: "Charm",
  stud_earrings: "Stud earrings",
  drop_earrings: "Drop earrings",
  chain_bracelet: "Chain bracelet",
  cuff_bangle: "Cuff / bangle",
  locket: "Locket",
  cufflinks: "Cufflinks",
  brooch: "Brooch",
  lapel_pin: "Lapel pin",
  tie_slide: "Tie slide",
};
const USES: (keyof Availability)[] = ["prototype", "internalPreview", "customerEnquiry", "checkout", "manufacturingRelease"];

type Item = { owner: SpecOwner; family: Family; field: string; note: string; presets: Set<string> };

function specEntries(p: Preset): [string, SpecValue<unknown>][] {
  const outline = Object.entries(p.outline).filter(([k]) => k !== "shape") as [string, SpecValue<unknown>][];
  return [
    ...outline.map(([k, v]) => [`outline.${k}`, v] as [string, SpecValue<unknown>]),
    ...Object.entries(p.design).map(([k, v]) => [`design.${k}`, v] as [string, SpecValue<unknown>]),
    ...Object.entries(p.manufacturing).map(([k, v]) => [`manufacturing.${k}`, v] as [string, SpecValue<unknown>]),
    ...Object.entries(p.components).map(([k, v]) => [`components.${k}`, v] as [string, SpecValue<unknown>]),
  ];
}

export function renderUnresolvedDecisions(catalogue: readonly Preset[]): string {
  const out: string[] = [];
  const families = [...new Set(catalogue.map((p) => p.family))];
  out.push(
    "# Catalogue: unresolved decisions",
    "",
    "Generated from `packages/product-types/src/catalogue` by `npm run catalogue:report`. Do not edit by hand; a test fails if this file differs from the catalogue.",
    "",
    "All non-ring dimensions are **proposed aesthetic presets for prototypes**, not approved sizes. Unknown requirements are `null` with an owner; none has been invented.",
    "",
    "## Presets and what they may be used for",
    "",
    "| Family | Presets | Implementation | Storefront | Prototype | Internal preview | Enquiry | Checkout | Manufacturing release |",
    "|---|---:|---|---|---:|---:|---:|---:|---:|",
  );
  for (const f of families) {
    const ps = catalogue.filter((p) => p.family === f);
    const count = (use: keyof Availability) => ps.filter((p) => availabilityOf(p).allowed[use]).length;
    const uniq = (xs: string[]) => [...new Set(xs)].join(", ");
    out.push(
      `| ${FAMILY_TITLE[f]} | ${ps.length} | ${uniq(ps.map((p) => p.status.implementation))} | ${uniq(ps.map((p) => p.status.storefront))} | ${USES.map(count).join(" | ")} |`,
    );
  }
  out.push("", "No preset is eligible for checkout or manufacturing release: those need manufacturing approval and every manufacturing requirement approved.");

  const items = new Map<string, Item>();
  for (const p of catalogue)
    for (const [field, v] of specEntries(p)) {
      if (!v.status.startsWith("awaiting")) continue;
      const key = `${v.owner}|${p.family}|${field}|${v.note}`;
      const item = items.get(key) ?? { owner: v.owner, family: p.family, field, note: v.note ?? "", presets: new Set<string>() };
      item.presets.add(p.id);
      items.set(key, item);
    }
  for (const owner of ["avie", "manufacturer", "supplier_or_setter"] as SpecOwner[]) {
    out.push("", `## ${OWNER_TITLE[owner]}`, "");
    for (const f of families) {
      const rows = [...items.values()].filter((i) => i.owner === owner && i.family === f);
      if (!rows.length) continue;
      const total = catalogue.filter((p) => p.family === f).length;
      out.push(`### ${FAMILY_TITLE[f]}`, "", "| Field | Needed | Presets |", "|---|---|---:|");
      for (const r of rows) out.push(`| \`${r.field}\` | ${r.note} | ${r.presets.size === total ? "all" : `${r.presets.size} of ${total}`} |`);
      out.push("");
    }
  }

  const proposed = catalogue.flatMap((p) => specEntries(p).filter(([, v]) => v.status === "proposed").map(() => p.family));
  const previewOnly = catalogue.flatMap((p) => specEntries(p).filter(([, v]) => v.status === "preview_only").map(([k]) => `${p.id}: ${k}`));
  out.push(
    "## Proposed and preview-only values",
    "",
    `- ${proposed.length} proposed values across ${new Set(proposed).size} families (body dimensions and outline choices; the ring's sizing-table version). Proposed means a candidate for comparison, not approval.`,
    `- Preview-only values: ${previewOnly.length ? previewOnly.join("; ") : "none yet (the pendant preview profile arrives with Milestone B)"}.`,
    "",
    "## Gemstone treatments (all rejected until approved)",
    "",
    ...GEMSTONE_TREATMENTS.map((t) => `- ${t.label}`),
    "",
    "Each needs, from the setter or manufacturer: " + Object.entries(GEMSTONE_REQUIREMENTS).map(([k, v]) => `\`${k}\` (${v.note})`).join("; ") + ".",
    "",
    "## Ring styles",
    "",
    ...RING_STYLES.map((s) => `- ${s.label}: ${s.implementation}`),
    "",
    "Signet heads are treated as future ring styles rather than a separate family; the `terrain_signet` registry entry stays until À Vie confirms.",
    "",
    "## Coding-agent decisions (proposed in implementation, reviewed by À Vie)",
    "",
    "- Outline generators (circle, ellipse, rounded rectangle, tablet, across-flats hexagon) and tessellation density, with dimensional-error tests.",
    "- Landscape crop and mask for non-rectangular bodies: crop to the body's own aspect and mask; never stretch.",
    "- Coordinate convention for flat products: origin at the body centre on the back plane; +Y relief, +Z towards the attachment, +X right (see `catalogue/types.ts`).",
    "- Preview-only edge radii and attachment proportions, listed as preview-only and blocked from release.",
    "",
    "## Known conflicts to resolve",
    "",
    "- The pendant compatibility window in `constraints.ts` (14–22 mm, from the earlier brief) rejects the proposed 12 mm petite oval, cushion and tablet sizes. À Vie decides the size range; the window is a candidate, not a manufacturing rule.",
    "- The first pendant is now round 18 mm (this brief), replacing the earlier plan's cushion with an integrated loop.",
    "- `terrain_object` (terrain sculpture on a base) is retired from the catalogue as outside fine jewellery; its registry and database entries remain so no record breaks.",
    "- Stud earrings, drop earrings, brooches and lapel pins have no registry or database entry yet (`productId: null`); they are added when a family gets geometry.",
    "",
  );
  return out.join("\n");
}
