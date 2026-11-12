import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { cases, measure } from "./fixtures/cases";
const baseline = JSON.parse(
  readFileSync("packages/geometry/tests/fixtures/pre-extraction.json", "utf8"),
) as {
  sourceCommit: string;
  cases: Record<string, ReturnType<typeof measure>>;
};
it("preserves the approved geometry buffers across 486 cases", () => {
  const variants = Array.from(cases());
  expect(variants).toHaveLength(486);
  expect(Object.keys(baseline.cases)).toHaveLength(variants.length);
  // Re-recorded after the intentional full-width shoulder boundary change.
  expect(baseline.sourceCommit).toBe("full-width-shoulders");
  for (const c of variants)
    expect(measure(c), c.key).toEqual(baseline.cases[c.key]);
}, 60000);
