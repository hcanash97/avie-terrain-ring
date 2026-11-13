// The historical fixture packages/geometry/tests/fixtures/pre-extraction.json
// is frozen evidence of terra-ring/full-width-shoulders. Do not rewrite it.
// To re-record the corrected buffers after a further intentional change:
//   REGENERATE_CENTRE_PLANE_BASELINE=1 npx vitest run packages/geometry/tests/regenerate-baseline.test.ts
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { cases, measure } from "./fixtures/cases";

it("does not regenerate the historical full-width-shoulders fixture", () => {
  if (process.env.REGENERATE_BASELINE) {
    throw new Error(
      "pre-extraction.json is frozen evidence of terra-ring/full-width-shoulders and is not rewritten. Set REGENERATE_CENTRE_PLANE_BASELINE=1 to record terra-ring/centre-plane-zero instead.",
    );
  }
});

it.skipIf(!process.env.REGENERATE_CENTRE_PLANE_BASELINE)(
  "re-records the centre-plane baseline",
  () => {
    const out: Record<string, ReturnType<typeof measure>> = {};
    for (const c of cases()) out[c.key] = measure(c);
    writeFileSync(
      "packages/geometry/tests/fixtures/centre-plane-zero.json",
      JSON.stringify({
        algorithm: "terra-ring/centre-plane-zero",
        previousRepresentation: "terra-ring/full-width-shoulders",
        historicalFixture: "pre-extraction.json",
        note: "Expected buffers after the inner centre column was set to +0 at construction index 6. This does not preserve every historical bit.",
        cases: out,
      }),
    );
  },
  120000,
);
