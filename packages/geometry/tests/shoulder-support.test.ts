import { describe, expect, it } from "vitest";
import {
  createRingMesh,
  facePreset,
  meshVolume,
  openEdgeCount,
} from "../src/products/terrain-ring/geometry";

// Side-view regression: rounded face corners used to project beyond the narrow
// flat-end shoulder. Check actual vertices, independent of material/normals.
describe("full-width terrain-to-shoulder support", () => {
  for (const shape of ["bar", "cushion"] as const)
    for (const size of ["slim", "standard", "bold"] as const)
      for (const shoulder of ["straight", "classic", "curved"] as const)
        it(`${shape}/${size}/${shoulder} supports the face with flat and steep terrain`, () => {
          for (const diameter of [15, 17.2, 21.5])
            for (const steep of [false, true]) {
              const weight = facePreset(size, shape);
              const resolution = {
                faceSegments: 60,
                backSegments: 120,
                widthSegments: 80,
              };
              const data = new Float32Array(32 * 32);
              for (let r = 0; r < 32; r++)
                for (let c = 0; c < 32; c++)
                  data[r * 32 + c] = (c / 31) * (r / 31);
              const mesh = createRingMesh({
                innerDiameterMm: diameter,
                weight,
                shoulder,
                profile: "classic",
                resolution,
                terrain: steep
                  ? { data, cols: 32, rows: 32, reliefMm: weight.maxReliefMm }
                  : null,
              });
              const columns = resolution.widthSegments + 1;
              const width = (row: number) =>
                mesh.positions[(row * columns + columns - 1) * 3 + 2]! -
                mesh.positions[row * columns * 3 + 2]!;
              // End row and immediately adjacent shoulder must span the whole
              // face. This fails on the former (W − 2×cornerRadius) connection.
              expect(width(resolution.faceSegments)).toBeCloseTo(
                weight.faceWidthMm,
                5,
              );
              expect(width(resolution.faceSegments + 1)).toBeCloseTo(
                weight.faceWidthMm,
                5,
              );
              expect(width(resolution.faceSegments + 2)).toBeGreaterThan(
                weight.faceWidthMm - 0.06,
              );
              const steps = Math.max(
                8,
                Math.round(resolution.backSegments * 0.28),
              );
              let last = weight.faceWidthMm;
              for (
                let row = resolution.faceSegments + 2;
                row <= resolution.faceSegments + steps;
                row++
              ) {
                const current = width(row);
                expect(current).toBeLessThanOrEqual(last + 1e-5);
                last = current;
              }
              expect(openEdgeCount(mesh)).toBe(0);
              expect(meshVolume(mesh)).toBeGreaterThan(0);
            }
        });
});
