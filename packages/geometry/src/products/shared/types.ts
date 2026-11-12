export type TerrainProductMesh = {
  positions: Float32Array;
  indices: Uint32Array;
  /** Per-vertex shade 0..1 (1 = untouched). Currently all 1: valley darkening is disabled. */
  shade: Float32Array;
  /** The first faceTriangleCount triangles in `indices` are the terrain face (its own finish zone). */
  faceTriangleCount: number;
  triangleCount: number;
  /** Continuous terrain-finish weight, fading into polished shoulders. */
  terrainBlend: Float32Array;
  terrainAdapted: boolean;
};
