import {
  facePreset,
  meshVolume,
  openEdgeCount,
  weldedNormals,
} from "../../src/products/terrain-ring/geometry";
import { frameFor } from "@avie/terrain/processing";
import { createDemoSource, type TerrainSource } from "@avie/terrain/heightmap";
import { generateTerrainRingPreview } from "../../src/products/terrain-ring/adapter";
import { createHash } from "node:crypto";
export const baselineResolution = {
  cols: 48,
  faceSegments: 40,
  backSegments: 72,
  widthSegments: 32,
};
const hash = (a: Float32Array | Uint32Array) =>
  createHash("sha256")
    .update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))
    .digest("hex");
const sources: Record<string, TerrainSource> = {
  flat: { radiusM: 100000, elevationAt: () => 200 },
  ramp: { radiusM: 100000, elevationAt: (e, n) => 400 + e * 0.1 + n * 0.04 },
  mountain: createDemoSource(),
};
export function* cases() {
  let n = 0;
  for (const shape of ["bar", "cushion"] as const)
    for (const weight of ["slim", "standard", "bold"] as const)
      for (const diameter of [15, 17.2, 21.5])
        for (const shoulder of ["straight", "classic", "curved"] as const)
          for (const profile of ["flat", "classic", "d_shape"] as const)
            for (const fixture of Object.keys(sources)) {
              const detail = (["low", "medium", "high"] as const)[n % 3]!,
                bearingDeg = [0, 37, 125][Math.floor(n / 3) % 3]!,
                height = [0.05, 0.7, 1][Math.floor(n / 9) % 3]!;
              const preset = facePreset(weight, shape),
                area = frameFor(5000, bearingDeg, preset);
              yield {
                key: [
                  shape,
                  weight,
                  diameter,
                  shoulder,
                  profile,
                  fixture,
                  detail,
                  bearingDeg,
                  height,
                ].join("/"),
                source: sources[fixture]!,
                preset,
                area,
                detail,
                bearingDeg,
                height,
                parameters: {
                  innerDiameterMm: diameter,
                  weight: preset,
                  shoulder,
                  profile,
                  resolution: baselineResolution,
                },
                flat: fixture === "flat",
              };
              n++;
            }
}
export function measure(
  c: ReturnType<typeof cases> extends Generator<infer T> ? T : never,
) {
  const { terrain, mesh } = generateTerrainRingPreview({
    ...c.parameters,
    source: c.source,
    lengthM: c.area.lengthM,
    bearingDeg: c.bearingDeg,
    terrainHeight: c.height,
    detail: c.detail,
    flat: c.flat,
    resolution: baselineResolution,
  });
  return {
    positions: hash(mesh.positions),
    indices: hash(mesh.indices),
    normals: hash(weldedNormals(mesh)),
    terrainBlend: hash(mesh.terrainBlend),
    shade: hash(mesh.shade),
    terrain: hash(terrain.data),
    reliefMm: terrain.reliefMm,
    exaggeration: terrain.exaggeration,
    rangeM: terrain.rangeM,
    volumeMm3: meshVolume(mesh),
    openEdges: openEdgeCount(mesh),
    triangles: mesh.triangleCount,
    faceTriangleCount: mesh.faceTriangleCount,
    terrainAdapted: mesh.terrainAdapted,
  };
}
