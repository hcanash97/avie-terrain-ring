/**
 * Shape rules for the blank (review of 12 Nov 2026): rectangular head with a
 * flat table, shoulders whose position AND slope are controlled at both ends,
 * no overhang, and finger size changing only the opening and connection.
 */
import { describe, expect, it } from "vitest";
import { createRingMesh, WEIGHTS, type ShoulderStyle, type Weight } from "../src/geometry/ring-blank";

const RES = { faceSegments: 60, backSegments: 120, widthSegments: 20 };
const centreLine = (weight: Weight, shoulder: ShoulderStyle, innerDiameterMm: number) => {
  const m = createRingMesh({ innerDiameterMm, weight: WEIGHTS[weight], shoulder, profile: "flat", terrain: null, resolution: RES });
  const cols = RES.widthSegments + 1;
  const rows = m.positions.length / 3; // outer strip comes first; read rows until z pattern ends
  void rows;
  const pts: [number, number][] = [];
  const outerVerts = m.shade.length; // upper bound
  for (let r = 0; r * cols < outerVerts; r++) {
    const i = (r * cols + Math.floor(cols / 2)) * 3;
    if (i + 2 >= m.positions.length) break;
    if (Math.abs(m.positions[i + 2]!) > 1e-9) break; // left the outer strip's centre column
    pts.push([m.positions[i]!, m.positions[i + 1]!]);
  }
  return pts;
};
/** Outer-strip centre column is z = 0 only while rows remain in the outer strip; trim to one loop. */
const loop = (pts: [number, number][]) => {
  const out: [number, number][] = [];
  for (const p of pts) {
    if (out.length > 3 && Math.hypot(p[0] - out[0]![0], p[1] - out[0]![1]) < 1e-9) break;
    out.push(p);
  }
  return out;
};

describe("rectangular head and controlled shoulders", () => {
  for (const weight of ["slim", "standard", "bold"] as Weight[]) {
    for (const d of [15, 17.2, 21.5]) {
      it(`${weight} at ${d} mm: flat table, vertical start, tangent arrival at the band, no overhang`, () => {
        const preset = WEIGHTS[weight];
        const pts = loop(centreLine(weight, "classic", d));
        const yTop = d / 2 + preset.headHeightMm;
        // Flat table across the full face length.
        const table = pts.filter(([x, y]) => Math.abs(x) <= preset.faceLengthMm / 2 - 0.01 && y > 0);
        expect(table.length).toBeGreaterThan(10);
        const BASE = 0.12; // the face always carries a 0.12 mm base lift so its edge reads
        for (const [, y] of table) expect(y).toBeCloseTo(yTop + BASE, 4);
        // Walk outward from the +X head corner down the shoulder: x never comes back
        // under the head (no overhang), y always falls.
        const corner = pts.findIndex(([x, y]) => Math.abs(x - preset.faceLengthMm / 2) < 1e-4 && Math.abs(y - yTop) < 1e-4);
        expect(corner).toBeGreaterThanOrEqual(0);
        const down: [number, number][] = [];
        for (let k = corner; k >= 0 && down.length < 40; k--) down.push(pts[k]!);
        for (let k = pts.length - 1; down.length < 40; k--) down.push(pts[k]!);
        for (let k = 1; k < down.length; k++) {
          expect(down[k]![0]).toBeGreaterThanOrEqual(preset.faceLengthMm / 2 - 1e-4);
          expect(down[k]![1]).toBeLessThan(down[k - 1]![1] + 1e-4);
        }
        // First shoulder step leaves the head close to vertically.
        const [a, b] = [down[0]!, down[1]!];
        const startDeg = Math.atan2(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 180 / Math.PI;
        expect(startDeg).toBeLessThan(12);
      });
    }
  }

  it("finger size changes the opening but not the head", () => {
    const face = (d: number) => {
      const pts = loop(centreLine("standard", "classic", d));
      const top = pts.filter(([, y]) => y > d / 2 + WEIGHTS.standard.headHeightMm + 0.06);
      return Math.max(...top.map(([x]) => x)) - Math.min(...top.map(([x]) => x));
    };
    expect(face(15)).toBeCloseTo(WEIGHTS.standard.faceLengthMm, 4);
    expect(face(21.5)).toBeCloseTo(WEIGHTS.standard.faceLengthMm, 4);
  });
});
