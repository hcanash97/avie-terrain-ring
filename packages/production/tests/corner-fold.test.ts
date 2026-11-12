import { describe, expect, it } from "vitest";
import { validation } from "@avie/geometry";
import { buildProductionRing, type RingConfiguration } from "../src/ring-source";

/**
 * Regression: with high terrain at the face edge, the edge round at the head's
 * plan corners used to fold the top surface over itself (self-intersections
 * near (±6.4, 9.8, ±3.6) mm on a Standard Snowdon ring at 70% height).
 */
describe("head corners with high terrain at the face edge", () => {
  const base: RingConfiguration = {
    place: "Snowdon, GB", bearingDeg: 0, terrainHeight: 0.7, detail: "high", headShape: "bar",
    weight: "standard", shoulder: "classic", profile: "classic", ringSize: "N", metal: "gold_9ct", finish: "polished"
  };
  it.each([
    ["Standard bar", { weight: "standard", headShape: "bar" }],
    ["Standard cushion", { weight: "standard", headShape: "cushion" }]
  ] as const)("%s does not fold into itself", (_name, overrides) => {
    const ring = buildProductionRing({ ...base, ...overrides });
    const report = validation.validateMesh(ring.mesh, {
      productType: "terrain_ring",
      profile: { id: "test", approved: false, minWallMm: null, minFeatureMm: null, maxReliefMm: ring.preset.maxReliefMm },
      densityGcm3: ring.densityGcm3,
      reliefMm: ring.reliefMm
    });
    expect(report.checks.selfIntersections?.status, report.checks.selfIntersections?.note).toBe("pass");
    expect(report.errors.map((e) => e.code)).toEqual([]);
  }, 120000);
});
