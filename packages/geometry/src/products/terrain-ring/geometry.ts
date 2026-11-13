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
  // Bar corners are tight (0.35–0.45 mm) so the shoulder starts almost as wide as
  // the head: larger plan corners narrow the head's end face, and the wider head
  // then shows as "ears" behind the shoulder in side view.
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
/**
 * Head-to-shoulder blend (one continuous width field, no attached block):
 *   - HEAD_WALL_MM: the head keeps its full footprint for this depth under the
 *     table, so the terrain perimeter stays a crisp, readable edge.
 *   - HEAD_TAPER_MM: below that, the side walls taper smoothly into the shoulder
 *     width over this height (no underside shelf, so no notches at the arch).
 *   - END_BLEND_MM: beyond each end of the face the head width eases into the
 *     shoulder over this distance (no near-vertical end face, so no crease).
 */
const HEAD_WALL_MM = 0.2; // just longer than the 0.15 mm edge round, so the full face width is reached
const HEAD_TAPER_MM = 3.6;
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
  const height = sample((side * length) / 2);
  const probe = Math.min(0.12, length / 20);
  const slope = (height - sample(side * (length / 2 - probe))) / probe;
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
    rIn +
    Math.max(
      w.headHeightMm,
      p.constraints?.minHeadRadialMm ?? 0.8,
    );
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
    throw new Error("Band is thinner than the minimum solid metal at its centre line");
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
      h00 * ex + h10 * m0 * t0[0] + h01 * bx + h11 * m1 * t1[0],
      h00 * ey + h10 * m0 * t0[1] + h01 * by + h11 * m1 * t1[1],
    ];
  };

  // Head footprint: an L × W rectangle with quarter-circle corners in plan.
  const cornerR = Math.max(0, Math.min(w.cornerRadiusMm, W * 0.45, L * 0.45));
  const endHalf = W / 2 - cornerR; // half-width of the head's flat end face
  /** Half-width of the head footprint at plan position x (clamped to the end-face width beyond L/2). */
  const footprint = (x: number) => {
    const ax = Math.min(Math.abs(x), L / 2);
    const e = ax - (L / 2 - cornerR);
    return (
      W / 2 -
      (e > 0 && cornerR > 0
        ? cornerR - Math.sqrt(Math.max(0, cornerR * cornerR - e * e))
        : 0)
    );
  };
  /** The shoulder's own half-width at this cross-section. */
  const shoulderHalf = (row: Row) => {
    if (row.kind === "shoulder") {
      // Width by the shoulder centre-line's height: head width at the top, band
      // width where the shoulder meets the band. (Hermite y is independent of h.)
      const y = shoulderXY(row.side, row.t, 0, 1)[1];
      const yLow = bandOuterRadius(0) * Math.cos(bandAngle);
      const u = Math.min(1, Math.max(0, (y - yLow) / (yTop - yLow)));
      return bandHalf + (endHalf - bandHalf) * shoulder.flare(u);
    }
    if (row.kind === "band") return bandHalf;
    // Carry more of a broad face into its supporting side wall. Previously
    // every face row inherited the narrow flat-end width of the rounded head,
    // making cushion corners look suspended above a pinched neck.
    if (row.kind === "face") {
      const target = Math.max(endHalf, footprint(row.x));
      const support = W / L > 0.75 ? 0.5 : 0.3;
      return endHalf + (target - endHalf) * support;
    }
    return endHalf; // exact end width is retained for the shoulder connection
  };
  /**
   * Half-width of the solid at (x, y) within this cross-section: the shoulder width plus
   * the head's extra width, faded smoothly downward (taper) and beyond the face ends.
   */
  const taperBottom = yTop - HEAD_WALL_MM - HEAD_TAPER_MM;
  const widthAt = (x: number, y: number, row: Row) => {
    const s = shoulderHalf(row);
    // Concave flare from just under the table edge (u^1.4, as the classic
    // shoulder): tapers immediately at the top, arrives smoothly at the bottom.
    // An S-curve here held full width for ~1 mm and read as a lip in side view.
    const down = Math.min(1, Math.max(0, (y - taperBottom) / HEAD_TAPER_MM)) ** 1.4;
    const beyond = Math.abs(x) - L / 2;
    const along = beyond <= 0 ? 1 : 1 - smootherstep(beyond / END_BLEND_MM);
    return s + Math.max(0, footprint(x) - s) * down * along;
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
    const distance = Math.hypot(x - (row.side * L) / 2, y - yTop);
    const result = terrainCollar(
      p.terrain,
      L,
      W,
      row.side,
      (z / h) * endHalf,
      distance,
      collarLength,
    );
    terrainAdapted ||= result.slopeLimited;
    return result;
  };

  /** Where a row's outer surface sits in side profile, before edge rounding and terrain. */
  const nominalXY = (row: Row, z: number, h: number): [number, number] => {
    if (row.kind === "face") return [row.x, yTop];
    if (row.kind === "wall") return [(row.side * L) / 2, yTop];
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
  const pullDirection = (row: Row, x: number, y: number, z: number): [number, number] => {
    const innerH = innerHalfWidth(row);
    const innerR = innerRadius(Math.sign(z) * innerH, innerH);
    const rx = -innerR * Math.sin(row.alpha) - x;
    const ry = innerR * Math.cos(row.alpha) - y;
    const rl = Math.hypot(rx, ry);
    const k =
      row.kind === "band" ? 1 : row.kind === "shoulder" ? smootherstep(row.t) : 0;
    const dx = (rx / rl) * k;
    const dy = (ry / rl) * k - (1 - k);
    const length = Math.hypot(dx, dy);
    return [dx / length, dy / length];
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
      const [dx, dy] = pullDirection(row, x, y, z);
      const point: Vec3 = [x + pull * dx, y + pull * dy, z];
      const radius = Math.min(edgeRadius(row), h * 0.4);
      const progress = radius > 0 ? (Math.abs(z) - (h - radius)) / radius : 0;
      point[2] +=
        Math.sign(z) *
        smootherstep(progress) *
        (widthAt(point[0], point[1], row) - h);
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
        const point = rounded(row.kind === "face" ? row.x : (row.side * L) / 2, yTop);
        if (withTerrain) point[1] += terrainLift(point[0], point[2]);
        return point;
      }
      case "shoulder": {
        const [x, y] = shoulderXY(row.side, row.t, z, h);
        const point = rounded(x, y);
        if (withTerrain) {
          const collar = shoulderTerrain(row, z, h);
          // Rotate the lift gradually toward the local outward normal. The
          // rotation has zero derivative at the head boundary, preserving the
          // existing terrain departure rather than introducing a new crease.
          const e = 0.0001;
          const a = shoulderXY(row.side, Math.max(0, row.t - e), z, h);
          const b = shoulderXY(row.side, Math.min(1, row.t + e), z, h);
          const dx = b[0] - a[0],
            dy = b[1] - a[1];
          const n = Math.hypot(dx, dy);
          const turn = (1 - collar.blend) * 0.65;
          const nx = n > 0 ? ((-row.side * dy) / n) * turn : 0;
          const ny = n > 0 ? 1 + ((row.side * dx) / n - 1) * turn : 1;
          const norm = Math.hypot(nx, ny);
          point[0] += (collar.lift * nx) / norm;
          point[1] += (collar.lift * ny) / norm;
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
        // Leave the round along its own pull direction, so the round and the
        // wall share a tangent. On the band the pull points at the inner edge
        // and this is exactly the straight wall.
        const h = halfWidth(row);
        const [nx, ny] = nominalXY(row, side * h, h);
        const [dx, dy] = pullDirection(row, nx, ny, side * h);
        const reach = Math.hypot(inner[0] - bare[0], inner[1] - bare[1]) / 2;
        const cx = bare[0] + dx * reach,
          cy = bare[1] + dy * reach;
        const a = (1 - f) * (1 - f),
          b = 2 * f * (1 - f),
          c = f * f;
        const x = a * inner[0] + b * cx + c * bare[0];
        const y = a * inner[1] + b * cy + c * bare[1];
        return [x, y, side * widthAt(x, y, row)];
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
      if (Math.abs(zAt(row, k, outerColumns)) > h - radius - 1e-9) inRound[r * outerColumns + k] = 1;
  });
  for (let t = 0; t < surfaceLabels.length; t++) {
    const v = [allIndices[t * 3]!, allIndices[t * 3 + 1]!, allIndices[t * 3 + 2]!];
    if (v.every((i) => i >= innerStart && i < innerEnd)) surfaceLabels[t] = 2;
    else if (v.some((i) => terrainBlends[i]! > 1e-3))
      surfaceLabels[t] = v.some((i) => i >= innerEnd || inRound[i] === 1) ? 3 : 1;
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

/** Where the densities below come from (shown wherever a mass is estimated). */
export const METAL_DENSITY_SOURCE =
  "Typical published alloy densities in g/cm³, not supplied by the manufacturer; confirm against the maker's alloys before quoting weights.";

export const METAL_DENSITY_G_CM3 = {
  silver_925: 10.36,
  gold_9ct: 11.2,
  gold_14ct: 13.1,
  gold_18ct: 15.5,
  platinum_950: 20.1,
} as const;
