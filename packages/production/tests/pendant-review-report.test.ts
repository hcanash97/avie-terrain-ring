import { expect, it } from "vitest";
import { pendantReviewChecks, pendantReviewOutcome } from "../src/pendant-review-report";

it("distinguishes completed measurements from unperformed checks and acceptance tests", () => {
  const checks = pendantReviewChecks({
    dimensions: { status: "pass", method: "bounds", measured: { x: 20 } },
    volumeAndMass: { status: "pass", method: "volume", measured: 2 },
    minimumWallThickness: { status: "not_run", method: "rays", measured: 0.5 },
    attachmentStrength: { status: "not_run", method: "none" },
    watertight: { status: "pass", method: "edges", measured: 0, required: 0 },
  });
  for (const key of ["dimensions", "volumeAndMass", "minimumWallThickness"])
    expect(checks[key]).toMatchObject({ status: "warn", execution: "completed", assessment: "unassessed" });
  expect(checks.attachmentStrength).toMatchObject({ status: "not_run", execution: "not_run", assessment: "unassessed" });
  expect(checks.watertight).toMatchObject({ status: "pass", assessment: "assessed" });
});

it("never passes a failed reimport or a geometry failure", () => {
  expect(pendantReviewOutcome(true, false, [])).toMatchObject({ valid: false, status: "fail", errors: [{ code: "EXPORT_REIMPORT_FAILED" }] });
  const error = { code: "BOUNDARY", message: "Open edges" };
  expect(pendantReviewOutcome(false, true, [error])).toMatchObject({ valid: false, status: "fail", errors: [error] });
  expect(pendantReviewOutcome(true, true, [])).toMatchObject({ valid: true, status: "held_for_review" });
});
