/**
 * Pure terrain-grid operations. Grids are row-major (index = row * cols + col).
 * Row 0 is the top of the map frame; col 0 its left edge.
 */

/** Anything that can report ground elevation (metres) at an offset from the centre. */
export type TerrainSource = {
  /** east/north offsets in metres from the selected centre point. */
  elevationAt: (eastM: number, northM: number) => number;
  /** Largest offset (metres) the source covers reliably. */
  radiusM: number;
};

export type FrameArea = {
  /** Ground distance along the long side of the frame (face length). */
  lengthM: number;
  /** Ground distance along the short side (face width). */
  widthM: number;
  /** Compass direction the top of the frame points to, degrees clockwise from north. */
  bearingDeg: number;
};

export function minMax(data: Float32Array): [number, number] {
  // Not Math.min(...data): that overflows the call stack on large grids.
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/** Map to 0..1 with the lowest point at 0. Flat input maps to zeros. */
export function normalise(data: Float32Array): Float32Array {
  const [min, max] = minMax(data);
  const range = max - min;
  const out = new Float32Array(data.length);
  if (range <= 0) return out;
  for (let i = 0; i < data.length; i++) out[i] = (data[i]! - min) / range;
  return out;
}

/**
 * Sample the source on a cols × rows grid covering the (possibly rotated) frame.
 * u (cols) runs left→right, v (rows) top→bottom of the frame.
 */
export function sampleFrame(
  source: TerrainSource,
  area: FrameArea,
  cols: number,
  rows: number,
): Float32Array {
  const b = (area.bearingDeg * Math.PI) / 180;
  // Unit vectors (east, north) for the frame's "up" and "right" directions.
  const upE = Math.sin(b),
    upN = Math.cos(b);
  const rightE = Math.cos(b),
    rightN = -Math.sin(b);
  const out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const fy = (0.5 - r / (rows - 1)) * area.widthM; // + is toward the top
    for (let c = 0; c < cols; c++) {
      const fx = (c / (cols - 1) - 0.5) * area.lengthM; // + is to the right
      out[r * cols + c] = source.elevationAt(
        fx * rightE + fy * upE,
        fx * rightN + fy * upN,
      );
    }
  }
  return out;
}

/** Separable Gaussian blur with radius sigma (grid cells). */
export function blur(
  data: Float32Array,
  cols: number,
  rows: number,
  sigma: number,
): Float32Array {
  if (sigma < 0.3) return data;
  const radius = Math.ceil(sigma * 2.5);
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i]! /= sum;
  const cx = (x: number) => (x < 0 ? 0 : x >= cols ? cols - 1 : x);
  const cy = (y: number) => (y < 0 ? 0 : y >= rows ? rows - 1 : y);
  const tmp = new Float32Array(data.length);
  const out = new Float32Array(data.length);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++)
        acc += data[y * cols + cx(x + k)]! * kernel[k + radius]!;
      tmp[y * cols + x] = acc;
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++)
        acc += tmp[cy(y + k) * cols + x]! * kernel[k + radius]!;
      out[y * cols + x] = acc;
    }
  }
  return out;
}

/** Bilinear sample at u, v in 0..1. */
export function sampleBilinear(
  data: Float32Array,
  cols: number,
  rows: number,
  u: number,
  v: number,
): number {
  const fx = Math.min(1, Math.max(0, u)) * (cols - 1);
  const fy = Math.min(1, Math.max(0, v)) * (rows - 1);
  const x0 = Math.floor(fx),
    y0 = Math.floor(fy);
  const x1 = Math.min(cols - 1, x0 + 1),
    y1 = Math.min(rows - 1, y0 + 1);
  const tx = fx - x0,
    ty = fy - y0;
  const a = data[y0 * cols + x0]!,
    b = data[y0 * cols + x1]!;
  const c = data[y1 * cols + x0]!,
    d = data[y1 * cols + x1]!;
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/** Deterministic synthetic mountains for offline use and tests. */
export function createDemoSource(): TerrainSource {
  return {
    radiusM: 50000,
    elevationAt: (e, n) => {
      const u = e / 3000,
        v = n / 3000;
      const peak = Math.exp(-((u - 0.2) ** 2 + (v + 0.1) ** 2) / 0.08) * 900;
      const ridge = Math.exp(-((u + v * 0.6 + 0.3) ** 2) / 0.03) * 400;
      const texture =
        Math.sin(u * 23 + Math.cos(v * 9)) * 40 + Math.cos(v * 31 - u * 7) * 25;
      return 300 + peak + ridge + texture;
    },
  };
}

/** Range-weighted smoothing for high detail. Each output is a convex average:
 * no sharpening, overshoot, or invented peaks. Two separable passes bound cost.
 * This preserves strong elevation transitions; it cannot recover source detail.
 */
export function edgeAwareBlur(
  data: Float32Array,
  cols: number,
  rows: number,
  sigma: number,
): Float32Array {
  if (sigma < 0.3) return data;
  const [lo, hi] = minMax(data),
    rangeSigma = (hi - lo) * 0.03;
  if (!(rangeSigma > 0)) return data.slice();
  const radius = Math.ceil(sigma * 2.5),
    spatial = Array.from({ length: radius * 2 + 1 }, (_, i) =>
      Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)),
    );
  const pass = (input: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(data.length);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const centre = input[y * cols + x]!;
        let total = 0,
          sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = horizontal ? Math.max(0, Math.min(cols - 1, x + k)) : x;
          const yy = horizontal ? y : Math.max(0, Math.min(rows - 1, y + k));
          const v = input[yy * cols + xx]!,
            difference = (v - centre) / rangeSigma;
          const weight =
            spatial[k + radius]! * Math.exp((-difference * difference) / 2);
          sum += v * weight;
          total += weight;
        }
        out[y * cols + x] = sum / total;
      }
    return out;
  };
  return pass(pass(data, true), false);
}
