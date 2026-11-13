/**
 * Generate a review-only manufacturer package for one ring configuration,
 * or for the round pendant prototype with --product pendant.
 *
 *   npm run package -- --place "Snowdon, GB" --shape bar --face standard --size N \
 *     --metal gold_9ct --finish polished [--height 0.7] [--detail high] [--bearing 0] \
 *     [--shoulder classic] [--profile classic] [--min-wall <mm>] [--min-feature <mm>] [--min-rim-angle <deg>] [--renders <dir>] \
 *     [--order SAMPLE-001] [--out production-packages]
 *
 *   npm run package -- --product pendant --style tablet_slider|cushion_tab|round_slider|round_loop [--size petite|classic|statement] \
 *     --place "Snowdon, GB" --metal gold_9ct [--height 0.7] [--coverage full|above_level] [--level 0.3] \
 *     [--detail high] [--bearing 0] [--finish polished] [--renders <dir>] [--order SAMPLE-002]
 */
import { execSync } from "node:child_process";
import { buildRingPackage } from "./package-builder";
import { PENDANT_STYLES, type PendantStyleId } from "@avie/product-types";
import { buildPendantPackage } from "./pendant-package";
import type { RingConfiguration } from "./ring-source";

const args = process.argv.slice(2);
const arg = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1]! : fallback;
};

let geometryVersion = "unknown";
try {
  const commit = execSync("git rev-parse --short HEAD").toString().trim();
  const dirty = execSync("git status --porcelain -- packages").toString().trim() !== "";
  geometryVersion = `${commit}${dirty ? "-dirty" : ""}`;
} catch { /* not a git checkout */ }
const product = arg("product", "ring");
if (product !== "ring" && product !== "pendant")
  throw new Error(`Product "${product}" is not enabled for new package generation (retired and future IDs remain readable in saved records).`);

if (product === "pendant") {
  const started = Date.now();
  const metal = arg("metal", "gold_9ct") as RingConfiguration["metal"];
  const style = arg("style", "round_slider") as PendantStyleId;
  if (!(style in PENDANT_STYLES)) throw new Error(`Unknown style "${style}". Styles: ${Object.keys(PENDANT_STYLES).join(", ")}`);
  const coverageMode = arg("coverage");
  if (coverageMode !== undefined && coverageMode !== "full" && coverageMode !== "above_level")
    throw new Error(`Unknown pendant coverage "${coverageMode}"`);
  const result = await buildPendantPackage({
    config: {
      presetId: `pendant-${PENDANT_STYLES[style].shape}-${arg("size", "classic")}`,
      style,
      coverage: coverageMode === "above_level" ? { mode: "above_level", level: Number(arg("level", "0.3")) } : coverageMode === "full" ? { mode: "full" } : undefined,
      place: arg("place", "Snowdon, GB")!,
      bearingDeg: Number(arg("bearing", "0")),
      terrainHeight: Number(arg("height", "0.7")),
      detail: arg("detail", "high") as RingConfiguration["detail"],
      metal,
      finish: arg("finish", "polished") as RingConfiguration["finish"],
    },
    orderRef: arg("order", "SAMPLE-002")!,
    outDir: arg("out", "production-packages")!,
    geometryVersion: `pendant@${geometryVersion}`,
    rendersDir: arg("renders"),
  });
  const r = result.report;
  const wall = r.checks.minimumWallThickness?.measured as Record<string, number> | undefined;
  const feature = r.checks.minimumFeatureSize?.measured as Record<string, number> | undefined;
  const d = result.spec.dimensions;
  console.log(`Package: ${result.root}`);
  console.log(`Status: ${result.spec.status} (validation: ${r.status}; reopen checks ${result.reopenOk ? "passed" : "FAILED"})`);
  console.log(`Errors: ${r.errors.map((e) => e.code).join(", ") || "none"}; holes through the solid ${r.checks.topology.measured} (expected ${r.checks.topology.required}); warnings ${r.warnings.map((w) => w.code).join(", ") || "none"}`);
  console.log(`${result.spec.style.label}: body ${d.body.widthMm} × ${d.body.heightMm} × ${d.body.depthMm} mm; overall ${d.overall.widthMm} × ${d.overall.heightMm} × ${d.overall.depthMm} mm`);
  if (wall) console.log(`Structural wall: min ${wall.minMm} mm, 1st percentile ${wall.p1Mm} mm`);
  if (feature) console.log(`Terrain feature size (sphere): 1st percentile ${feature.p1Mm} mm, median ${feature.medianMm} mm`);
  console.log(`Mass: ${result.spec.estimatedMassG.value} g ${metal}; ${((Date.now() - started) / 1000).toFixed(1)} s`);
  process.exit(0);
}

const config: RingConfiguration = {
  place: arg("place", "Snowdon, GB")!,
  bearingDeg: Number(arg("bearing", "0")),
  terrainHeight: Number(arg("height", "0.7")),
  detail: arg("detail", "high") as RingConfiguration["detail"],
  headShape: arg("shape", "bar") as RingConfiguration["headShape"],
  weight: arg("face", "standard") as RingConfiguration["weight"],
  shoulder: arg("shoulder", "classic") as RingConfiguration["shoulder"],
  profile: arg("profile", "classic") as RingConfiguration["profile"],
  ringSize: arg("size", "N")!,
  metal: arg("metal", "gold_9ct") as RingConfiguration["metal"],
  finish: arg("finish", "polished") as RingConfiguration["finish"]
};
const minWall = arg("min-wall");
const minFeature = arg("min-feature");
const minRimAngle = arg("min-rim-angle");

const started = Date.now();
const result = await buildRingPackage({
  config,
  orderRef: arg("order", "SAMPLE-001")!,
  outDir: arg("out", "production-packages")!,
  geometryVersion: `ring@${geometryVersion}`,
  minWallMm: minWall === undefined ? null : Number(minWall),
  minFeatureMm: minFeature === undefined ? null : Number(minFeature),
  minRimAngleDeg: minRimAngle === undefined ? null : Number(minRimAngle),
  rendersDir: arg("renders")
});
const wall = result.report.checks.minimumWallThickness?.measured as Record<string, number> | undefined;
console.log(`Package: ${result.root}`);
console.log(`Status: ${result.spec.status} (validation: ${result.report.status}; reopen checks ${result.reopenOk ? "passed" : "FAILED"})`);
console.log(`Errors: ${result.report.errors.map((e) => e.code).join(", ") || "none"}`);
const feature = result.report.checks.minimumFeatureSize?.measured as Record<string, number> | undefined;
const rim = result.report.checks.minimumRimAngle?.measured as Record<string, number> | undefined;
if (wall) console.log(`Structural wall (to the finger): min ${wall.minMm} mm, 1st percentile ${wall.p1Mm} mm, median ${wall.medianMm} mm`);
if (feature) console.log(`Terrain feature size (sphere): min ${feature.minMm} mm, 1st percentile ${feature.p1Mm} mm, median ${feature.medianMm} mm`);
if (rim) console.log(`Rim angle: min ${rim.minDeg}°, ${rim.percentBelow45Deg}% of the rim below 45°`);
console.log(`Mass: ${result.spec.estimatedMassG} g ${config.metal}; ${((Date.now() - started) / 1000).toFixed(1)} s`);
