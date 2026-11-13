import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATALOGUE } from "../src/catalogue";
import { renderPendantPresets } from "../src/catalogue/pendant-report";
import { renderUnresolvedDecisions } from "../src/catalogue/report";

const target = resolve(import.meta.dirname, "../../../docs/catalogue-unresolved-decisions.md");
writeFileSync(target, renderUnresolvedDecisions(CATALOGUE));
console.log(`Wrote ${target}`);
const presets = resolve(import.meta.dirname, "../../../docs/pendant-presets.md");
writeFileSync(presets, renderPendantPresets());
console.log(`Wrote ${presets}`);
