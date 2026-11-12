import { expect, it } from "vitest";
import {
  configurationInputSchema,
  terrainParametersSchema,
  artefactSchema,
  validationReportSchema,
} from "../src/index";
import {
  canonicalJSON,
  createTerrainVersion,
  sha256,
  terrainHash,
  signClaim,
  verifyClaim,
} from "../src/server";
import { bytes, terrain, terrainInput, ring, id } from "./fixtures";
it("freezes snapshots and verifies exact saved bytes", () => {
  const v = terrain();
  expect(Object.isFrozen(v.parameters.heightmap)).toBe(true);
  expect(() => createTerrainVersion(terrainInput, bytes.subarray(1))).toThrow();
  const changed = bytes.slice();
  changed[0] = 4;
  expect(() => createTerrainVersion(terrainInput, changed)).toThrow();
  const nan = bytes.slice();
  new DataView(nan.buffer).setFloat32(0, NaN, true);
  expect(() =>
    createTerrainVersion(
      {
        ...terrainInput,
        parameters: {
          ...terrainInput.parameters,
          heightmap: {
            ...terrainInput.parameters.heightmap,
            checksum: sha256(nan),
          },
        },
      },
      nan,
    ),
  ).toThrow(/non-finite/);
});
it("hashes canonical geographic content, independent of storage path/time and key order", () => {
  const a = terrain();
  const moved = createTerrainVersion(
    {
      ...terrainInput,
      createdAt: "2026-11-13T12:00:00Z",
      parameters: {
        ...terrainInput.parameters,
        heightmap: {
          ...terrainInput.parameters.heightmap,
          objectKey: "other/source.bin",
        },
      },
    },
    bytes,
  );
  expect(a.designHash).toBe(moved.designHash);
  expect(canonicalJSON({ b: 1, a: 2 })).toBe(canonicalJSON({ a: 2, b: 1 }));
  expect(terrainHash({ ...terrainInput.parameters, rotationDeg: 20 })).not.toBe(
    a.designHash,
  );
  for (const invalid of [
    undefined,
    NaN,
    Infinity,
    new Date(),
    { a: undefined },
  ])
    expect(() => canonicalJSON(invalid)).toThrow();
});
it("strict schemas reject product coupling, malformed geographies and unsupported options", () => {
  expect(
    terrainParametersSchema.safeParse({
      ...terrainInput.parameters,
      faceWidthMm: 18,
    }).success,
  ).toBe(false);
  expect(
    terrainParametersSchema.safeParse({
      ...terrainInput.parameters,
      centre: { longitude: 40, latitude: 20 },
    }).success,
  ).toBe(false);
  expect(
    terrainParametersSchema.safeParse({
      ...terrainInput.parameters,
      bbox: { west: 170, east: -170, south: 20, north: 30 },
    }).success,
  ).toBe(false);
  expect(
    configurationInputSchema.safeParse({ ...ring, material: "unobtainium" })
      .success,
  ).toBe(false);
  expect(
    configurationInputSchema.safeParse({
      ...ring,
      selection: { productType: "terrain_charm", options: {} },
    }).success,
  ).toBe(false);
  expect(
    configurationInputSchema.safeParse({
      ...ring,
      crop: { policy: "explicit_crop", u0: 0.8, u1: 0.2, v0: 0, v1: 1 },
    }).success,
  ).toBe(false);
  expect(
    configurationInputSchema.safeParse({ ...ring, priceMinor: 1 }).success,
  ).toBe(false);
  expect(artefactSchema.safeParse({ format: "step" }).success).toBe(false);
});
it("server signatures bind purpose, tenant, owner, entity/version and key ID", () => {
  const key = { keyId: "test-key", secret: new Uint8Array(32).fill(18) },
    claim = {
      purpose: "terrain",
      shopId: id(1),
      ownerSessionId: id(2),
      entityId: id(3),
      version: 1,
      hash: terrain().designHash,
    };
  const signature = signClaim(claim, key);
  expect(verifyClaim(claim, signature, [key])).toBe(true);
  for (const patch of [
    { purpose: "configuration" },
    { shopId: id(4) },
    { ownerSessionId: id(5) },
    { entityId: id(6) },
    { version: 2 },
    { hash: "a".repeat(64) },
  ])
    expect(verifyClaim({ ...claim, ...patch }, signature, [key])).toBe(false);
  expect(verifyClaim(claim, { ...signature, keyId: "unknown" }, [key])).toBe(
    false,
  );
  expect(
    verifyClaim(claim, signature, [{ ...key, secret: new Uint8Array(32) }]),
  ).toBe(false);
  expect(() =>
    signClaim(claim, { ...key, secret: new Uint8Array(1) }),
  ).toThrow();
});
it("unknown checks never validate a product", () => {
  expect(
    validationReportSchema.safeParse({
      productType: "terrain_ring",
      status: "validated",
      checks: [],
    }).success,
  ).toBe(false);
  expect(
    validationReportSchema.safeParse({
      productType: "terrain_ring",
      status: "validated",
      checks: [
        {
          code: "thickness",
          outcome: "not_run",
          message: "Unknown",
          measured: null,
          required: null,
          method: null,
        },
      ],
    }).success,
  ).toBe(false);
});

it("cannot validate a pendant report that omits attachment checks", async () => {
  const { requiredValidationChecks } = await import("../src/validation");
  const checks = requiredValidationChecks.map((code) => ({
    code,
    outcome: "pass",
    message: "Synthetic test, not a geometry result",
    measured: null,
    required: null,
    method: "test-only",
  }));
  expect(
    validationReportSchema.safeParse({
      productType: "terrain_pendant",
      status: "validated",
      checks,
    }).success,
  ).toBe(false);
});
