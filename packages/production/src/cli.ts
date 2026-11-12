/**
 * Generate a review-only manufacturer package for one ring configuration.
 *
 *   npm run package -- --place "Snowdon, GB" --shape bar --face standard --size N \
 *     --metal gold_9ct --finish polished [--height 0.7] [--detail high] [--bearing 0] \
 *     [--shoulder classic] [--profile classic] [--min-wall 1.0] [--renders <dir>] \
 *     [--order SAMPLE-001] [--out production-packages]
 */
import { execSync } from "node:child_process";
import { buildRingPackage } from "./package-builder";
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
  geometryVersion = `ring@${commit}${dirty ? "-dirty" : ""}`;
} catch { /* not a git checkout */ }

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

const started = Date.now();
const result = await buildRingPackage({
  config,
  orderRef: arg("order", "SAMPLE-001")!,
  outDir: arg("out", "production-packages")!,
  geometryVersion,
  minWallMm: minWall === undefined ? null : Number(minWall),
  rendersDir: arg("renders")
});
const wall = result.report.checks.minimumWallThickness?.measured as Record<string, number> | undefined;
console.log(`Package: ${result.root}`);
console.log(`Status: ${result.spec.status} (validation: ${result.report.status}; reopen checks ${result.reopenOk ? "passed" : "FAILED"})`);
console.log(`Errors: ${result.report.errors.map((e) => e.code).join(", ") || "none"}`);
if (wall) console.log(`Wall thickness: min ${wall.minMm} mm, 1st percentile ${wall.p1Mm} mm, median ${wall.medianMm} mm`);
console.log(`Mass: ${result.spec.estimatedMassG} g ${config.metal}; ${((Date.now() - started) / 1000).toFixed(1)} s`);
