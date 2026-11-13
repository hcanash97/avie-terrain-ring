import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { configureProduct } from "../../product-types/src/server";
import {
  identity,
  pendant,
  ring,
  terrain,
} from "../../shared-types/tests/fixtures";
import {
  createRingMesh,
  createRingMeshForRecordedVersion,
  INNER_CENTRE_COLUMN,
  INNER_SURFACE_COLUMNS,
  meshVolume,
  openEdgeCount,
  ringSectionPlan,
  weldedNormals,
} from "../src/products/terrain-ring/geometry";
import {
  RING_GEOMETRY_CENTRE_PLANE,
  RING_GEOMETRY_LEGACY,
  RING_GEOMETRY_RECORDED_LEGACY,
  RING_GEOMETRY_VERSION,
} from "../src/products/terrain-ring/version";
import { generateTerrainRingPreview } from "../src/products/terrain-ring/adapter";
import { baselineResolution, cases } from "./fixtures/cases";
import { buildProductionRing } from "../../production/src/ring-source";

const sameBytes = (a: ArrayBufferView, b: ArrayBufferView) => {
  if (a.byteLength !== b.byteLength) return false;
  const left = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const right = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
  return true;
};

const hash = (a: ArrayBufferView) =>
  createHash("sha256")
    .update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))
    .digest("hex");

it("names the inner centre column by construction index 6", () => {
  expect(INNER_SURFACE_COLUMNS).toBe(13);
  expect(INNER_CENTRE_COLUMN).toBe(6);
  expect(Number.isInteger(INNER_CENTRE_COLUMN)).toBe(true);
  expect(RING_GEOMETRY_VERSION).toBe(RING_GEOMETRY_CENTRE_PLANE);
});

it("selects a recorded geometry version and does not invent one when it is missing", () => {
  const sample = cases().next().value!;
  const { terrain: built } = generateTerrainRingPreview({
    ...sample.parameters,
    source: sample.source,
    lengthM: sample.area.lengthM,
    bearingDeg: sample.bearingDeg,
    terrainHeight: sample.height,
    detail: sample.detail,
    flat: sample.flat,
    resolution: baselineResolution,
  });
  const params = {
    ...sample.parameters,
    terrain: sample.flat ? null : built,
  };
  const current = createRingMesh(params);
  const legacy = createRingMesh(params, RING_GEOMETRY_LEGACY);
  const recorded = createRingMeshForRecordedVersion(
    RING_GEOMETRY_RECORDED_LEGACY,
    params,
  );
  const namedLegacy = createRingMeshForRecordedVersion(
    RING_GEOMETRY_LEGACY,
    params,
  );
  const corrected = createRingMeshForRecordedVersion(
    RING_GEOMETRY_CENTRE_PLANE,
    params,
  );
  expect(sameBytes(recorded.positions, legacy.positions)).toBe(true);
  expect(sameBytes(namedLegacy.positions, legacy.positions)).toBe(true);
  expect(sameBytes(corrected.positions, current.positions)).toBe(true);
  expect(sameBytes(current.positions, legacy.positions)).toBe(false);
  expect(() => createRingMeshForRecordedVersion(undefined, params)).toThrow(
    /missing/,
  );
  expect(() => createRingMeshForRecordedVersion(null, params)).toThrow(
    /missing/,
  );
  expect(() => createRingMeshForRecordedVersion("", params)).toThrow(/missing/);
  expect(() =>
    createRingMeshForRecordedVersion("terra-ring/not-a-version", params),
  ).toThrow(/Unsupported/);
  expect(() =>
    createRingMeshForRecordedVersion("unimplemented/v1", params),
  ).toThrow(/Unsupported/);
});

it("stamps a new ring configuration with the centre-plane algorithm", () => {
  const configured = configureProduct(ring, terrain(), identity);
  expect(configured.content.geometryVersion).toBe(RING_GEOMETRY_CENTRE_PLANE);
  expect(configured.content.geometryImplemented).toBe(true);
  expect(
    configureProduct(pendant, terrain(), identity).content.geometryVersion,
  ).toBe("unimplemented/v1");
});

it("refuses a missing or unknown version before building a production ring", () => {
  const config = {
    place: "Snowdon, GB",
    bearingDeg: 0,
    terrainHeight: 0.05,
    detail: "high" as const,
    headShape: "bar" as const,
    weight: "slim" as const,
    shoulder: "classic" as const,
    profile: "classic" as const,
    ringSize: "N",
    metal: "silver_925" as const,
    finish: "polished" as const,
  };
  expect(() => buildProductionRing(config, null)).toThrow(/missing/);
  expect(() => buildProductionRing(config, "")).toThrow(/missing/);
  expect(() => buildProductionRing(config, "terra-ring/not-a-version")).toThrow(
    /Unsupported/,
  );
});

it("pins the inner centre column to +0 and leaves every other coordinate unchanged", () => {
  const plan = ringSectionPlan(baselineResolution);
  const centre = new Set(plan.centreVertices);
  expect(plan.centreColumn).toBe(INNER_CENTRE_COLUMN);
  let legacyResidual = 0;
  const changes: {
    key: string;
    vertex: number;
    row: number;
    kind: string;
    component: "z";
    previous: number;
    next: 0;
  }[] = [];
  const normalChanges: string[] = [];
  const volumeChanges: {
    key: string;
    previous: number;
    next: number;
    delta: number;
  }[] = [];
  for (const c of cases()) {
    const { terrain: built, mesh } = generateTerrainRingPreview({
      ...c.parameters,
      source: c.source,
      lengthM: c.area.lengthM,
      bearingDeg: c.bearingDeg,
      terrainHeight: c.height,
      detail: c.detail,
      flat: c.flat,
      resolution: baselineResolution,
    });
    const params = { ...c.parameters, terrain: c.flat ? null : built };
    const legacy = createRingMesh(params, RING_GEOMETRY_LEGACY);
    const again = createRingMesh(params, RING_GEOMETRY_CENTRE_PLANE);
    expect(sameBytes(mesh.positions, again.positions), c.key).toBe(true);
    expect(sameBytes(mesh.indices, again.indices), c.key).toBe(true);
    expect(mesh.positions.length, c.key).toBe(legacy.positions.length);
    const currentBits = new DataView(
      mesh.positions.buffer,
      mesh.positions.byteOffset,
    );
    const legacyBits = new DataView(
      legacy.positions.buffer,
      legacy.positions.byteOffset,
    );
    for (const vertex of plan.centreVertices) {
      const zIndex = vertex * 3 + 2;
      expect(
        currentBits.getUint32(zIndex * 4, true),
        `${c.key}#${vertex}`,
      ).toBe(0);
      expect(Object.is(mesh.positions[zIndex], 0), c.key).toBe(true);
      if (legacyBits.getUint32(zIndex * 4, true) !== 0) legacyResidual++;
    }
    for (let i = 0; i < mesh.positions.length; i++) {
      const current = currentBits.getUint32(i * 4, true);
      const previous = legacyBits.getUint32(i * 4, true);
      if (current === previous) continue;
      const vertex = Math.floor(i / 3);
      const component = i % 3;
      expect(centre.has(vertex), `${c.key} vertex ${vertex}`).toBe(true);
      expect(component, `${c.key} vertex ${vertex}`).toBe(2);
      expect(current, c.key).toBe(0);
      changes.push({
        key: c.key,
        vertex,
        row: plan.kinds.findIndex(
          (_, index) => plan.centreVertices[index] === vertex,
        ),
        kind: plan.kinds[plan.centreVertices.indexOf(vertex)]!,
        component: "z",
        previous: legacy.positions[i]!,
        next: 0,
      });
    }
    for (let row = 0; row < plan.rows; row++) {
      for (const column of [0, INNER_SURFACE_COLUMNS - 1]) {
        const vertex = plan.innerStart + row * INNER_SURFACE_COLUMNS + column;
        for (let component = 0; component < 3; component++) {
          const index = vertex * 3 + component;
          expect(
            currentBits.getUint32(index * 4, true),
            `${c.key} endpoint ${vertex}`,
          ).toBe(legacyBits.getUint32(index * 4, true));
        }
      }
    }
    expect(sameBytes(mesh.indices, legacy.indices), c.key).toBe(true);
    expect(sameBytes(mesh.shade, legacy.shade), c.key).toBe(true);
    expect(sameBytes(mesh.terrainBlend, legacy.terrainBlend), c.key).toBe(true);
    expect(sameBytes(mesh.surfaceLabels!, legacy.surfaceLabels!), c.key).toBe(
      true,
    );
    expect(mesh.terrainAdapted, c.key).toBe(legacy.terrainAdapted);
    expect(mesh.triangleCount, c.key).toBe(legacy.triangleCount);
    expect(mesh.faceTriangleCount, c.key).toBe(legacy.faceTriangleCount);
    expect(openEdgeCount(mesh), c.key).toBe(openEdgeCount(legacy));
    const bounds = (positions: Float32Array) => {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < positions.length; i += 3) {
        for (let component = 0; component < 3; component++) {
          const value = positions[i + component]!;
          min[component] = Math.min(min[component]!, value);
          max[component] = Math.max(max[component]!, value);
        }
      }
      return { min, max };
    };
    expect(bounds(mesh.positions), c.key).toEqual(bounds(legacy.positions));
    if (hash(weldedNormals(mesh)) !== hash(weldedNormals(legacy)))
      normalChanges.push(c.key);
    const previousVolume = meshVolume(legacy);
    const nextVolume = meshVolume(mesh);
    if (previousVolume !== nextVolume) {
      volumeChanges.push({
        key: c.key,
        previous: previousVolume,
        next: nextVolume,
        delta: nextVolume - previousVolume,
      });
    }
  }
  expect(changes.length).toBeGreaterThan(0);
  expect(legacyResidual).toBeGreaterThan(0);
  expect(volumeChanges.every((row) => Number.isFinite(row.delta))).toBe(true);
  const summary = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    changedCoordinates: changes.length,
    legacyNonZeroCentreValues: legacyResidual,
    normalHashChanges: normalChanges,
    volumeChanges,
  };
  console.log(`CENTRE_PLANE_SUMMARY ${JSON.stringify(summary)}`);
  if (process.env.CENTRE_COORDINATE_DIFF) {
    writeFileSync(
      process.env.CENTRE_COORDINATE_DIFF,
      JSON.stringify(
        {
          ...summary,
          algorithm: RING_GEOMETRY_CENTRE_PLANE,
          previousAlgorithm: RING_GEOMETRY_LEGACY,
          note: "Previous values are from this process. The corrected value is positive zero. A different environment can record a different residual. This file is not a second expected buffer.",
          changes,
        },
        null,
        2,
      ),
    );
  }
}, 120000);
