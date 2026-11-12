import { describe, expect, it } from "vitest";
import { createRingMesh, WEIGHTS, type ShoulderStyle, type Weight } from "../src/geometry/ring-blank";
const RES = { faceSegments: 60, backSegments: 240, widthSegments: 40 };
const centreLine = (weight: Weight, shoulder: ShoulderStyle, d: number) => {
  const mesh = createRingMesh({ innerDiameterMm: d, weight: WEIGHTS[weight], shoulder, profile: "flat", terrain: null, resolution: RES });
  const shoulderSteps = Math.max(8, Math.round(RES.backSegments * .28));
  const rows = RES.faceSegments + 1 + 2 + 2 * (shoulderSteps - 1) + Math.max(12, RES.backSegments - 2 * shoulderSteps) + 1;
  return Array.from({length: rows}, (_, row) => {
    const i = (row * (RES.widthSegments + 1) + RES.widthSegments / 2) * 3;
    return [mesh.positions[i]!, mesh.positions[i + 1]!] as [number, number];
  });
};

describe("width-led, smoothly joined shoulders", () => {
  for (const weight of ["slim", "standard", "bold"] as Weight[]) for (const d of [15,17.2,21.5]) for (const style of ["straight","classic","curved"] as ShoulderStyle[]) {
    it(`${weight}/${style} at ${d}: flat face and near-horizontal departure`, () => {
      const pts = centreLine(weight, style, d), preset = WEIGHTS[weight];
      for (const [,y] of pts.slice(0, RES.faceSegments + 1)) expect(y).toBeCloseTo(d / 2 + preset.headHeightMm, 4);
      // Negative-X face end, duplicate wall row, first actual shoulder row.
      const a = pts[RES.faceSegments + 1]!, b = pts[RES.faceSegments + 2]!;
      const angle = Math.atan2(Math.abs(b[1]-a[1]),Math.abs(b[0]-a[0])) * 180 / Math.PI;
      expect(angle).toBeLessThan(8);
      expect(Math.abs(b[0])).toBeGreaterThan(preset.faceLengthMm / 2);
      // The advertised face dimensions are independent of the ring opening.
      expect(pts[0]![0] - pts[RES.faceSegments]![0]).toBeCloseTo(preset.faceLengthMm, 4);
    });
  }
  it("face size changes width without automatically increasing substrate or band thickness", () => {
    expect(new Set(Object.values(WEIGHTS).map(w=>w.bandThicknessMm)).size).toBe(1);
    expect(new Set(Object.values(WEIGHTS).map(w=>w.headHeightMm)).size).toBe(1);
    expect(WEIGHTS.bold.bandWidthMm).toBeGreaterThan(WEIGHTS.slim.bandWidthMm);
  });
});
