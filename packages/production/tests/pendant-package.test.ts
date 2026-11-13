import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPendantPackage, PENDANT_LAYER } from "../src/pendant-package";
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
  const config = { presetId: "pendant-tablet-classic", style: "tablet_slider" as const, place: "Snowdon, GB", bearingDeg: 0, terrainHeight: 0.7, detail: "high" as const, metal: "silver_925" as const, finish: "polished" as const };

  it("writes one joined solid, reopens it, hashes every file and stays review-only", async () => {
    const a = await buildPendantPackage({ config, orderRef: "TEST-P1", outDir: mkdtempSync(join(tmpdir(), "terra-pd-")), geometryVersion: "test" });
    const b = await buildPendantPackage({ config, orderRef: "TEST-P1", outDir: mkdtempSync(join(tmpdir(), "terra-pd-")), geometryVersion: "test" });
    expect(b.designHash).toBe(a.designHash);
    expect(b.meshHash).toBe(a.meshHash);

    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f).slice(a.root.length + 1))));
    walk(a.root);
    expect(files.sort()).toEqual([
      "01_cad/terrain-pendant.3dm", "01_cad/terrain-pendant.stl",
      "02_specification/checksum-manifest.json", "02_specification/production-spec.json", "02_specification/validation-report.json",
      "04_source/design-parameters.json", "04_source/heightmap-metadata.json", "04_source/heightmap.bin",
    ]);
    const manifest = JSON.parse(readFileSync(join(a.root, "02_specification/checksum-manifest.json"), "utf8"));
    for (const f of manifest.files) expect(createHash("sha256").update(readFileSync(join(a.root, f.path))).digest("hex"), f.path).toBe(f.sha256);

    // Both CAD formats reproduce the one solid.
    expect(a.reopenOk).toBe(true);
    const dm = await read3dmComponents(readFileSync(join(a.root, "01_cad/terrain-pendant.3dm")), ["component"], ["status", "style"]);
    expect(dm.objects.map((o) => o.layerName)).toEqual([PENDANT_LAYER]);
    expect(dm.documentStrings).toMatchObject({ status: "review_only", style: "tablet_slider" });

    // Validation: sound solid with its channel; what is not assessed is never a pass.
    const r = a.report;
    expect(r.errors).toEqual([]);
    expect(r.status).toBe("held_for_review");
    expect(r.checks.topology).toMatchObject({ status: "pass", measured: 1, required: 1 });
    // The files as written, reopened, have the style's declared topology.
    expect(r.reopen.expectedTopology).toMatchObject({ shells: 1, genus: 1 });
    expect(r.reopen.stlTopology).toMatchObject({ shells: 1, genus: 1, boundaryEdges: 0, nonManifoldEdges: 0, misorientedEdges: 0, matchesExpected: true });
    expect(r.reopen["3dmTopology"]).toMatchObject({ shells: 1, genus: 1, matchesExpected: true });
    expect(r.checks.triangleQuality?.measured).toBeDefined();
    expect(r.checks.attachmentDiagnostics.measured).toMatchObject({ kind: "through_hole", metalBehindMm: 0.9, metalInFrontUnderBaselineMm: 0.9 });
    expect(r.checks.holeBelowTopEdge?.status).toBe("pass");
    expect(r.checks.holeInsideBase?.method).toMatch(/no manufacturing minimum applied/);
    expect(r.checks.attachmentStrength.status).toBe("not_run");
    expect(r.checks.minimumRimAngle.status).toBe("not_run");
    expect(r.checks.minimumWallThickness?.status).toBe("not_run");

    // Specification: honest about every unknown.
    const s = a.spec;
    expect(s.status).toBe("review_only");
    expect(s.claims).toMatchObject({ editableNurbs: false, castingReady: false, attachmentStrengthAssessed: false });
    expect(s.releaseBlockedBy.join(" ")).toMatch(/unapproved manufacturing requirements/);
    for (const v of Object.values(s.previewOnlyValues)) expect(v.status).toBe("preview_only");
    for (const v of Object.values(s.manufacturingRequirements)) expect(v.value).toBeNull();
    expect(s.style).toMatchObject({ id: "tablet_slider", label: "Terrain Tablet Pendant", attachment: { kind: "through_hole" } });
    expect(s.estimatedMassG.densitySource).toMatch(/not supplied by the manufacturer/);
    expect(s.components.find((c) => c.id === "chain")).toMatchObject({ generated: false });
    expect(s.dimensions.body).toMatchObject({ widthMm: 12, heightMm: 20 });
    expect(s.coordinateSystem).toMatch(/STL files carry no units/);
  }, 240000);
});
