import type { validation } from "@avie/geometry";

/** Pendant-only reporting: shared ring validation and its outputs stay unchanged. */
export type PendantReviewCheck = validation.Check & { execution: "completed" | "not_run"; assessment: "unassessed" | "assessed" };
export function pendantReviewChecks(checks: Record<string, validation.Check>): Record<string, PendantReviewCheck> {
  return Object.fromEntries(Object.entries(checks).map(([key, check]) => {
    const measurementOnly = (key === "dimensions" || key === "volumeAndMass") && check.required === undefined && check.status === "pass";
    const measuredWithoutLimit = check.status === "not_run" && check.measured !== undefined;
    return [key, {
      ...check,
      ...(measurementOnly || measuredWithoutLimit ? { status: "warn" as const } : {}),
      execution: check.measured !== undefined || check.status !== "not_run" ? "completed" as const : "not_run" as const,
      assessment: measurementOnly || measuredWithoutLimit || check.status === "not_run" ? "unassessed" as const : "assessed" as const,
      ...(measurementOnly ? { note: "Measured only; no approved acceptance range is available." } : {}),
    }];
  }));
}

/** Fail closed on any missing/false round-trip assertion, without claiming release readiness. */
export function pendantReviewOutcome(geometryValid: boolean, reopenPassed: boolean, errors: validation.ValidationError[]) {
  return {
    valid: geometryValid && reopenPassed,
    status: geometryValid && reopenPassed ? "held_for_review" as const : "fail" as const,
    errors: [...errors, ...(!reopenPassed ? [{ code: "EXPORT_REIMPORT_FAILED", message: "Exported files failed one or more round-trip integrity checks." }] : [])],
  };
}
