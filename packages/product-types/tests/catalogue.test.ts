import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { facePreset } from "@avie/geometry/terrain-ring";
import { isApproved, specNumberSchema, spec } from "@avie/shared-types";
import {
  CATALOGUE,
  ENABLED_PRESETS,
  RETIRED_PRODUCT_IDS,
  assertGemstoneSupported,
  assessCompatibility,
  availabilityOf,
  getPreset,
  GEMSTONE_TREATMENTS,
  type Preset,
} from "../src/index";
import { renderUnresolvedDecisions } from "../src/catalogue/report";
import { ring, pendant } from "../../shared-types/tests/fixtures";

const value = (p: Preset, group: "design" | "manufacturing" | "components", key: string) => p[group][key]!.value;

describe("specification values", () => {
  it("keeps unknowns null and only lets approved values name an approver", () => {
    expect(specNumberSchema.safeParse(spec.awaitingManufacturer("x")).success).toBe(true);
    expect(specNumberSchema.safeParse({ ...spec.awaitingManufacturer<number>("x"), value: 1.2 }).success).toBe(false);
    expect(specNumberSchema.safeParse({ ...spec.proposed(18, "catalogue"), approvedBy: "someone" }).success).toBe(false);
    expect(specNumberSchema.safeParse({ ...spec.proposed(18, "catalogue"), status: "approved" }).success).toBe(false);
    expect(specNumberSchema.safeParse({ ...spec.awaitingManufacturer<number>("x"), owner: "coding_agent" }).success).toBe(false);
    expect(isApproved(spec.proposed(18, "catalogue"))).toBe(false);
  });
});

describe("existing ring is extracted without change", () => {
  it("reads every ring preset from the geometry presets", () => {
    for (const shape of ["bar", "cushion"] as const)
      for (const weight of ["slim", "standard", "bold"] as const) {
        const geo = facePreset(weight, shape), p = getPreset(`ring-${shape}-${weight}`);
        expect(value(p, "design", "headLengthMm")).toBe(geo.faceLengthMm);
        expect(value(p, "design", "headWidthMm")).toBe(geo.faceWidthMm);
        expect(value(p, "design", "headBaseThicknessMm")).toBe(geo.headHeightMm);
        expect(value(p, "design", "bandWidthMm")).toBe(geo.bandWidthMm);
        expect(value(p, "design", "bandThicknessMm")).toBe(geo.bandThicknessMm);
        expect(value(p, "design", "terrainReliefMaxMm")).toBe(geo.maxReliefMm);
        expect(p.outline.shape === "round" || p.outline.shape === "hexagon" ? null : p.outline.widthMm.value).toBe(geo.faceLengthMm);
      }
  });

  it("resolves ring mounts exactly as before (the previous hand-copied table)", () => {
    const before: Record<string, [number, number, number, number]> = {
      "bar-slim": [12, 5.5, 0.9, 2], "bar-standard": [13, 7.5, 0.9, 2.4], "bar-bold": [14, 10, 0.9, 2.8],
      "cushion-slim": [10.5, 9.5, 0.9, 2], "cushion-standard": [12, 11, 0.9, 2.4], "cushion-bold": [14, 13, 0.9, 2.8],
    };
    for (const [key, [h, w, sub, relief]] of Object.entries(before)) {
      const [headShape, weight] = key.split("-") as ["bar" | "cushion", "slim" | "standard" | "bold"];
      const m = assessCompatibility({ ...ring, selection: { productType: "terrain_ring", options: { ...ring.selection.options, headShape, weight } } }).mount;
      expect([m.heightMm, m.widthMm, m.substrateMm, m.reliefLimitMm], key).toEqual([h, w, sub, relief]);
    }
  });

  it("keeps the ring sizing chart flagged as unconfirmed", () => {
    const p = getPreset("ring-bar-standard");
    expect(p.design.sizingTableVersion!.status).toBe("proposed");
    expect(p.manufacturing.sizingChartConfirmation!.status).toBe("awaiting_manufacturer");
  });
});

describe("no invented manufacturing values", () => {
  it("leaves every non-ring manufacturing and component value null with an owner", () => {
    for (const p of CATALOGUE.filter((x) => x.family !== "ring"))
      for (const group of ["manufacturing", "components"] as const)
        for (const [k, v] of Object.entries(p[group])) {
          expect(v.value, `${p.id} ${group}.${k}`).toBeNull();
          expect(["manufacturer", "supplier_or_setter"], `${p.id} ${group}.${k}`).toContain(v.owner);
        }
  });

  it("no longer carries invented pendant or signet mount numbers", () => {
    const m = assessCompatibility(pendant).mount;
    expect(m.substrateMm).toBeNull();
    expect(m.reliefLimitMm).toBeNull();
  });

  it("marks every new body dimension as proposed, never approved", () => {
    for (const p of CATALOGUE.filter((x) => x.family !== "ring"))
      for (const [k, v] of Object.entries(p.outline))
        if (k !== "shape") expect(["proposed", "awaiting_design"], `${p.id} ${k}`).toContain((v as { status: string }).status);
  });
});

describe("proposed dimensions", () => {
  it("records the first pendant as an 18 mm round body, excluding the bail", () => {
    const p = getPreset("pendant-round-classic");
    expect(p.outline).toMatchObject({ shape: "round", diameterMm: { value: 18, status: "proposed" } });
    expect(p.notes.join(" ")).toMatch(/exclude the bail/);
  });

  it("measures hexagons across flats and leaves their orientation to À Vie", () => {
    const p = getPreset("pendant-hexagon-classic");
    expect(p.outline).toMatchObject({ shape: "hexagon", acrossFlatsMm: { value: 18 }, orientation: { value: null, status: "awaiting_design" } });
  });

  it("does not treat a rounded rectangle as a true cushion silently", () => {
    const p = getPreset("pendant-cushion-classic");
    expect(p.outline.shape === "cushion" && p.outline.outlineMethod.value).toBe("rounded_rectangle");
  });

  it("makes pair relationships explicit, mirroring included", () => {
    for (const id of ["stud-earrings-round-classic", "drop-earrings-round-medium", "cufflinks-round-classic"])
      expect(getPreset(id).variants.map((v) => v.id)).toEqual(expect.arrayContaining(["pair-same-location-mirrored", "pair-different-locations"]));
  });

  it("keeps wrist size separate from finished bracelet length", () => {
    const p = getPreset("chain-bracelet-round-classic");
    expect(p.variants.find((v) => v.id === "length-custom-wrist")?.note).toMatch(/separately/);
    expect(p.manufacturing.fitAllowanceMm!.status).toBe("awaiting_manufacturer");
  });
});

describe("availability is explicit and gated", () => {
  it("allows nothing that is not listed", () => {
    for (const p of CATALOGUE.filter((x) => !(x.id in ENABLED_PRESETS)))
      expect(Object.values(availabilityOf(p).allowed).some(Boolean), p.id).toBe(false);
  });

  it("never allows checkout or manufacturing release while requirements are unapproved", () => {
    for (const p of CATALOGUE) {
      const everything = { [p.id]: { prototype: true, internalPreview: true, customerEnquiry: true, checkout: true, manufacturingRelease: true } };
      const a = availabilityOf(p, everything);
      expect(a.allowed.checkout, p.id).toBe(false);
      expect(a.allowed.manufacturingRelease, p.id).toBe(false);
      expect(a.blockedBy.manufacturingRelease.join(" ")).toMatch(/unapproved manufacturing requirements/);
    }
  });

  it("keeps the ring enquiry-only and the other round pendants at prototype only", () => {
    expect(availabilityOf(getPreset("ring-bar-standard")).allowed).toEqual({ prototype: true, internalPreview: true, customerEnquiry: true, checkout: false, manufacturingRelease: false });
    // The 18 mm round (Milestone B) is the only pendant with internal preview; see "pendant preview profile".
    expect(availabilityOf(getPreset("pendant-round-petite")).allowed).toEqual({ prototype: true, internalPreview: false, customerEnquiry: false, checkout: false, manufacturingRelease: false });
  });

  it("maps no preset to a retired product", () => {
    for (const p of CATALOGUE) expect(RETIRED_PRODUCT_IDS as readonly string[]).not.toContain(p.productId);
  });
});

describe("gemstones", () => {
  it("rejects every gemstone treatment", () => {
    for (const t of GEMSTONE_TREATMENTS) expect(() => assertGemstoneSupported(t.id)).toThrow(/not available/);
    expect(() => assertGemstoneSupported("1mm-diamond")).toThrow(/Unknown/);
  });
});

describe("unresolved-decisions report", () => {
  it("matches the committed file (regenerate with npm run catalogue:report)", () => {
    const committed = readFileSync(resolve(import.meta.dirname, "../../../docs/catalogue-unresolved-decisions.md"), "utf8");
    expect(committed).toBe(renderUnresolvedDecisions(CATALOGUE));
  });
});

describe("pendant preview profile", () => {
  it("is preview-only and does not unlock enquiry, checkout or release", async () => {
    const { PENDANT_PREVIEW_PROFILE, pendantPreviewNumbers } = await import("../src/index");
    for (const v of Object.values(PENDANT_PREVIEW_PROFILE.values)) expect(v.status).toBe("preview_only");
    expect(pendantPreviewNumbers().baseThicknessMm).toBe(1);
    const p = getPreset("pendant-round-classic");
    expect(p.status.implementation).toBe("prototype");
    expect(availabilityOf(p).allowed).toEqual({ prototype: true, internalPreview: true, customerEnquiry: false, checkout: false, manufacturingRelease: false });
    for (const v of Object.values(p.manufacturing)) expect(v.value).toBeNull();
  });
});
