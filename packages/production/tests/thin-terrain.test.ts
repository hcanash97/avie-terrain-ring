import { describe, expect, it } from "vitest";
import { validation } from "@avie/geometry";
import { buildProductionRing, type RingConfiguration } from "../src/ring-source";

/**
 * Steep terrain (Grand Canyon, Lake District) once read as "thin" because the
 * ray method mixed terrain sharpness with metal thickness. These cases pin the
 * measurement split: structural metal stays at the slim ring's designed
 * substrate, while sharpness is reported as feature size and rim angle.
 * The thresholds passed below are trial review values for the test, not
 * manufacturer requirements.
 */
const base: RingConfiguration = {
  place: "Snowdon, GB", bearingDeg: 0, terrainHeight: 1, detail: "high", headShape: "bar",
  weight: "standard", shoulder: "classic", profile: "classic", ringSize: "N", metal: "silver_925", finish: "polished"
};
/** The 0.9 mm substrate approved for the slim profile on 12 Nov (a design value, not a manufacturer minimum). */
const DESIGN_SUBSTRATE_MM = 0.9;

function measure(place: string, thresholds: { minFeatureMm?: number; minRimAngleDeg?: number } = {}) {
  const ring = buildProductionRing({ ...base, place });
  const report = validation.validateMesh(ring.mesh, {
    productType: "terrain_ring",
    profile: { id: "test", approved: false, minWallMm: null, minFeatureMm: thresholds.minFeatureMm ?? null, maxReliefMm: ring.preset.maxReliefMm },
    densityGcm3: ring.densityGcm3,
    reliefMm: ring.reliefMm,
    surfaceLabels: ring.mesh.surfaceLabels
  });
  const rim = validation.rimAngleCheck(
    { ...ring.terrain, faceLengthMm: ring.preset.faceLengthMm, faceWidthMm: ring.preset.faceWidthMm, cornerRadiusMm: ring.preset.cornerRadiusMm },
    thresholds.minRimAngleDeg ?? null
  );
  return { ring, report: validation.withCheck(report, "minimumRimAngle", rim.check, rim.error), rimMin: (rim.check.measured as Record<string, number>).minDeg! };
}

describe("thin-looking terrain: structural metal versus feature sharpness", () => {
  const results = Object.fromEntries(["Grand Canyon, US", "Lake District, GB", "Snowdon, GB"].map((p) => [p, measure(p)]));

  it("labels every production triangle, all four surfaces present", () => {
    for (const { ring } of Object.values(results)) {
      const labels = ring.mesh.surfaceLabels!;
      expect(labels.length).toBe(ring.mesh.indices.length / 3);
      expect(new Set(labels)).toEqual(new Set([0, 1, 2, 3]));
    }
  });

  it.each(["Grand Canyon, US", "Lake District, GB", "Snowdon, GB"])("%s keeps structural metal at the designed substrate", (place) => {
    expect(results[place]!.report.wall.p1Mm).toBeGreaterThanOrEqual(DESIGN_SUBSTRATE_MM);
  });

  it("reports the steep terrains as sharper than Snowdon, without failing anything by default", () => {
    const snowdon = results["Snowdon, GB"]!;
    for (const place of ["Grand Canyon, US", "Lake District, GB"]) {
      const r = results[place]!;
      expect(r.report.feature!.p1Mm).toBeLessThan(snowdon.report.feature!.p1Mm);
      expect(r.rimMin).toBeLessThan(45);
      expect(r.report.errors).toEqual([]);
      expect(r.report.checks.minimumFeatureSize!.status).toBe("not_run");
      expect(r.report.checks.minimumRimAngle!.status).toBe("not_run");
    }
    expect(snowdon.rimMin).toBeGreaterThanOrEqual(60);
  });

  it("holds Grand Canyon for review once a reviewer sets feature and rim minimums", () => {
    const { report } = measure("Grand Canyon, US", { minFeatureMm: 0.1, minRimAngleDeg: 45 });
    expect(report.status).toBe("fail");
    expect(report.errors.map((e) => e.code).sort()).toEqual(["MINIMUM_FEATURE_SIZE", "MINIMUM_RIM_ANGLE"]);
  });
}, 300000);
