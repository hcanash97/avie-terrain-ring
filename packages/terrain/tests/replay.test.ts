import { expect, it } from "vitest";
import { decodeHeightmap, sourceFromGrid } from "../src/snapshot";
import { replayTerrainSource } from "../src/server";
import { buildTerrain, frameFor, edgeFalloffAt, reliefFor } from "../src/index";
import { terrain, bytes } from "../../shared-types/tests/fixtures";
import * as appTerrain from "../../../terrain-ring/src/geometry/heightmap";
import * as sharedTerrain from "../src/heightmap";
import * as appRing from "../../../terrain-ring/src/geometry/ring-blank";
import * as sharedRing from "../../geometry/src/products/terrain-ring/index";

it("old imports are aliases, not a second terrain or geometry implementation", () => {
  expect(appTerrain.sampleFrame).toBe(sharedTerrain.sampleFrame);
  expect(appTerrain.blur).toBe(sharedTerrain.blur);
  expect(appRing.createRingMesh).toBe(sharedRing.createRingMesh);
  expect(appRing.weldedNormals).toBe(sharedRing.weldedNormals);
});
it("replays only verified frozen bytes with north-up orientation and stable owned data", () => {
  const saved = bytes.slice(),
    { source } = replayTerrainSource(terrain(), saved);
  expect(source.elevationAt(-3000, 3000)).toBe(200);
  expect(source.elevationAt(3000, -3000)).toBe(500);
  expect(source.elevationAt(0, 0)).toBe(350);
  saved.fill(0);
  expect(source.elevationAt(0, 0)).toBe(350);
  expect(() => source.elevationAt(3100, 0)).toThrow(/outside/);
  expect(() => source.elevationAt(NaN, 0)).toThrow(/outside/);
});
it("fails closed on checksum, metadata, nodata and coverage errors", () => {
  const corrupted = bytes.slice();
  corrupted[0] = 12;
  expect(() => replayTerrainSource(terrain(), corrupted)).toThrow(/checksum/);
  expect(() =>
    replayTerrainSource({ ...terrain(), designHash: "a".repeat(64) }, bytes),
  ).toThrow(/hash/);
  expect(() => decodeHeightmap(bytes.subarray(1), 2, 2)).toThrow(/length/);
  expect(() => decodeHeightmap(bytes, 1, 2)).toThrow();
  const nan = bytes.slice();
  new DataView(nan.buffer).setFloat32(0, Infinity, true);
  expect(() => decodeHeightmap(nan, 2, 2)).toThrow(/non-finite/);
  expect(() =>
    sourceFromGrid(new Float32Array(3), {
      cols: 2,
      rows: 2,
      widthM: 6000,
      heightM: 6000,
    }),
  ).toThrow();
  const { source } = replayTerrainSource(terrain(), bytes);
  expect(() =>
    buildTerrain(
      source,
      { lengthM: 10000, widthM: 10000, bearingDeg: 0 },
      { faceLengthMm: 18, faceWidthMm: 18, maxReliefMm: 2.5 },
      { terrainHeight: 0.7, detail: "high" },
      48,
    ),
  ).toThrow(/outside/);
});
it("one frozen source supports independent product-sized terrain mounts without mutation", () => {
  const snapshot = terrain(),
    before = JSON.stringify(snapshot),
    { source } = replayTerrainSource(snapshot, bytes);
  const ring = { faceLengthMm: 13, faceWidthMm: 7.5, maxReliefMm: 2.4 };
  const pendant = { faceLengthMm: 18, faceWidthMm: 18, maxReliefMm: 2.5 };
  for (const mount of [ring, pendant]) {
    const processed = buildTerrain(
      source,
      frameFor(5000, 0, mount),
      mount,
      { terrainHeight: 0.7, detail: "high" },
      64,
    );
    expect(processed.reliefMm).toBeLessThanOrEqual(mount.maxReliefMm);
    expect(
      processed.data.every((v) => Number.isFinite(v) && v >= 0 && v <= 1),
    ).toBe(true);
  }
  expect(JSON.stringify(snapshot)).toBe(before);
  // These are relief grids, not a pendant geometry generator or casting validation.
});
it("edge falloff remains opt-in and relief stays within the supplied physical cap", () => {
  expect(edgeFalloffAt(0, 0.5)).toBe(0);
  expect(edgeFalloffAt(0.5, 0.5)).toBe(1);
  expect(
    reliefFor(
      300,
      5000,
      { faceLengthMm: 18, faceWidthMm: 18, maxReliefMm: 2.5 },
      1,
    ).reliefMm,
  ).toBeLessThanOrEqual(2.5);
});

it("does not silently replay an unknown terrain algorithm with current rules", async () => {
  const { createTerrainVersion } = await import("@avie/shared-types/server");
  const original = terrain();
  const newer = createTerrainVersion(
    {
      id: original.id,
      designId: original.designId,
      version: 2,
      createdAt: original.createdAt,
      parameters: {
        ...original.parameters,
        terrainAlgorithmVersion: "terrain/future",
      },
    },
    bytes,
  );
  expect(() => replayTerrainSource(newer, bytes)).toThrow(
    /Unsupported terrain algorithm/,
  );
});
