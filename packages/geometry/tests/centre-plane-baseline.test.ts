import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { cases, measure } from "./fixtures/cases";

/**
 * Expected buffers for terra-ring/centre-plane-zero.
 * The inner centre column is positive zero by construction index.
 * This is not a claim that every bit of pre-extraction.json is preserved.
 * pre-extraction.json remains the evidence of the previous representation.
 */
const baseline = JSON.parse(
  readFileSync(
    "packages/geometry/tests/fixtures/centre-plane-zero.json",
    "utf8",
  ),
) as {
  algorithm: string;
  previousRepresentation: string;
  historicalFixture: string;
  cases: Record<string, ReturnType<typeof measure>>;
};

it("matches the centre-plane buffers across 486 cases", () => {
  const variants = Array.from(cases());
  expect(baseline.algorithm).toBe("terra-ring/centre-plane-zero");
  expect(baseline.previousRepresentation).toBe(
    "terra-ring/full-width-shoulders",
  );
  expect(baseline.historicalFixture).toBe("pre-extraction.json");
  expect(variants).toHaveLength(486);
  expect(Object.keys(baseline.cases)).toHaveLength(variants.length);
  for (const c of variants)
    expect(measure(c), c.key).toEqual(baseline.cases[c.key]);
}, 120000);
