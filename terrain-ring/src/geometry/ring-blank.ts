/**
 * Parametric landscape signet ring (pure, no Three.js dependency).
 *
 * Coordinate system (millimetres): finger axis Z, ring circle in the XY plane,
 * head at +Y. On the face the top of the map points to −Z (toward the
 * fingertip) and the map's right-hand side to +X.
 *
 * The ring is assembled from separately defined parts, all in physical units:
 *   1. Inner surface: circle of the finger size (comfort dome and rounded edges).
 *   2. Band cross-section: width, thickness and profile (flat / comfort / D).
 *   3. Head: a rectangular block, exactly faceLength × faceWidth, with a flat
 *      table at innerRadius + headHeight. The landscape is displaced straight up
 *      on the table; boundary ridges continue through a short shoulder collar.
 *   4. Shoulders: cubic Hermite curves that control both position AND tangent
 *      at each end: they leave the terrain base heading outward and
 *      arrive at the band along the band's own tangent, so there is no slope
 *      break. Width eases from the face width to the band width.
 * Changing the finger size rebuilds the opening and the shoulder connection; the
 * head, band and edge dimensions stay fixed. Nothing is scaled.
 */
import { sampleBilinear } from "./heightmap";

export type Weight = "slim" | "standard" | "bold";
export type ShoulderStyle = "straight" | "classic" | "curved";
export type BandProfile = "flat" | "classic" | "d_shape";
export type HeadShape = "bar" | "cushion";

export type WeightPreset = {
  label: string;
  faceLengthMm: number;
  faceWidthMm: number;
  headHeightMm: number;
  bandWidthMm: number;
  bandThicknessMm: number;
  maxReliefMm: number;
  /** Plan-view corner radius of the head footprint. */
  cornerRadiusMm: number;
};

export const WEIGHTS: Record<Weight, WeightPreset> = {
  // Width-led presets: substrate height and band thickness are shared. Terrain
  // provides the remaining height; cross-section clearance is checked separately.
  slim: { label: "Slim", faceLengthMm: 12, faceWidthMm: 5.5, headHeightMm: 1.2, bandWidthMm: 2.4, bandThicknessMm: 1.5, maxReliefMm: 2.0, cornerRadiusMm: 0.8 },
  standard: { label: "Standard", faceLengthMm: 13, faceWidthMm: 7.5, headHeightMm: 1.2, bandWidthMm: 3.0, bandThicknessMm: 1.5, maxReliefMm: 2.4, cornerRadiusMm: 1.0 },
  bold: { label: "Bold", faceLengthMm: 14, faceWidthMm: 10, headHeightMm: 1.2, bandWidthMm: 4.0, bandThicknessMm: 1.5, maxReliefMm: 2.8, cornerRadiusMm: 1.2 }
};

/** Cushion (rounded-square) heads: same band and head height per size, broader face, larger corners. */
const CUSHION: Record<Weight, Pick<WeightPreset, "faceLengthMm" | "faceWidthMm" | "cornerRadiusMm">> = {
  slim: { faceLengthMm: 10.5, faceWidthMm: 9.5, cornerRadiusMm: 2.5 },
  standard: { faceLengthMm: 12, faceWidthMm: 11, cornerRadiusMm: 3 },
  bold: { faceLengthMm: 14, faceWidthMm: 13, cornerRadiusMm: 3.5 }
};

export const HEAD_SHAPES: Record<HeadShape, string> = { bar: "Bar", cushion: "Cushion" };

/** The physical preset for a face size and head shape. Use this everywhere dimensions matter. */
export function facePreset(weight: Weight, shape: HeadShape): WeightPreset {
  return shape === "bar" ? WEIGHTS[weight] : { ...WEIGHTS[weight], ...CUSHION[weight] };
}

export type TerrainInput = {
  /** cols × rows grid of 0..1 heights. cols run along the face length (west→east). */
  data: Float32Array;
  cols: number;
  rows: number;
  reliefMm: number;
};

export type RingParameters = {
  innerDiameterMm: number;
  weight: WeightPreset;
  shoulder: ShoulderStyle;
  profile: BandProfile;
  terrain: TerrainInput | null;
  constraints?: { minHeadRadialMm?: number; minBandRadialMm?: number };
  resolution: { faceSegments: number; backSegments: number; widthSegments: number };
};

export type RingMesh = {
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

/** No universal pedestal lift: the support surface supplies the substrate. */
const BLOCK_BASE_MM = 0;
/** Long edges of the head top: small, controlled rounding that keeps the perimeter readable. */
const HEAD_EDGE_RADIUS_MM = 0.15;
/** Band and lower shoulder edges: soft, polished. */
const BAND_EDGE_RADIUS_MM = 0.30;
const INNER_EDGE_RADIUS_MM = 0.25;
/**
 * Head-to-shoulder blend (one continuous width field, no attached block):
 *   - HEAD_WALL_MM: the head keeps its full footprint for this depth under the
 *     table, so the terrain perimeter stays a crisp, readable edge.
 *   - HEAD_TAPER_MM: below that, the side walls taper smoothly into the shoulder
 *     width over this height (no underside shelf, so no notches at the arch).
 *   - END_BLEND_MM: beyond each end of the face the head width eases into the
 *     shoulder over this distance (no near-vertical end face, so no crease).
 */
const HEAD_WALL_MM = 0.35;
const HEAD_TAPER_MM = 2.2;
const END_BLEND_MM = 2.4;
/** Interior columns on each side wall, so walls follow the blend's curves exactly. */
const SIDE_WALL_STEPS = 10;
const COMFORT_MM = 0.12;

const smootherstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * Shoulder styles, defined by the side-profile tangents and how the width eases.
 *   span: angle (rad) from the head corner to where the shoulder joins the band.
 *   startTangent / endTangent: Hermite tangent lengths as multiples of the chord.
 *   width(t): 0 at the head → 1 at the band.
 */
const SHOULDERS: Record<ShoulderStyle, { span: number; startTangent: number; endTangent: number; width: (t: number) => number }> = {
  // Shorter start tangents turn the shoulder outward sooner, so less vertical wall shows under the head.
  straight: { span: 0.58, startTangent: 0.5, endTangent: 0.8, width: easedLinear },
  classic: { span: 0.62, startTangent: 0.6, endTangent: 1.0, width: (t) => smootherstep(t) ** 1.6 }, // broad, then eases in
  curved: { span: 0.72, startTangent: 0.75, endTangent: 0.7, width: (t) => smootherstep(t) ** 0.8 }
};

/** Straight in the middle, zero width derivative at both ends. */
export function easedLinear(t: number): number {
  const u = Math.max(0, Math.min(1, t)), ease = 0.18;
  if (u < ease) return u * u / (2 * ease * (1 - ease));
  if (u > 1 - ease) return 1 - (1 - u) ** 2 / (2 * ease * (1 - ease));
  return (u - ease / 2) / (1 - ease);
}

/** Boundary-height and outward-slope continuation, fading to zero with zero slope.
 * The derivative limiter prevents a steep edge valley from creating an undercut.
 * Input is already rotated geographic terrain; no invented or random veins.
 */
export function terrainCollar(terrain: TerrainInput | null, length: number, width: number, side: 1 | -1, z: number, distance: number, collarLength: number) {
  const sample = (x: number) => BLOCK_BASE_MM + (terrain ? sampleBilinear(terrain.data, terrain.cols, terrain.rows, x / length + 0.5, z / width + 0.5) * terrain.reliefMm : 0);
  const height = sample(side * length / 2);
  const probe = Math.min(0.12, length / 20);
  const slope = (height - sample(side * (length / 2 - probe))) / probe;
  const tangent = Math.max(-3 * height, Math.min(3 * height, slope * collarLength));
  const u = Math.max(0, Math.min(1, distance / collarLength));
  const lift = height * (2 * u ** 3 - 3 * u * u + 1) + tangent * (u ** 3 - 2 * u * u + u);
  return { lift: Math.max(0, lift), blend: 1 - smootherstep(u), slopeLimited: Math.abs(tangent - slope * collarLength) > 1e-6 };
}

type Vec3 = [number, number, number];
/**
 * A cross-section. kind: "face" (terrain), "wall" (bare head at a face end),
 * "shoulder" (Hermite parameter t, side σ = +1 for +X), "band" (angle).
 */
type Row =
  | { kind: "face"; x: number; alpha: number }
  | { kind: "wall"; side: 1 | -1; alpha: number }
  | { kind: "shoulder"; side: 1 | -1; t: number; alpha: number }
  | { kind: "band"; alpha: number };

export function createRingMesh(p: RingParameters): RingMesh {
  const w = p.weight;
  const L = w.faceLengthMm;
  const W = w.faceWidthMm;
  const rIn = p.innerDiameterMm / 2;
  const yTop = rIn + Math.max(w.headHeightMm, (p.constraints?.minHeadRadialMm ?? 1.0) + HEAD_EDGE_RADIUS_MM);
  const shoulder = SHOULDERS[p.shoulder];
  const cornerAngle = Math.atan2(L / 2, yTop);
  const bandAngle = cornerAngle + shoulder.span; // where shoulder meets band (varies with finger size)

  // --- 1. Inner surface ---------------------------------------------------
  const innerRadius = (z: number, h: number) => {
    const comfort = p.profile === "classic" ? COMFORT_MM * (z / h) ** 2 : 0;
    const rr = Math.min(INNER_EDGE_RADIUS_MM, h * 0.3);
    const e = Math.abs(z) - (h - rr);
    return rIn + comfort + (e > 0 ? rr - Math.sqrt(Math.max(0, rr * rr - e * e)) : 0);
  };

  // --- 2. Band cross-section ----------------------------------------------
  const bandHalf = w.bandWidthMm / 2;
  const minimumBand = p.constraints?.minBandRadialMm ?? 0.7;
  if (w.bandThicknessMm < minimumBand + INNER_EDGE_RADIUS_MM + BAND_EDGE_RADIUS_MM + COMFORT_MM) {
    throw new Error("Band thickness cannot support the rounded cross-section clearance");
  }
  const bandOuterRadius = (z: number) => {
    const u = Math.min(1, Math.abs(z / bandHalf));
    const desiredDrop = p.profile === "flat" ? 0 : p.profile === "classic" ? 0.15 : 0.35;
    const drop = Math.min(desiredDrop, w.bandThicknessMm - BAND_EDGE_RADIUS_MM - INNER_EDGE_RADIUS_MM - (p.profile === "classic" ? COMFORT_MM : 0) - minimumBand);
    return rIn + w.bandThicknessMm - drop * u * u;
  };
  /** Quarter-round edge: how far the surface pulls in at z, for half-width h and radius rr. */
  const edgePull = (z: number, h: number, rr: number) => {
    const r = Math.min(rr, h * 0.4);
    const e = Math.abs(z) - (h - r);
    return e > 0 ? r - Math.sqrt(Math.max(0, r * r - e * e)) : 0;
  };

  // --- 3. Head and terrain -------------------------------------------------
  const mapU = (x: number) => Math.min(1, Math.max(0, x / L + 0.5)); // west (−X) → east (+X)
  const mapV = (z: number) => Math.min(1, Math.max(0, (z + W / 2) / W)); // top of map at −Z
  const terrainLift = (x: number, z: number) => {
    if (!p.terrain) return BLOCK_BASE_MM;
    const t = p.terrain;
    return BLOCK_BASE_MM + sampleBilinear(t.data, t.cols, t.rows, mapU(x), mapV(z)) * t.reliefMm;
  };

  // --- 4. Shoulders --------------------------------------------------------
  /** Side-profile point (x, y) of the shoulder at parameter t for cross-section column z. */
  const shoulderXY = (side: 1 | -1, t: number, z: number, h: number): [number, number] => {
    // Start: outward, tangent to the level terrain base.
    const ex = (side * L) / 2, ey = yTop;
    // End: the band surface at bandAngle, heading along the band's tangent.
    const rB = bandOuterRadius(Math.max(-bandHalf, Math.min(bandHalf, (z / h) * bandHalf)));
    const bx = side * rB * Math.sin(bandAngle), by = rB * Math.cos(bandAngle);
    const chord = Math.hypot(bx - ex, by - ey);
    const m0 = shoulder.startTangent * chord, m1 = shoulder.endTangent * chord;
    const t0: [number, number] = [side, 0];
    const t1: [number, number] = [side * Math.cos(bandAngle), -Math.sin(bandAngle)];
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    return [
      h00 * ex + h10 * m0 * t0[0] + h01 * bx + h11 * m1 * t1[0],
      h00 * ey + h10 * m0 * t0[1] + h01 * by + h11 * m1 * t1[1]
    ];
  };

  // Head footprint: an L × W rectangle with quarter-circle corners in plan.
  const cornerR = Math.max(0, Math.min(w.cornerRadiusMm, W * 0.45, L * 0.45));
  const endHalf = W / 2 - cornerR; // half-width of the head's flat end face
  /** Half-width of the head footprint at plan position x (clamped to the end-face width beyond L/2). */
  const footprint = (x: number) => {
    const ax = Math.min(Math.abs(x), L / 2);
    const e = ax - (L / 2 - cornerR);
    return W / 2 - (e > 0 && cornerR > 0 ? cornerR - Math.sqrt(Math.max(0, cornerR * cornerR - e * e)) : 0);
  };
  /** The shoulder's own half-width at this cross-section. */
  const shoulderHalf = (row: Row) => {
    if (row.kind === "shoulder") return endHalf + (bandHalf - endHalf) * shoulder.width(row.t);
    if (row.kind === "band") return bandHalf;
    return endHalf; // face and wall rows: where the shoulder begins
  };
  /**
   * Half-width of the solid at (x, y) within this cross-section: the shoulder width plus
   * the head's extra width, faded smoothly downward (taper) and beyond the face ends.
   */
  const taperBottom = yTop - HEAD_WALL_MM - HEAD_TAPER_MM;
  const widthAt = (x: number, y: number, row: Row) => {
    const s = shoulderHalf(row);
    const down = smootherstep((y - taperBottom) / HEAD_TAPER_MM);
    const beyond = Math.abs(x) - L / 2;
    const along = beyond <= 0 ? 1 : 1 - smootherstep(beyond / END_BLEND_MM);
    return s + Math.max(0, footprint(x) - s) * down * along;
  };
  /** Plan position (x, y) of the row's outer centre line. */
  const outerCentre = (row: Row): [number, number] => {
    if (row.kind === "face") return [row.x, yTop];
    if (row.kind === "wall") return [(row.side * L) / 2, yTop];
    if (row.kind === "shoulder") return shoulderXY(row.side, row.t, 0, shoulderHalf(row));
    const r = bandOuterRadius(0);
    return [-r * Math.sin(row.alpha), r * Math.cos(row.alpha)];
  };
  /** Outer (top) half-width of a row and inner (finger) half-width of a row. */
  const halfWidth = (row: Row) => widthAt(...outerCentre(row), row);
  const innerHalfWidth = (row: Row) => widthAt(-rIn * Math.sin(row.alpha), rIn * Math.cos(row.alpha), row);
  const edgeRadius = (row: Row) => {
    if (row.kind === "face" || row.kind === "wall") return HEAD_EDGE_RADIUS_MM;
    if (row.kind === "shoulder") return HEAD_EDGE_RADIUS_MM + (BAND_EDGE_RADIUS_MM - HEAD_EDGE_RADIUS_MM) * smootherstep(row.t);
    return BAND_EDGE_RADIUS_MM;
  };

  let terrainAdapted = false;
  const collarLength = Math.max(1.4, Math.min(2.5, W * 0.3));
  const shoulderTerrain = (row: Row, z: number, h: number) => {
    if (row.kind === "wall") return { lift: terrainLift(row.side * L / 2, z), blend: 1 };
    if (row.kind !== "shoulder") return { lift: 0, blend: 0 };
    const [x, y] = shoulderXY(row.side, row.t, z, h);
    const distance = Math.hypot(x - row.side * L / 2, y - yTop);
    const result = terrainCollar(p.terrain, L, W, row.side, z / h * endHalf, distance, collarLength);
    terrainAdapted ||= result.slopeLimited;
    return result;
  };

  /** Outer surface point. withTerrain=false gives the bare head (side-wall subdivision). */
  const outerPoint = (row: Row, z: number, withTerrain: boolean): Vec3 => {
    const h = halfWidth(row);
    const pull = edgePull(z, h, edgeRadius(row));
    /**
     * Bend the quarter-round onto the actual tapered wall. At the start of the
     * round the correction and its derivative are zero. At its end the ordinary
     * quarter-circle has zero width derivative with respect to radial depth;
     * following widthAt there makes its tangent agree with the wall below.
     * Keeping z=h at the endpoint instead creates a vertical tangent followed
     * by the sloping wall (the visible line at each head corner).
     */
    const rounded = (x: number, y: number): Vec3 => {
      const innerH = innerHalfWidth(row);
      const innerR = innerRadius(Math.sign(z) * innerH, innerH);
      const dx = -innerR * Math.sin(row.alpha) - x;
      const dy = innerR * Math.cos(row.alpha) - y;
      const length = Math.hypot(dx, dy);
      const point: Vec3 = [x + pull * dx / length, y + pull * dy / length, z];
      const radius = Math.min(edgeRadius(row), h * 0.4);
      const progress = radius > 0 ? (Math.abs(z) - (h - radius)) / radius : 0;
      point[2] += Math.sign(z) * smootherstep(progress) * (widthAt(point[0], point[1], row) - h);
      return point;
    };
    switch (row.kind) {
      case "face": {
        const lift = withTerrain ? terrainLift(row.x, z) : 0;
        const point = rounded(row.x, yTop);
        point[1] += lift;
        return point;
      }
      case "wall": {
        const point = rounded((row.side * L) / 2, yTop);
        if (withTerrain) point[1] += shoulderTerrain(row, z, h).lift;
        return point;
      }
      case "shoulder": {
        const [x, y] = shoulderXY(row.side, row.t, z, h);
        const point = rounded(x, y);
        if (withTerrain) point[1] += shoulderTerrain(row, z, h).lift;
        return point;
      }
      case "band": {
        const r = bandOuterRadius(z) - pull;
        return [-r * Math.sin(row.alpha), r * Math.cos(row.alpha), z];
      }
    }
  };

  // Rows in increasing angle: face (x from +L/2 to −L/2), −X wall, −X shoulder,
  // band round the back, +X shoulder, +X wall, back to the face.
  const { faceSegments, backSegments, widthSegments } = p.resolution;
  const shoulderSteps = Math.max(8, Math.round(backSegments * 0.28));
  const bandSteps = Math.max(12, backSegments - 2 * shoulderSteps);
  const rows: Row[] = [];
  for (let i = 0; i <= faceSegments; i++) {
    const x = L / 2 - (L * i) / faceSegments;
    rows.push({ kind: "face", x, alpha: Math.atan2(-x, yTop) });
  }
  const shoulderAlpha = (side: 1 | -1, t: number) => {
    const [x, y] = shoulderXY(side, t, 0, W / 2);
    return Math.atan2(-x, y);
  };
  rows.push({ kind: "wall", side: -1, alpha: cornerAngle });
  for (let j = 1; j < shoulderSteps; j++) {
    const t = j / shoulderSteps;
    rows.push({ kind: "shoulder", side: -1, t, alpha: shoulderAlpha(-1, t) });
  }
  for (let j = 0; j <= bandSteps; j++) {
    rows.push({ kind: "band", alpha: bandAngle + ((2 * Math.PI - 2 * bandAngle) * j) / bandSteps });
  }
  for (let j = shoulderSteps - 1; j >= 1; j--) {
    const t = j / shoulderSteps;
    rows.push({ kind: "shoulder", side: 1, t, alpha: shoulderAlpha(1, t) + 2 * Math.PI });
  }
  rows.push({ kind: "wall", side: 1, alpha: 2 * Math.PI - cornerAngle });
  const n = rows.length;

  const positions: number[] = [];
  const indices: number[] = [];
  const faceIndices: number[] = [];
  let sink = indices; // where triangle() writes: body or terrain face
  const shades: number[] = [];
  const terrainBlends: number[] = [];
  const same = (a: number, b: number) => {
    const P = positions;
    return Math.abs(P[a * 3]! - P[b * 3]!) < 1e-7 && Math.abs(P[a * 3 + 1]! - P[b * 3 + 1]!) < 1e-7 &&
      Math.abs(P[a * 3 + 2]! - P[b * 3 + 2]!) < 1e-7;
  };
  const triangle = (a: number, b: number, c: number) => {
    if (same(a, b) || same(b, c) || same(a, c)) return;
    sink.push(a, b, c);
  };

  /** Grid over all rows (wrapping). flip=false gives outward normals for an outer surface. */
  const surface = (columns: number, point: (row: Row, k: number) => Vec3, flip: boolean, isFace?: (row: Row) => boolean, finishWeight?: (row: Row, k: number) => number) => {
    const base = positions.length / 3;
    for (const row of rows) {
      for (let k = 0; k < columns; k++) {
        positions.push(...point(row, k));
        shades.push(1);
        terrainBlends.push(finishWeight?.(row, k) ?? 0);
      }
    }
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      sink = isFace && isFace(rows[i]!) && isFace(rows[i1]!) ? faceIndices : indices;
      for (let k = 0; k < columns - 1; k++) {
        const a = base + i * columns + k;
        const b = base + i1 * columns + k;
        const c = base + i * columns + k + 1;
        const d = base + i1 * columns + k + 1;
        if (flip) { triangle(a, c, b); triangle(b, c, d); }
        else { triangle(a, b, c); triangle(b, d, c); }
      }
    }
    sink = indices;
  };

  const zAt = (row: Row, k: number, columns: number) => {
    const h = halfWidth(row);
    if (k === 0) return -h; // exact, so edges coincide bit-for-bit with the side walls
    if (k === columns - 1) return h;
    // Columns cluster towards the edges (sine spacing) so the edge rounding is
    // actually resolved by the mesh instead of collapsing into one ~45° facet.
    const u = -1 + (2 * k) / (columns - 1);
    return h * Math.sin((u * Math.PI) / 2);
  };
  const innerPoint = (row: Row, z: number): Vec3 => {
    const r = innerRadius(z, innerHalfWidth(row));
    return [-r * Math.sin(row.alpha), r * Math.cos(row.alpha), z];
  };
  const zInner = (row: Row, k: number, columns: number) => {
    const h = innerHalfWidth(row);
    if (k === 0) return -h;
    if (k === columns - 1) return h;
    return -h + (2 * h * k) / (columns - 1);
  };

  const outerColumns = widthSegments + 1;
  surface(outerColumns, (row, k) => outerPoint(row, zAt(row, k, outerColumns), true), false, (row) => row.kind === "face", (row, k) => row.kind === "face" ? 1 : shoulderTerrain(row, zAt(row, k, outerColumns), halfWidth(row)).blend);
  const innerColumns = 13;
  surface(innerColumns, (row, k) => innerPoint(row, zInner(row, k, innerColumns)), true);
  // Side walls: inner edge → (interior points following the head/shoulder plan
  // shape) → bare head → terrain top (the readable terrain perimeter).
  const wallColumns = SIDE_WALL_STEPS + 3;
  for (const side of [1, -1] as const) {
    surface(wallColumns, (row, k) => {
      const inner = innerPoint(row, side * innerHalfWidth(row));
      const bare = outerPoint(row, side * halfWidth(row), false);
      if (k === 0) return inner;
      if (k === wallColumns - 2) return bare;
      if (k === wallColumns - 1) return outerPoint(row, side * halfWidth(row), true);
      // Resolve the wall tangent just below the round without adding vertices.
      const f = 1 - (1 - k / (wallColumns - 2)) ** 3;
      const x = inner[0] + (bare[0] - inner[0]) * f;
      const y = inner[1] + (bare[1] - inner[1]) * f;
      return [x, y, side * widthAt(x, y, row)];
    }, side === 1, undefined, (row, k) => k === wallColumns - 1 ? (row.kind === "face" ? 1 : shoulderTerrain(row, side * halfWidth(row), halfWidth(row)).blend) : 0);
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array([...faceIndices, ...indices]),
    shade: new Float32Array(shades),
    terrainBlend: new Float32Array(terrainBlends),
    terrainAdapted,
    faceTriangleCount: faceIndices.length / 3,
    triangleCount: (faceIndices.length + indices.length) / 3
  };
}

/** Joins sharper than this keep separate shading normals (an intentional crease). */
export const CREASE_ANGLE_DEG = 40;

/**
 * Crease-aware normals. Each vertex first gets the area-weighted normal of its
 * own strip; vertices that share a position (where strips meet) are then
 * averaged only with neighbours whose normals are within CREASE_ANGLE_DEG.
 * Smooth joins shade continuously; intentional edges such as the terrain
 * perimeter stay crisp. This does not alter geometry or hide slope errors.
 */
export function weldedNormals(mesh: Pick<RingMesh, "positions" | "indices">): Float32Array {
  const { positions: P, indices: I } = mesh;
  const count = P.length / 3;
  const own = new Float64Array(count * 3);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]!, b = I[t + 1]!, c = I[t + 2]!;
    const ux = P[b * 3]! - P[a * 3]!, uy = P[b * 3 + 1]! - P[a * 3 + 1]!, uz = P[b * 3 + 2]! - P[a * 3 + 2]!;
    const vx = P[c * 3]! - P[a * 3]!, vy = P[c * 3 + 1]! - P[a * 3 + 1]!, vz = P[c * 3 + 2]! - P[a * 3 + 2]!;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; // length = 2 × area
    for (const v of [a, b, c]) {
      own[v * 3] = own[v * 3]! + nx;
      own[v * 3 + 1] = own[v * 3 + 1]! + ny;
      own[v * 3 + 2] = own[v * 3 + 2]! + nz;
    }
  }
  const unit = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) {
    const len = Math.hypot(own[i * 3]!, own[i * 3 + 1]!, own[i * 3 + 2]!) || 1;
    unit[i * 3] = own[i * 3]! / len;
    unit[i * 3 + 1] = own[i * 3 + 1]! / len;
    unit[i * 3 + 2] = own[i * 3 + 2]! / len;
  }
  const groups = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const k = `${Math.round(P[i * 3]! * 1e5)},${Math.round(P[i * 3 + 1]! * 1e5)},${Math.round(P[i * 3 + 2]! * 1e5)}`;
    const g = groups.get(k);
    if (g) g.push(i);
    else groups.set(k, [i]);
  }
  const cosLimit = Math.cos((CREASE_ANGLE_DEG * Math.PI) / 180);
  const out = new Float32Array(count * 3);
  for (const members of groups.values()) {
    for (const i of members) {
      let x = 0, y = 0, z = 0;
      for (const j of members) {
        const dot = unit[i * 3]! * unit[j * 3]! + unit[i * 3 + 1]! * unit[j * 3 + 1]! + unit[i * 3 + 2]! * unit[j * 3 + 2]!;
        if (dot >= cosLimit) { x += own[j * 3]!; y += own[j * 3 + 1]!; z += own[j * 3 + 2]!; }
      }
      const len = Math.hypot(x, y, z) || 1;
      out[i * 3] = x / len;
      out[i * 3 + 1] = y / len;
      out[i * 3 + 2] = z / len;
    }
  }
  return out;
}

/** Signed volume (mm³) via the divergence theorem. Positive if normals face out. */
export function meshVolume(mesh: Pick<RingMesh, "positions" | "indices">): number {
  const { positions: P, indices: I } = mesh;
  let volume = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]! * 3, b = I[t + 1]! * 3, c = I[t + 2]! * 3;
    volume +=
      (P[a]! * (P[b + 1]! * P[c + 2]! - P[b + 2]! * P[c + 1]!) -
        P[a + 1]! * (P[b]! * P[c + 2]! - P[b + 2]! * P[c]!) +
        P[a + 2]! * (P[b]! * P[c + 1]! - P[b + 1]! * P[c]!)) / 6;
  }
  return volume;
}

/**
 * Watertightness and orientation check: every directed edge must be matched by
 * exactly one reverse edge (compared by position, since surfaces don't share
 * vertices). Returns the number of unmatched edges (0 = closed, consistent).
 */
export function openEdgeCount(mesh: Pick<RingMesh, "positions" | "indices">): number {
  const { positions: P, indices: I } = mesh;
  const key = (i: number) =>
    `${Math.round(P[i * 3]! * 1e4)},${Math.round(P[i * 3 + 1]! * 1e4)},${Math.round(P[i * 3 + 2]! * 1e4)}`;
  const edges = new Map<string, number>();
  for (let t = 0; t < I.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = key(I[t + e]!);
      const b = key(I[t + ((e + 1) % 3)]!);
      if (a === b) continue;
      const reverse = `${b}>${a}`;
      const count = edges.get(reverse);
      if (count) {
        if (count === 1) edges.delete(reverse);
        else edges.set(reverse, count - 1);
      } else {
        const forward = `${a}>${b}`;
        edges.set(forward, (edges.get(forward) ?? 0) + 1);
      }
    }
  }
  let open = 0;
  for (const c of edges.values()) open += c;
  return open;
}

export const METAL_DENSITY_G_CM3 = {
  silver_925: 10.36,
  gold_9ct: 11.2,
  gold_14ct: 13.1,
  gold_18ct: 15.5,
  platinum_950: 20.1
} as const;
