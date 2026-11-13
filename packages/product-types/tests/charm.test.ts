import { describe, expect, it } from "vitest";
import type { TerrainRelief } from "@avie/terrain";
import { attachmentDiagnostics, createPendant } from "@avie/geometry/terrain-pendant";
import { topologySummary, validateMesh } from "@avie/geometry/validation";
import { availabilityOf, CHARM_STYLES, charmStyleAppliesTo, charmStyleParameters, getPreset, resolveCharmPrototype, sizeLabel } from "../src/index";

const select = (style: string, presetId: string) => ({ productType: "terrain_charm", contractVersion: 1, configurationVersion: 1, style, presetId });

/** Synthetic terrain so the build needs no elevation data. */
function hills(reliefMm: number, n = 81): TerrainRelief {
  const data = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = 0.5 + 0.5 * Math.sin((i / (n - 1)) * 9) * Math.cos((j / (n - 1)) * 7);
  return { data, cols: n, rows: n, reliefMm };
}

describe("charm prototypes", () => {
  it("resolve all nine style/size combinations without enabling enquiry, checkout or release", () => {
    for (const style of Object.values(CHARM_STYLES))
      for (const presetId of charmStyleAppliesTo(style.id)) {
        const r = resolveCharmPrototype(select(style.id, presetId));
        expect(r.manufacturingRelease).toBe(false);
        expect(r.preset.status.implementation).toBe("prototype");
        expect(availabilityOf(r.preset).allowed).toEqual({ prototype: true, internalPreview: true, customerEnquiry: false, checkout: false, manufacturingRelease: false });
        for (const v of Object.values(style.values)) expect(v.status).toBe("preview_only");
        for (const v of Object.values(r.preset.manufacturing)) expect(v.value).toBeNull();
        expect(r.preset.design.attachmentOrientation?.value ?? null).toBeNull(); // still À Vie's decision
      }
  });

  it("take body sizes from the catalogue and label sizes with millimetres", () => {
    const p = charmStyleParameters("charm-tablet-classic", "tablet_charm");
    expect(p.outline).toMatchObject({ widthMm: 8, heightMm: 12, cornerRadiusMm: 0.5 });
    expect(charmStyleParameters("charm-round-larger", "round_charm").outline).toMatchObject({ widthMm: 12, heightMm: 12, cornerRadiusMm: 6 });
    expect(sizeLabel("charm-round-larger")).toBe("Larger · Ø12 mm");
  });

  it("reject mismatched shapes, unbuilt shapes and other products", () => {
    expect(() => resolveCharmPrototype(select("tablet_charm", "charm-round-classic"))).toThrow(/needs a tablet/);
    expect(() => resolveCharmPrototype(select("round_charm", "charm-oval-classic"))).toThrow();
    expect(() => resolveCharmPrototype(select("round_charm", "pendant-round-classic"))).toThrow();
    expect(availabilityOf(getPreset("charm-oval-classic")).allowed.internalPreview).toBe(false);
  });

  it.each(Object.values(CHARM_STYLES).flatMap((s) => charmStyleAppliesTo(s.id).map((id) => [s.id, id] as const)))(
    "%s %s builds one closed solid with the loop's single opening",
    async (styleId, presetId) => {
      const params = charmStyleParameters(presetId, styleId);
      const built = await createPendant({ ...params, terrain: hills(params.maximumReliefMm), resolution: { rings: 40, angular: 160, round: 4 }, attachmentSegments: 32 });
      expect(built.checks.every((c) => c.ok), JSON.stringify(built.checks)).toBe(true);
      expect(built.genus).toBe(CHARM_STYLES[styleId].expectedTopology.genus);
      const report = validateMesh(built.mesh, { productType: "terrain_pendant", profile: { id: "test", approved: false, minWallMm: null, minFeatureMm: null, maxReliefMm: null }, densityGcm3: 10.36, surfaceLabels: built.mesh.surfaceLabels });
      expect(report.errors).toEqual([]);
      expect(topologySummary(built.mesh)).toMatchObject({ shells: 1, genus: 1, boundaryEdges: 0, nonManifoldEdges: 0 });
      const a = params.attachment;
      if (a.kind !== "eye") throw new Error("charms use the face-plane loop");
      const d = built.dimensions;
      expect(d.overall.widthMm).toBeCloseTo(params.outline.widthMm, 2);
      expect(d.overall.heightMm).toBeCloseTo(params.outline.heightMm + a.openingHeightMm + 2 * a.wallMm - a.embedMm, 1);
      // The loop lies inside the body's depth: nothing behind the back plane.
      expect(Math.min(...Array.from({ length: built.mesh.positions.length / 3 }, (_, i) => built.mesh.positions[i * 3 + 1]!))).toBeGreaterThanOrEqual(-1e-6);
      const diag = attachmentDiagnostics(built.mesh, params.outline, params.baseThicknessMm, a);
      expect(diag.kind).toBe("eye");
      if (!("openingCentreSlice" in diag) || !diag.openingCentreSlice) throw new Error("missing slices");
      // Two round legs of the wire through the opening centre.
      expect(diag.openingCentreSlice.areaMm2).toBeCloseTo(2 * Math.PI * (a.wallMm / 2) ** 2, 1);
    },
    60000,
  );
});
