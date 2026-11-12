import { expect, it } from "vitest";
import { createRingMesh, facePreset, meshVolume, openEdgeCount, type ShoulderStyle } from "../src/geometry/ring-blank";

// Compare actual one-sided surface tangents, rather than smoothed normals:
// smoothing can conceal the geometric kink this regression is intended to catch.
for (const shape of ["bar", "cushion"] as const) {
  for (const shoulder of ["straight", "classic", "curved"] as ShoulderStyle[]) {
    it(`${shape}/${shoulder}: rounded shoulder edges follow the wall tangent`, () => {
      const res = { faceSegments: 60, backSegments: 120, widthSegments: 160 };
      const mesh = createRingMesh({ innerDiameterMm: 17.2, weight: facePreset("standard", shape), shoulder, profile: "classic", terrain: null, resolution: res });
      const outerCols = res.widthSegments + 1, innerCols = 13, wallCols = 13;
      const rows = mesh.positions.length / 3 / (outerCols + innerCols + wallCols * 2);
      const point = (vertex: number) => Array.from(mesh.positions.slice(vertex * 3, vertex * 3 + 3));
      const shoulderSteps = Math.max(8, Math.round(res.backSegments * .28));
      let worst = 0;
      // First shoulder, avoiding the intentional face/terrain perimeter.
      for (let row = res.faceSegments + 2; row < res.faceSegments + 1 + shoulderSteps; row++) {
        for (const side of [1, -1]) {
          const edge = row * outerCols + (side === 1 ? outerCols - 1 : 0);
          const inside = edge - side;
          const wallBase = rows * (outerCols + innerCols) + (side === 1 ? 0 : rows * wallCols);
          const a = point(inside), b = point(edge), c = point(wallBase + row * wallCols + wallCols - 3);
          const u = b.map((x, k) => x - a[k]!), v = c.map((x, k) => x - b[k]!);
          const dot = u.reduce((sum, x, k) => sum + x * v[k]!, 0) / (Math.hypot(...u) * Math.hypot(...v));
          const angle = Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI;
          worst = Math.max(worst, angle);
        }
      }
      expect(worst).toBeLessThan(15);
      expect(openEdgeCount(mesh)).toBe(0);
      expect(meshVolume(mesh)).toBeGreaterThan(0);
    });
  }
}
