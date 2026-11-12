// Run only to re-record the parity baseline after an INTENTIONAL geometry change:
//   REGENERATE_BASELINE=slim-profile npx vitest run packages/geometry/tests/regenerate-baseline.test.ts
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { cases, measure } from "./fixtures/cases";

it.skipIf(!process.env.REGENERATE_BASELINE)("re-records the parity baseline", () => {
  const out: Record<string, ReturnType<typeof measure>> = {};
  for (const c of cases()) out[c.key] = measure(c);
  writeFileSync(
    "packages/geometry/tests/fixtures/pre-extraction.json",
    JSON.stringify({ sourceCommit: process.env.REGENERATE_BASELINE, cases: out }),
  );
}, 120000);
