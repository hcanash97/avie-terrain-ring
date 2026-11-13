// Investigation only: copied into the subject checkout, never changes its baseline.
import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { cases, measure, baselineResolution } from "./fixtures/cases";
import { generateTerrainRingPreview } from "../src/products/terrain-ring/adapter";
import { weldedNormals } from "../src/products/terrain-ring/geometry";

it("captures all raw buffers and two repeated exact measurements without changing acceptance", () => {
  const out = process.env.PARITY_DIAGNOSTICS_OUT!;
  mkdirSync(out, { recursive: true });
  const digest = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
  const files = execFileSync("git", ["ls-files", "packages/geometry", "packages/terrain", "package-lock.json", "terrain-ring/package-lock.json", "vitest.config.ts"]).toString().trim().split("\n");
  const baseline = JSON.parse(readFileSync("packages/geometry/tests/fixtures/pre-extraction.json", "utf8"));
  const rows = [];
  for (const [i, c] of Array.from(cases()).entries()) {
    const first = measure(c), second = measure(c);
    const { mesh, terrain } = generateTerrainRingPreview({ ...c.parameters, source: c.source, lengthM: c.area.lengthM, bearingDeg: c.bearingDeg, terrainHeight: c.height, detail: c.detail, flat: c.flat, resolution: baselineResolution });
    const buffers = { positions: mesh.positions, indices: mesh.indices, normals: weldedNormals(mesh), terrainBlend: mesh.terrainBlend, shade: mesh.shade, terrain: terrain.data, ...(mesh.surfaceLabels ? { surfaceLabels: mesh.surfaceLabels } : {}) };
    const raw = Object.fromEntries(Object.entries(buffers).map(([key, array]) => [key, { type: array.constructor.name, length: array.length, bytes: Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64") }]));
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < mesh.positions.length; k++) { const a = k % 3; min[a] = Math.min(min[a]!, mesh.positions[k]!); max[a] = Math.max(max[a]!, mesh.positions[k]!); }
    const different = Object.keys(first).filter(k => JSON.stringify(first[k as keyof typeof first]) !== JSON.stringify(baseline.cases[c.key][k]));
    rows.push({ index: i, key: c.key, first, second, different, repeatIdentical: JSON.stringify(first) === JSON.stringify(second), bounds: { min, max }, inputs: { parameters: c.parameters, area: c.area, detail: c.detail, height: c.height, flat: c.flat } });
    writeFileSync(join(out, `${i}.json.gz`), gzipSync(JSON.stringify({ key: c.key, raw })));
  }
  const versions = Object.fromEntries(["vitest", "vite", "typescript", "tsx", "manifold-3d"].map(name => {
    const locations = [`node_modules/${name}/package.json`, `packages/geometry/node_modules/${name}/package.json`];
    for (const path of locations) { try { const p = JSON.parse(readFileSync(path, "utf8")); return [name, { version: p.version, path: realpathSync(path) }]; } catch {} }
    return [name, null];
  }));
  const env = Object.fromEntries(["CI", "NODE_ENV", "NODE_OPTIONS", "TZ", "LANG", "LC_ALL", "UV_THREADPOOL_SIZE", "VITEST", "MODE", "VITE_USER_NODE_ENV"].map(k => [k, process.env[k] ?? null]));
  const summary = { commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(), node: process.version, versions: process.versions, npm: execFileSync("npm", ["--version"]).toString().trim(), arch: process.arch, platform: process.platform, cwd: process.cwd(), env, dependencies: versions, sourceHashes: Object.fromEntries(files.map(p => [p, digest(readFileSync(p))])), rows };
  writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ commit: summary.commit, cases: rows.length, baselineMismatches: rows.filter(r => r.different.length).length, unstableRepeats: rows.filter(r => !r.repeatIdentical).length }));
  expect(rows).toHaveLength(486);
}, 300000);
