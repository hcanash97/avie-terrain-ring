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
import { sampleBilinear, type TerrainRelief } from "@avie/terrain";
import type { TerrainProductMesh } from "../shared/types";

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
  // Rounded head ends and shoulders now share the entire face boundary.
  // Width-led, slim cast-signet proportions: every face size shares a 1.2 mm band
  // and a 0.9 mm substrate under the terrain, measured against the reference
  // front view (band ~1.1–1.2 mm, plate under 1 mm). Face size changes width
  // only. Structural minimums are checked in createRingMesh.
  slim: {
    label: "Slim",
    faceLengthMm: 12,
    faceWidthMm: 5.5,
    headHeightMm: 0.9,
    bandWidthMm: 2.0,
    bandThicknessMm: 1.2,
    maxReliefMm: 2.0,
    cornerRadiusMm: 0.35,
  },
  standard: {
    label: "Standard",
    faceLengthMm: 13,
    faceWidthMm: 7.5,
    headHeightMm: 0.9,
    bandWidthMm: 2.2,
    bandThicknessMm: 1.2,
    maxReliefMm: 2.4,
    cornerRadiusMm: 0.4,
  },
  bold: {
    label: "Bold",
    faceLengthMm: 14,
    faceWidthMm: 10,
    headHeightMm: 0.9,
    bandWidthMm: 2.6,
    bandThicknessMm: 1.2,
    maxReliefMm: 2.8,
    cornerRadiusMm: 0.45,
  },
};

/** Cushion (rounded-square) heads: same band and head height per size, broader face, larger corners. */
const CUSHION: Record<
  Weight,
  Pick<WeightPreset, "faceLengthMm" | "faceWidthMm" | "cornerRadiusMm">
> = {
  slim: { faceLengthMm: 10.5, faceWidthMm: 9.5, cornerRadiusMm: 1.3 },
  standard: { faceLengthMm: 12, faceWidthMm: 11, cornerRadiusMm: 1.5 },
  bold: { faceLengthMm: 14, faceWidthMm: 13, cornerRadiusMm: 1.8 },
};

export const HEAD_SHAPES: Record<HeadShape, string> = {
  bar: "Bar",
  cushion: "Cushion",
};

/** The physical preset for a face size and head shape. Use this everywhere dimensions matter. */
export function facePreset(weight: Weight, shape: HeadShape): WeightPreset {
  return shape === "bar"
    ? WEIGHTS[weight]
    : { ...WEIGHTS[weight], ...CUSHION[weight] };
}

/** Compatibility alias; the heightmap type is shared across products. */
export type TerrainInput = TerrainRelief;

export type RingParameters = {
  innerDiameterMm: number;
  weight: WeightPreset;
  shoulder: ShoulderStyle;
  profile: BandProfile;
  terrain: TerrainInput | null;
  constraints?: { minHeadRadialMm?: number; minBandRadialMm?: number };
  resolution: {
    faceSegments: number;
    backSegments: number;
    widthSegments: number;
  };
};

export type RingMesh = TerrainProductMesh;

/** No universal pedestal lift: the support surface supplies the substrate. */
const BLOCK_BASE_MM = 0;
/** Long edges of the head top: small, controlled rounding that keeps the perimeter readable. */
const HEAD_EDGE_RADIUS_MM = 0.15;
/** Band and lower shoulder edges: soft, polished. */
const BAND_EDGE_RADIUS_MM = 0.3;
const INNER_EDGE_RADIUS_MM = 0.25;
/** Interior columns on each side wall, so walls follow the blend's curves exactly. */
const SIDE_WALL_STEPS = 10;
const COMFORT_MM = 0.12;

const smootherstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return Math.min(1, Math.max(0, t * t * t * (t * (t * 6 - 15) + 10)));
};

/**
 * Shoulder styles, defined by the side-profile tangents and how the width eases.
 *   span: angle (rad) from the head corner to where the shoulder joins the band.
 *   startTangent / endTangent: Hermite tangent lengths as multiples of the chord.
 *   flare(u): shoulder width as a function of HEIGHT, u = 1 at the head, 0 where
 *     the shoulder meets the band. Defining width by height (not by the curve
 *     parameter) gives the continuous, trumpet-like taper of the reference side
 *     elevation instead of a neck under the head.
 */
const SHOULDERS: Record<
  ShoulderStyle,
  {
    span: number;
    startTangent: number;
    endTangent: number;
    flare: (u: number) => number;
  }
> = {
  // Shorter start tangents turn the shoulder outward sooner, so less vertical wall shows under the head.
  // Longer spans let the taper run most of the way down the side of the ring.
  straight: {
    span: 0.95,
    startTangent: 0.5,
    endTangent: 0.8,
    flare: easedLinear, // even taper
  },
  classic: {
    span: 1.0,
    startTangent: 0.6,
    endTangent: 1.0,
    flare: (u) => u ** 1.4, // gently concave: the reference's trumpet flare
  },
  curved: {
    span: 1.1,
    startTangent: 0.75,
    endTangent: 0.7,
    flare: (u) => u ** 2, // pronounced flare just under the head
  },
};

/** Straight in the middle, zero width derivative at both ends. */
export function easedLinear(t: number): number {
  const u = Math.max(0, Math.min(1, t)),
    ease = 0.18;
  if (u < ease) return (u * u) / (2 * ease * (1 - ease));
  if (u > 1 - ease) return 1 - (1 - u) ** 2 / (2 * ease * (1 - ease));
  return (u - ease / 2) / (1 - ease);
}

/** Boundary-height and outward-slope continuation, fading to zero with zero slope.
 * The derivative limiter prevents a steep edge valley from creating an undercut.
 * Input is already rotated geographic terrain; no invented or random veins.
 */
export function terrainCollar(
  terrain: TerrainInput | null,
  length: number,
  width: number,
  side: 1 | -1,
  z: number,
  distance: number,
  collarLength: number,
  boundaryX = length / 2,
) {
  const sample = (x: number) =>
    BLOCK_BASE_MM +
    (terrain
      ? sampleBilinear(
          terrain.data,
          terrain.cols,
          terrain.rows,
          x / length + 0.5,
          z / width + 0.5,
        ) * terrain.reliefMm
      : 0);
  const height = sample(side * boundaryX);
  const probe = Math.min(0.12, length / 20);
  const slope = (height - sample(side * (boundaryX - probe))) / probe;
  const tangent = Math.max(
    -3 * height,
    Math.min(3 * height, slope * collarLength),
  );
  const u = Math.max(0, Math.min(1, distance / collarLength));
  const lift =
    height * (2 * u ** 3 - 3 * u * u + 1) + tangent * (u ** 3 - 2 * u * u + u);
  return {
    lift: Math.max(0, lift),
    blend: 1 - smootherstep(u),
    slopeLimited: Math.abs(tangent - slope * collarLength) > 1e-6,
  };
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
  const yTop =
    rIn + Math.max(w.headHeightMm, p.constraints?.minHeadRadialMm ?? 0.8);
  const shoulder = SHOULDERS[p.shoulder];
  const cornerAngle = Math.atan2(L / 2, yTop);
  const bandAngle = cornerAngle + shoulder.span; // where shoulder meets band (varies with finger size)

  // --- 1. Inner surface ---------------------------------------------------
  const innerRadius = (z: number, h: number) => {
    const comfort = p.profile === "classic" ? COMFORT_MM * (z / h) ** 2 : 0;
    const rr = Math.min(INNER_EDGE_RADIUS_MM, h * 0.3);
    const e = Math.abs(z) - (h - rr);
    return (
      rIn + comfort + (e > 0 ? rr - Math.sqrt(Math.max(0, rr * rr - e * e)) : 0)
    );
  };

  // --- 2. Band cross-section ----------------------------------------------
  const bandHalf = w.bandWidthMm / 2;
  // Structural guard. Measures metal that actually exists: solid metal at the
  // centre line (thickness less the comfort dome), and edge rounds that fit
  // within the thickness. (The edge rounds sit at the band's sides, so they are
  // not subtracted from the centre-line thickness.)
  const minimumBand = p.constraints?.minBandRadialMm ?? 0.9;
  if (w.bandThicknessMm - COMFORT_MM < minimumBand) {
    throw new Error(
      "Band is thinner than the minimum solid metal at its centre line",
    );
  }
  if (INNER_EDGE_RADIUS_MM + BAND_EDGE_RADIUS_MM > w.bandThicknessMm) {
    throw new Error("Band edge rounds do not fit within the band thickness");
  }
  const bandOuterRadius = (z: number) => {
    const u = Math.min(1, Math.abs(z / bandHalf));
    const desiredDrop =
      p.profile === "flat" ? 0 : p.profile === "classic" ? 0.15 : 0.35;
    const drop = Math.min(
      desiredDrop,
      w.bandThicknessMm -
        BAND_EDGE_RADIUS_MM -
        INNER_EDGE_RADIUS_MM -
        (p.profile === "classic" ? COMFORT_MM : 0) -
        minimumBand,
    );
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
    return (
      BLOCK_BASE_MM +
      sampleBilinear(t.data, t.cols, t.rows, mapU(x), mapV(z)) * t.reliefMm
    );
  };

  // --- 4. Shoulders --------------------------------------------------------
  /** Side-profile point (x, y) of the shoulder at parameter t for cross-section column z. */
  const shoulderXY = (
    side: 1 | -1,
    t: number,
    z: number,
    h: number,
  ): [number, number] => {
    // Start: outward, tangent to the level terrain base.
    const ex = (side * L) / 2,
      ey = yTop;
    // End: the band surface at bandAngle, heading along the band's tangent.
    const rB = bandOuterRadius(
      Math.max(-bandHalf, Math.min(bandHalf, (z / h) * bandHalf)),
    );
    const bx = side * rB * Math.sin(bandAngle),
      by = rB * Math.cos(bandAngle);
    const chord = Math.hypot(bx - ex, by - ey);
    const m0 = shoulder.startTangent * chord,
      m1 = shoulder.endTangent * chord;
    const t0: [number, number] = [side, 0];
    const t1: [number, number] = [
      side * Math.cos(bandAngle),
      -Math.sin(bandAngle),
    ];
    const t2 = t * t,
      t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1,
      h10 = t3 - 2 * t2 + t,
      h01 = -2 * t3 + 3 * t2,
      h11 = t3 - t2;
    return [
      h00 * ex +
        h10 * m0 * t0[0] +
        h01 * bx +
        h11 * m1 * t1[0] +
        side *
          (headEndX((z / h) * (W / 2)) - L / 2) *
          (1 - smootherstep(t / 0.4)),
      h00 * ey + h10 * m0 * t0[1] + h01 * by + h11 * m1 * t1[1],
    ];
  };

  // The head ends are eased curves across Z, not a narrow flat end with wider
  // corners behind it. Parameterise the table and shoulders with that SAME
  // curve: each shoulder column departs from its own point on the perimeter.
  const cornerR = Math.max(0, Math.min(w.cornerRadiusMm, W * 0.45, L * 0.45));
  const endHalf = W / 2;
  const headEndX = (z: number) => {
    const e = Math.max(0, Math.min(W / 2, Math.abs(z)) - (W / 2 - cornerR));
    return L / 2 - cornerR * smootherstep(cornerR > 0 ? e / cornerR : 0);
  };
  const yLow = bandOuterRadius(0) * Math.cos(bandAngle);
  // One height-driven width field through both the head and the shoulders.
  // At the terrain base it is the full face width, tapering continuously down
  // to the unchanged palm band. There is no separate head skirt to overhang it.
  const widthAt = (_x: number, y: number, row: Row) => {
    if (row.kind === "band") return bandHalf;
    const u = Math.min(
      1,
      Math.max(0, (y - yLow) / (yTop - HEAD_EDGE_RADIUS_MM - yLow)),
    );
    return bandHalf + (W / 2 - bandHalf) * shoulder.flare(u);
  };
  const shoulderHalf = (row: Row) => {
    if (row.kind === "band") return bandHalf;
    if (row.kind === "shoulder")
      return widthAt(0, shoulderXY(row.side, row.t, 0, 1)[1], row);
    return W / 2;
  };
  /** Plan position (x, y) of the row's outer centre line. */
  const outerCentre = (row: Row): [number, number] => {
    if (row.kind === "face") return [row.x, yTop];
    if (row.kind === "wall") return [(row.side * L) / 2, yTop];
    if (row.kind === "shoulder")
      return shoulderXY(row.side, row.t, 0, shoulderHalf(row));
    const r = bandOuterRadius(0);
    return [-r * Math.sin(row.alpha), r * Math.cos(row.alpha)];
  };
  /** Outer (top) half-width of a row and inner (finger) half-width of a row. */
  const halfWidth = (row: Row) => widthAt(...outerCentre(row), row);
  const innerHalfWidth = (row: Row) =>
    widthAt(-rIn * Math.sin(row.alpha), rIn * Math.cos(row.alpha), row);
  const edgeRadius = (row: Row) => {
    if (row.kind === "face" || row.kind === "wall") return HEAD_EDGE_RADIUS_MM;
    if (row.kind === "shoulder")
      return (
        HEAD_EDGE_RADIUS_MM +
        (BAND_EDGE_RADIUS_MM - HEAD_EDGE_RADIUS_MM) * smootherstep(row.t)
      );
    return BAND_EDGE_RADIUS_MM;
  };

  let terrainAdapted = false;
  const collarLength = Math.max(1.4, Math.min(2.5, W * 0.3));
  const shoulderTerrain = (row: Row, z: number, h: number) => {
    if (row.kind === "wall")
      return { lift: terrainLift((row.side * L) / 2, z), blend: 1 };
    if (row.kind !== "shoulder") return { lift: 0, blend: 0 };
    const [x, y] = shoulderXY(row.side, row.t, z, h);
    const boundaryX = headEndX((z / h) * (W / 2));
    const distance = Math.hypot(x - row.side * boundaryX, y - yTop);
    const result = terrainCollar(
      p.terrain,
      L,
      W,
      row.side,
      (z / h) * endHalf,
      distance,
      collarLength,
      boundaryX,
    );
    terrainAdapted ||= result.slopeLimited;
    return result;
  };

  /** Where a row's outer surface sits in side profile, before edge rounding and terrain. */
  const nominalXY = (row: Row, z: number, h: number): [number, number] => {
    if (row.kind === "face") return [(row.x / (L / 2)) * headEndX(z), yTop];
    if (row.kind === "wall") return [row.side * headEndX(z), yTop];
    if (row.kind === "shoulder") return shoulderXY(row.side, row.t, z, h);
    const r = bandOuterRadius(z);
    return [-r * Math.sin(row.alpha), r * Math.cos(row.alpha)];
  };
  /**
   * Edge-round pull direction (unit, side profile): the surface's inward normal.
   * Straight down on the flat table (face and end wall), radial on the band,
   * blended along the shoulder (which leaves the head horizontally). A radial
   * pull on the table moved edge points sideways in plan; at the plan corners,
   * where the footprint turns through 90°, that changed the head width by up
   * to ~0.5 mm between neighbouring rows and folded the surface.
   */
  const pullDirection = (
    row: Row,
    x: number,
    y: number,
    z: number,
  ): [number, number] => {
    const innerH = innerHalfWidth(row);
    const innerR = innerRadius(Math.sign(z) * innerH, innerH);
    const rx = -innerR * Math.sin(row.alpha) - x;
    const ry = innerR * Math.cos(row.alpha) - y;
    const rl = Math.hypot(rx, ry);
    const k =
      row.kind === "band"
        ? 1
        : row.kind === "shoulder"
          ? smootherstep(row.t)
          : 0;
    const dx = (rx / rl) * k;
    const dy = (ry / rl) * k - (1 - k);
    const length = Math.hypot(dx, dy);
    return [dx / length, dy / length];
  };

  /** Outer surface point. withTerrain=false gives the bare head (side-wall subdivision). */
  const outerPoint = (row: Row, z: number, withTerrain: boolean): Vec3 => {
    const h = halfWidth(row);
    const pull = edgePull(z, h, edgeRadius(row));
    /** Small edge round; its actual 3D tangent is used by the side wall. */
    const rounded = (x: number, y: number): Vec3 => {
      const [dx, dy] = pullDirection(row, x, y, z);
      const point: Vec3 = [x + pull * dx, y + pull * dy, z];
      // Keep the rounded perimeter at its designed plan width. Pulling its
      // Z coordinate inward by a second width field lets a steep collar cross
      // the vertical perimeter strip; the side wall now follows the measured
      // 3D tangent instead.
      return point;
    };
    switch (row.kind) {
      // Terrain is sampled where the (rounded) point actually sits, not at the
      // row's nominal position. Near the plan corners the edge round moves
      // points inward by more than the row spacing; lifting them by the
      // nominal row's height folded the surface over itself. A lift that is a
      // function of the point's own plan position (x, z) cannot fold it.
      case "face":
      case "wall": {
        const [x, y] = nominalXY(row, z, h);
        const point = rounded(x, y);
        if (withTerrain) point[1] += terrainLift(point[0], point[2]);
        return point;
      }
      case "shoulder": {
        const [x, y] = shoulderXY(row.side, row.t, z, h);
        const point = rounded(x, y);
        if (withTerrain) {
          const collar = shoulderTerrain(row, z, h);
          // Keep the plan coordinates independent of relief. Rotating steep
          // boundary terrain sideways can fold neighbouring shoulder columns.
          // The collar follows the curved head edge, fading down the shoulder.
          point[1] += collar.lift;
        }
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
    rows.push({
      kind: "band",
      alpha: bandAngle + ((2 * Math.PI - 2 * bandAngle) * j) / bandSteps,
    });
  }
  for (let j = shoulderSteps - 1; j >= 1; j--) {
    const t = j / shoulderSteps;
    rows.push({
      kind: "shoulder",
      side: 1,
      t,
      alpha: shoulderAlpha(1, t) + 2 * Math.PI,
    });
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
    return (
      Math.abs(P[a * 3]! - P[b * 3]!) < 1e-7 &&
      Math.abs(P[a * 3 + 1]! - P[b * 3 + 1]!) < 1e-7 &&
      Math.abs(P[a * 3 + 2]! - P[b * 3 + 2]!) < 1e-7
    );
  };
  const triangle = (a: number, b: number, c: number) => {
    if (same(a, b) || same(b, c) || same(a, c)) return;
    sink.push(a, b, c);
  };

  /** Grid over all rows (wrapping). flip=false gives outward normals for an outer surface. */
  const surface = (
    columns: number,
    point: (row: Row, k: number) => Vec3,
    flip: boolean,
    isFace?: (row: Row) => boolean,
    finishWeight?: (row: Row, k: number) => number,
  ) => {
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
      sink =
        isFace && isFace(rows[i]!) && isFace(rows[i1]!) ? faceIndices : indices;
      for (let k = 0; k < columns - 1; k++) {
        const a = base + i * columns + k;
        const b = base + i1 * columns + k;
        const c = base + i * columns + k + 1;
        const d = base + i1 * columns + k + 1;
        if (flip) {
          triangle(a, c, b);
          triangle(b, c, d);
        } else {
          triangle(a, b, c);
          triangle(b, d, c);
        }
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
  surface(
    outerColumns,
    (row, k) => outerPoint(row, zAt(row, k, outerColumns), true),
    false,
    (row) => row.kind === "face",
    (row, k) =>
      row.kind === "face"
        ? 1
        : shoulderTerrain(row, zAt(row, k, outerColumns), halfWidth(row)).blend,
  );
  const innerColumns = 13;
  surface(
    innerColumns,
    (row, k) => innerPoint(row, zInner(row, k, innerColumns)),
    true,
  );
  // Side walls: inner edge → (interior points following the head/shoulder plan
  // shape) → bare head → terrain top (the readable terrain perimeter).
  const wallColumns = SIDE_WALL_STEPS + 3;
  for (const side of [1, -1] as const) {
    surface(
      wallColumns,
      (row, k) => {
        const inner = innerPoint(row, side * innerHalfWidth(row));
        const bare = outerPoint(row, side * halfWidth(row), false);
        if (k === 0) return inner;
        if (k === wallColumns - 2) return bare;
        if (k === wallColumns - 1)
          return outerPoint(row, side * halfWidth(row), true);
        // Resolve the wall tangent just below the round without adding vertices.
        const f = 1 - (1 - k / (wallColumns - 2)) ** 3;
        // Continue the actual 3D edge tangent, including the curved head
        // boundary. A radial XY-only control leaves a crease at curved corners.
        const h = halfWidth(row);
        const near = outerPoint(row, side * (h - 1e-6), false);
        const tangent = bare.map((v, i) => v - near[i]!) as Vec3;
        const length = Math.hypot(...tangent);
        const reach = Math.hypot(...bare.map((v, i) => v - inner[i]!)) / 2;
        const control = bare.map((v, i) => v + (tangent[i]! * reach) / length);
        const a = (1 - f) * (1 - f),
          b = 2 * f * (1 - f),
          c = f * f;
        return inner.map(
          (v, i) => a * v + b * control[i]! + c * bare[i]!,
        ) as Vec3;
      },
      side === 1,
      undefined,
      (row, k) =>
        k === wallColumns - 1
          ? row.kind === "face"
            ? 1
            : shoulderTerrain(row, side * halfWidth(row), halfWidth(row)).blend
          : 0,
    );
  }

  // Surface labels for validation (no effect on geometry): 0 body, 1 terrain
  // relief, 2 inner (finger), 3 terrain rim (the edge round and the strip of
  // side wall that rises to the terrain). Inner-surface vertices occupy one
  // contiguous block straight after the outer surface; side walls follow.
  const innerStart = n * outerColumns,
    innerEnd = innerStart + n * innerColumns;
  const allIndices = [...faceIndices, ...indices];
  const surfaceLabels = new Uint8Array(allIndices.length / 3);
  // Outer-surface vertices inside the designed edge round, where terrain meets the rim.
  const inRound = new Uint8Array(innerStart);
  rows.forEach((row, r) => {
    const h = halfWidth(row);
    const radius = Math.min(edgeRadius(row), h * 0.4);
    for (let k = 0; k < outerColumns; k++)
      if (Math.abs(zAt(row, k, outerColumns)) > h - radius - 1e-9)
        inRound[r * outerColumns + k] = 1;
  });
  for (let t = 0; t < surfaceLabels.length; t++) {
    const v = [
      allIndices[t * 3]!,
      allIndices[t * 3 + 1]!,
      allIndices[t * 3 + 2]!,
    ];
    if (v.every((i) => i >= innerStart && i < innerEnd)) surfaceLabels[t] = 2;
    else if (v.some((i) => terrainBlends[i]! > 1e-3))
      surfaceLabels[t] = v.some((i) => i >= innerEnd || inRound[i] === 1)
        ? 3
        : 1;
  }

  return {
    surfaceLabels,
    positions: new Float32Array(positions),
    indices: new Uint32Array(allIndices),
    shade: new Float32Array(shades),
    terrainBlend: new Float32Array(terrainBlends),
    terrainAdapted,
    faceTriangleCount: faceIndices.length / 3,
    triangleCount: (faceIndices.length + indices.length) / 3,
  };
}

export {
  CREASE_ANGLE_DEG,
  weldedNormals,
  meshVolume,
  openEdgeCount,
} from "../shared/mesh";

export const METAL_DENSITY_G_CM3 = {
  silver_925: 10.36,
  gold_9ct: 11.2,
  gold_14ct: 13.1,
  gold_18ct: 15.5,
  platinum_950: 20.1,
} as const;
