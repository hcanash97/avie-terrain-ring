/** Smooth 0→1 ramp (Hermite). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Edge mask at (u, v) in 0..1: 0 on the border of the terrain window, rising
 * smoothly to 1 at `width` (fraction of the window) in from each edge, so the
 * landscape settles into the plain face instead of ending in a cliff.
 */
export function edgeFalloffAt(u: number, v: number, width = 0.12): number {
  const d = Math.min(u, 1 - u, v, 1 - v);
  if (d <= 0) return 0;
  return smoothstep(0, width, d);
}

/** Grid version of the mask (row-major, size × size). */
export function createEdgeFalloff(size: number, width = 0.12): Float32Array {
  const mask = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      mask[y * size + x] = edgeFalloffAt(x / (size - 1), y / (size - 1), width);
    }
  }
  return mask;
}
