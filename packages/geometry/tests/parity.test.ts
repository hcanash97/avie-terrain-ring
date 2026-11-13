import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

/**
 * Evidence of the previous representation, terra-ring/full-width-shoulders.
 * The file was recorded when the inner centre column was still the cancellation
 * -h + (2*h*6)/12. Those hashes belong to the environment that wrote the file.
 * They are not the expected output of the current generator, and they are not
 * asserted on Linux x64 or macOS arm64: the cancellation residual is not stable
 * across those two, so a live equality check would fail on one of them.
 * The corrected buffers are checked against centre-plane-zero.json.
 */
const FILE = "packages/geometry/tests/fixtures/pre-extraction.json";
const HISTORICAL_SHA256 =
  "f606bb0024914cfc02100b83705d83eec3aee6a907ec05e09a7d098a9e309506";

it("retains the full-width-shoulders fixture unchanged as evidence", () => {
  const bytes = readFileSync(FILE);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    HISTORICAL_SHA256,
  );
  const baseline = JSON.parse(bytes.toString("utf8")) as {
    sourceCommit: string;
    cases: Record<string, unknown>;
  };
  expect(baseline.sourceCommit).toBe("full-width-shoulders");
  expect(Object.keys(baseline.cases)).toHaveLength(486);
});
