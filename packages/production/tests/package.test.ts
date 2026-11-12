import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boundingBox, signedVolume, weld } from "../src/mesh";
import { buildRingPackage } from "../src/package-builder";
import { read3dm, write3dm } from "../src/rhino-3dm";
import type { RingConfiguration } from "../src/ring-source";
import { readBinaryStl, writeBinaryStl } from "../src/stl";

const tetra = {
  positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  indices: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3])
};

describe("binary STL", () => {
  it("round-trips geometry exactly and is not mistaken for ASCII", () => {
    const bytes = writeBinaryStl(tetra, "solid header that must be neutralised");
    expect(bytes.toString("ascii", 0, 5)).not.toBe("solid");
    expect(bytes.length).toBe(84 + 4 * 50);
    const back = weld(readBinaryStl(bytes).mesh);
    expect(back.indices.length).toBe(12);
    expect(signedVolume(back)).toBeCloseTo(signedVolume(tetra), 6);
    expect(boundingBox(back)).toEqual(boundingBox(tetra));
  });
  it("rejects a truncated file", () => {
    expect(() => readBinaryStl(writeBinaryStl(tetra, "x").subarray(0, 120))).toThrow();
  });
});

describe("Rhino 3DM (mesh)", () => {
  it("declares millimetres, keeps the mesh, the layer and the metadata, and says it is not NURBS", async () => {
    const bytes = await write3dm(tetra, { designRef: "WR-TEST" });
    const back = await read3dm(bytes, ["designRef", "units", "representation"]);
    expect(back.units).toBe("Millimeters");
    expect(back.triangleCount).toBe(4);
    expect(back.vertexCount).toBe(4);
    expect(back.layerName).toBe("Terra final mesh");
    expect(back.userStrings.designRef).toBe("WR-TEST");
    expect(back.userStrings.representation).toMatch(/not NURBS/);
  });
});

describe("review-only ring package", () => {
  const config: RingConfiguration = {
    place: "Snowdon, GB", bearingDeg: 0, terrainHeight: 0.05, detail: "high", headShape: "bar",
    weight: "slim", shoulder: "classic", profile: "classic", ringSize: "N", metal: "silver_925", finish: "polished"
  };

  it("writes the agreed structure, reopens both CAD files, hashes every file and stays review-only", async () => {
    const out = mkdtempSync(join(tmpdir(), "terra-pkg-"));
    const a = await buildRingPackage({ config, orderRef: "TEST-1", outDir: out, geometryVersion: "test", minWallMm: null });
    const b = await buildRingPackage({ config, orderRef: "TEST-1", outDir: mkdtempSync(join(tmpdir(), "terra-pkg-")), geometryVersion: "test", minWallMm: null });

    // Deterministic: same configuration → identical mesh file and design hash.
    expect(b.meshHash).toBe(a.meshHash);
    expect(b.designHash).toBe(a.designHash);

    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f).slice(a.root.length + 1))));
    walk(a.root);
    expect(files.sort()).toEqual([
      "01_cad/terrain-ring.3dm", "01_cad/terrain-ring.stl",
      "02_specification/checksum-manifest.json", "02_specification/production-spec.json", "02_specification/validation-report.json",
      "04_source/design-parameters.json", "04_source/heightmap-metadata.json", "04_source/heightmap.bin"
    ]);

    const manifest = JSON.parse(readFileSync(join(a.root, "02_specification/checksum-manifest.json"), "utf8"));
    for (const f of manifest.files) {
      if (f.path.endsWith("checksum-manifest.json")) continue;
      expect(createHash("sha256").update(readFileSync(join(a.root, f.path))).digest("hex"), f.path).toBe(f.sha256);
    }

    expect(a.reopenOk).toBe(true);
    expect(a.spec.status).toBe("review_only");
    expect(a.spec.claims).toMatchObject({ editableNurbs: false, castingReady: false });
    expect(a.spec.units).toBe("millimetres");
    expect(a.report.constraintProfile.approved).toBe(false);
    expect(a.spec.notGenerated.join(" ")).toMatch(/production-spec\.pdf/);

    // Thickness is reported by meaning, each with its method, and nothing is judged without a minimum.
    const written = JSON.parse(readFileSync(join(a.root, "02_specification/validation-report.json"), "utf8"));
    for (const name of ["minimumWallThickness", "minimumFeatureSize", "minimumRimAngle", "edgeRayThickness"]) {
      expect(written.checks[name].status, name).toBe("not_run");
      expect(written.checks[name].method, name).toBeTruthy();
      expect(written.checks[name].measured, name).toBeDefined();
    }
    expect(written.distributions.structuralWall.percentBelow).toBeDefined();
    expect(written.distributions.terrainFeatureSize.percentBelow).toBeDefined();
    expect(written.limitations.join(" ")).toMatch(/casting/);
  }, 120000);
});
