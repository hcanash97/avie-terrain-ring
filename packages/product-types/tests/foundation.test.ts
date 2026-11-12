import { expect, it } from "vitest";
import {
  productTypes,
  productTypeSchema,
  constraints,
  assessCompatibility,
  getProductType,
} from "../src/index";
import { configureProduct } from "../src/server";
import { productIdSchema } from "@avie/shared-types";
import { configurationHash } from "@avie/shared-types/server";
import {
  ring,
  pendant,
  signet,
  terrain,
  identity,
} from "../../shared-types/tests/fixtures";
it("registers nine products with explicit availability, manufacturing and commerce gates", () => {
  expect(Object.keys(productTypes)).toHaveLength(9);
  for (const id of productIdSchema.options) {
    const p = getProductType(id);
    expect(productTypeSchema.safeParse(p).success).toBe(true);
    expect(p.purchasable).toBe(false);
    expect(p.shopifyMapping).toBeNull();
    expect(constraints[id].approval).toBe("provisional");
  }
  expect(productTypes.terrain_ring.previewAvailable).toBe(true);
  for (const id of productIdSchema.options.slice(1))
    expect(productTypes[id].geometryImplemented).toBe(false);
  expect(() => getProductType("__proto__")).toThrow();
});
it("retains Slim Bar previews without applying new proposed ring dimensions", () => {
  const legacy = assessCompatibility(ring);
  expect(legacy.candidateCompatible).toBe(true);
  expect(legacy.mount.widthMm).toBe(5.5);
  expect(
    assessCompatibility(ring, constraints.terrain_ring).candidateCompatible,
  ).toBe(false);
  expect(legacy.productionReady).toBe(false);
  expect(legacy.status).toBe("held_for_review");
});
it("reuses one unchanged terrain snapshot for three separate mounts and hashes", () => {
  const t = terrain(),
    before = JSON.stringify(t);
  const results = [ring, pendant, signet].map((p) =>
    configureProduct(p, t, identity),
  );
  expect(new Set(results.map((r) => r.configurationHash)).size).toBe(3);
  for (const r of results) {
    expect(r.content.terrainVersionId).toBe(t.id);
    expect(r.content.terrainHash).toBe(t.designHash);
    expect(r.configurationHash).toBe(configurationHash(r.content));
  }
  expect(JSON.stringify(t)).toBe(before);
  expect(results[1]!.content.geometryImplemented).toBe(false);
});
it("rejects incompatible materials, profiles, dimensions and engraving", () => {
  expect(
    assessCompatibility(pendant, {
      ...constraints.terrain_pendant,
      materials: ["gold_9ct"],
    }).candidateCompatible,
  ).toBe(false);
  expect(() =>
    assessCompatibility(pendant, constraints.terrain_signet),
  ).toThrow();
  expect(() =>
    configureProduct(
      {
        ...pendant,
        selection: {
          ...pendant.selection,
          options: { ...pendant.selection.options, widthMm: 9 },
        },
      },
      terrain(),
      identity,
    ),
  ).toThrow(/DIMENSIONS/);
  expect(() =>
    configureProduct(
      {
        ...pendant,
        engraving: {
          enabled: true,
          text: "A",
          location: "reverse",
          fontId: "simple",
          depthMm: 0.2,
        },
      },
      terrain(),
      identity,
    ),
  ).toThrow(/ENGRAVING/);
});
it("pins crop and options; changes invalidate the configuration hash", () => {
  const initial = configureProduct(pendant, terrain(), identity);
  const cropped = configureProduct(
    {
      ...pendant,
      crop: { policy: "explicit_crop", u0: 0, u1: 0.8, v0: 0, v1: 1 },
    },
    terrain(),
    identity,
  );
  expect(cropped.configurationHash).not.toBe(initial.configurationHash);
  expect(cropped.content.terrainHash).toBe(initial.content.terrainHash);
  expect(() =>
    configureProduct(
      pendant,
      { ...terrain(), designHash: "0".repeat(64) },
      identity,
    ),
  ).toThrow(/hash mismatch/);
});
it("has unknown future-product limits and never calls placeholders manufacturing approval", () => {
  for (const id of [
    "terrain_cufflinks",
    "terrain_charm",
    "terrain_tie_bar",
    "terrain_bracelet",
    "terrain_locket",
    "terrain_object",
  ] as const) {
    expect(constraints[id].minWallMm).toBeNull();
    expect(constraints[id].maxReliefMm).toBeNull();
  }
  const a = assessCompatibility(pendant);
  expect(a.previewAvailable).toBe(false);
  expect(a.checks.some((c) => c.outcome === "not_run")).toBe(true);
});

it("resolves legacy face dimensions exactly as the existing six presets", async () => {
  const { facePreset } =
    await import("../../../terrain-ring/src/geometry/ring-blank");
  for (const headShape of ["bar", "cushion"] as const)
    for (const weight of ["slim", "standard", "bold"] as const) {
      const expected = facePreset(weight, headShape),
        actual = assessCompatibility({
          ...ring,
          selection: {
            productType: "terrain_ring",
            options: { ...ring.selection.options, headShape, weight },
          },
        }).mount;
      expect(actual.widthMm).toBe(expected.faceWidthMm);
      expect(actual.heightMm).toBe(expected.faceLengthMm);
      expect(actual.substrateMm).toBe(expected.headHeightMm);
      expect(actual.reliefLimitMm).toBe(expected.maxReliefMm);
    }
});
