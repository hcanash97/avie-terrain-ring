import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BAIL_LAYER, BODY_LAYER, buildPendantPackage } from "../src/pendant-package";
import { read3dmComponents, write3dmComponents } from "../src/rhino-3dm";

const tetra = { positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]), indices: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]) };

describe("multi-component 3DM", () => {
  it("keeps components as separate objects on their own layers, in millimetres", async () => {
    const bytes = await write3dmComponents(
      [{ mesh: tetra, layer: "A", name: "a", metadata: { component: "body" } }, { mesh: tetra, layer: "B", name: "b", metadata: { component: "bail" } }],
      { designRef: "T-1" },
    );
    const back = await read3dmComponents(bytes, ["component"], ["designRef", "representation"]);
    expect(back.units).toBe("Millimeters");
    expect(back.objects.map((o) => [o.layerName, o.userStrings.component, o.triangleCount])).toEqual([["A", "body", 4], ["B", "bail", 4]]);
    expect(back.documentStrings.designRef).toBe("T-1");
    expect(back.documentStrings.representation).toMatch(/not NURBS/);
  });
});

describe("review-only pendant package", () => {
  const config = { place: "Snowdon, GB", bearingDeg: 0, terrainHeight: 0.7, detail: "high" as const, metal: "gold_9ct" as const, finish: "polished" as const };

  it("writes separate components, reopens them, hashes every file and stays review-only", async () => {
    const a = await buildPendantPackage({ config, orderRef: "TEST-P1", outDir: mkdtempSync(join(tmpdir(), "terra-pd-")), geometryVersion: "test" });
    const b = await buildPendantPackage({ config, orderRef: "TEST-P1", outDir: mkdtempSync(join(tmpdir(), "terra-pd-")), geometryVersion: "test" });
    expect(b.designHash).toBe(a.designHash);
    expect(b.meshHashes).toEqual(a.meshHashes);

    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f).slice(a.root.length + 1))));
    walk(a.root);
    expect(files.sort()).toEqual([
      "01_cad/terrain-pendant-bail.stl", "01_cad/terrain-pendant-body.stl", "01_cad/terrain-pendant.3dm",
      "02_specification/checksum-manifest.json", "02_specification/production-spec.json", "02_specification/validation-report.json",
      "04_source/design-parameters.json", "04_source/heightmap-metadata.json", "04_source/heightmap.bin",
    ]);
    const manifest = JSON.parse(readFileSync(join(a.root, "02_specification/checksum-manifest.json"), "utf8"));
    for (const f of manifest.files) expect(createHash("sha256").update(readFileSync(join(a.root, f.path))).digest("hex"), f.path).toBe(f.sha256);

    // Both CAD formats reproduce each component; the 3DM holds two objects on their own layers.
    expect(a.reopenOk).toBe(true);
    const dm = await read3dmComponents(readFileSync(join(a.root, "01_cad/terrain-pendant.3dm")), ["component"], ["status"]);
    expect(dm.objects.map((o) => o.layerName)).toEqual([BODY_LAYER, BAIL_LAYER]);
    expect(dm.documentStrings.status).toBe("review_only");

    // Validation: both components sound, and what is not assessed is never a pass.
    expect(a.report.components.body.errors).toEqual([]);
    expect(a.report.components.bail.errors).toEqual([]);
    expect(a.report.status).toBe("held_for_review");
    expect(a.report.checks.componentJoin.status).toBe("not_run");
    expect(a.report.checks.minimumRimAngle.status).toBe("not_run");
    expect(a.report.components.body.checks.minimumWallThickness!.status).toBe("not_run");
    expect(a.report.components.body.checks.minimumFeatureSize!.status).toBe("not_run");

    // Specification: honest about every unknown.
    const s = a.spec;
    expect(s.status).toBe("review_only");
    expect(s.claims).toMatchObject({ editableNurbs: false, castingReady: false, joinedBail: false });
    expect(s.releaseBlockedBy.join(" ")).toMatch(/unapproved manufacturing requirements/);
    for (const v of Object.values(s.previewOnlyValues)) expect(v.status).toBe("preview_only");
    for (const v of Object.values(s.manufacturingRequirements)) expect(v.value).toBeNull();
    expect(s.components.find((c) => c.id === "bail")).toMatchObject({ visualPlaceholder: true, joinedToBody: false });
    expect(s.components.find((c) => c.id === "chain")).toMatchObject({ generated: false });
    expect(s.notGenerated.join(" ")).toMatch(/joined body-and-bail solid/);
    expect(s.dimensions.body.diameterMm).toBeCloseTo(18, 6);
    expect(s.coordinateSystem).toMatch(/STL files carry no units/);
  }, 180000);
});
