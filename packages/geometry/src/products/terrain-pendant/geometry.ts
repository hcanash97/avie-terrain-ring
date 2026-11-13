/**
 * Round terrain pendant: a body of revolution with the landscape on its face,
 * plus a separate bail component.
 *
 * Coordinates (millimetres, right-handed), the piece lying face-up:
 *   origin  centre of the body on the back plane (back surface at y = 0)
 *   +Y      relief direction (out of the face)
 *   +X      right, seen from the front with the bail at the top
 *   −Z      towards the bail (the top of the pendant when worn)
 * Terrain: north at −Z (towards the bail), east at +X. The landscape is the
 * centre of a square frame whose side equals the body diameter, masked by the
 * circle: cropped, never stretched.
 *
 * Profile of the body (radius r, height y), revolved about the Y axis:
 *   face (terrain, fading to plain before the rim) → top edge round →
 *   vertical side → back edge round → flat back.
 *
 * The bail is a separate closed solid placed overlapping the rim. It is a
 * VISUAL PLACEHOLDER: overlapping solids are not a joined component, and no
 * strength or chain fit is implied.
 */
import { sampleBilinear, type TerrainRelief } from "@avie/terrain";
import type { TerrainProductMesh } from "../shared/types";

export type RoundPendantParameters = {
  diameterMm: number;
  baseThicknessMm: number;
  edgeRoundMm: number;
  /** Width of the band, inside the edge round, over which terrain fades to the plain face. */
  terrainFadeMm: number;
  /** Processed terrain over a square frame of side diameterMm (normalised 0..1 × reliefMm); null = plain face. */
  terrain: TerrainRelief | null;
  bail: BailParameters | null;
  resolution: { radial: number; angular: number; round: number; bail: number };
};

export type BailParameters = {
  /** Clear opening, vertical (along Z). */
  openingHeightMm: number;
  /** Clear opening, front to back (along Y). */
  openingDepthMm: number;
  /** Diameter of the loop's round section. */
  wallMm: number;
  /** How far the loop's lowest point reaches into the body, inward from the rim. */
  embedMm: number;
};

export type SimpleMesh = { positions: Float32Array; indices: Uint32Array };

export type RoundPendant = {
  body: TerrainProductMesh;
  bail: SimpleMesh | null;
  assembly: { joined: false; relationship: string } | null;
};

const smootherstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export function createRoundPendant(p: RoundPendantParameters): RoundPendant {
  const R = p.diameterMm / 2, e = p.edgeRoundMm, base = p.baseThicknessMm;
  if (!(R > 0 && e > 0 && base >= 2 * e)) throw new Error("Base must be at least twice the edge round, and all sizes positive");
  if (!(p.terrainFadeMm >= 0 && p.terrainFadeMm < R - e)) throw new Error("Terrain fade must fit inside the face");
  const faceR = R - e; // where the plain face meets the edge round
  const { radial, angular, round, bail } = p.resolution;

  /** Terrain weight at radius r: 1 inside the fade band, easing to 0 at the edge round. */
  const mask = (r: number) => (p.terrainFadeMm === 0 ? (r < faceR ? 1 : 0) : smootherstep((faceR - r) / p.terrainFadeMm));
  const lift = (x: number, z: number, r: number) => {
    const m = mask(r);
    if (!p.terrain || m === 0) return 0;
    const t = p.terrain;
    const u = Math.min(1, Math.max(0, x / p.diameterMm + 0.5)); // west → east along +X
    const v = Math.min(1, Math.max(0, z / p.diameterMm + 0.5)); // north (v = 0) at −Z
    return sampleBilinear(t.data, t.cols, t.rows, u, v) * t.reliefMm * m;
  };

  // Profile points (r, y, kind). The face rings carry terrain; everything else is plain.
  type P = { r: number; y: number; face: boolean; back: boolean };
  const profile: P[] = [];
  for (let i = 1; i <= radial; i++) profile.push({ r: (faceR * i) / radial, y: base, face: true, back: false });
  for (let k = 1; k <= round; k++) {
    const a = (Math.PI / 2) * (k / round);
    profile.push({ r: faceR + e * Math.sin(a), y: base - e + e * Math.cos(a), face: false, back: false });
  }
  for (let k = 1; k <= round; k++) {
    const a = (Math.PI / 2) * (k / round);
    profile.push({ r: faceR + e * Math.cos(a), y: e - e * Math.sin(a), face: false, back: true });
  }
  for (let i = radial - 1; i >= 1; i--) profile.push({ r: (faceR * i) / radial, y: 0, face: false, back: true });

  const positions: number[] = [];
  const blend: number[] = [];
  const top = 0;
  positions.push(0, base + lift(0, 0, 0), 0);
  blend.push(p.terrain ? mask(0) : 0);
  const ringStart = 1;
  for (const q of profile)
    for (let j = 0; j < angular; j++) {
      const th = (2 * Math.PI * j) / angular;
      const x = q.r * Math.cos(th), z = q.r * Math.sin(th);
      positions.push(x, q.y + (q.face ? lift(x, z, q.r) : 0), z);
      blend.push(q.face && p.terrain ? mask(q.r) : 0);
    }
  const bottom = positions.length / 3;
  positions.push(0, 0, 0);
  blend.push(0);

  const v = (ring: number, j: number) => ringStart + ring * angular + (j % angular);
  const tris: { a: number; b: number; c: number; label: number }[] = [];
  const FACE = 1, BODY = 0, BACK = 2;
  for (let j = 0; j < angular; j++) tris.push({ a: top, b: v(0, j + 1), c: v(0, j), label: FACE });
  for (let i = 0; i < profile.length - 1; i++) {
    const label = profile[i]!.face && profile[i + 1]!.face ? FACE : profile[i]!.back && profile[i + 1]!.back && profile[i]!.y === 0 && profile[i + 1]!.y === 0 ? BACK : BODY;
    for (let j = 0; j < angular; j++) {
      const a = v(i, j), b = v(i, j + 1), c = v(i + 1, j), d = v(i + 1, j + 1);
      tris.push({ a, b, c: d, label }, { a, b: d, c, label });
    }
  }
  const last = profile.length - 1;
  for (let j = 0; j < angular; j++) tris.push({ a: bottom, b: v(last, j), c: v(last, j + 1), label: BACK });
  // The face is labelled terrain only where terrain actually reaches.
  for (const t of tris) if (t.label === FACE && ![t.a, t.b, t.c].some((i) => blend[i]! > 1e-6)) t.label = BODY;

  // Terrain triangles first (preview finish zone), then the rest; labels follow.
  tris.sort((x, y) => (x.label === FACE ? 0 : 1) - (y.label === FACE ? 0 : 1));
  const indices = new Uint32Array(tris.flatMap((t) => [t.a, t.b, t.c]));
  const body: TerrainProductMesh = {
    positions: new Float32Array(positions),
    indices,
    shade: new Float32Array(positions.length / 3).fill(1),
    faceTriangleCount: tris.filter((t) => t.label === FACE).length,
    triangleCount: tris.length,
    terrainBlend: new Float32Array(blend),
    terrainAdapted: false,
    surfaceLabels: Uint8Array.from(tris.map((t) => t.label)),
  };
  ensureOutward(body);

  if (!p.bail) return { body, bail: null, assembly: null };
  return {
    body,
    bail: createLoopBail(p.bail, R, base, bail),
    assembly: {
      joined: false,
      relationship: `Bail overlaps the body rim by ${p.bail.embedMm} mm at −Z. Visual placeholder: not a joined solid; joining method, strength and chain fit await the manufacturer.`,
    },
  };
}

/**
 * Loop bail in the Y–Z plane (the chain runs along X), centred on the base's
 * mid-thickness. Round section of diameter wallMm swept along an ellipse whose
 * clear opening is openingDepthMm (Y) by openingHeightMm (Z).
 */
export function createLoopBail(b: BailParameters, bodyRadiusMm: number, baseThicknessMm: number, segments: number): SimpleMesh {
  const s = b.wallMm / 2;
  const ay = b.openingDepthMm / 2 + s, az = b.openingHeightMm / 2 + s;
  const cy = baseThicknessMm / 2;
  const cz = -(bodyRadiusMm - b.embedMm + az + s);
  const tube = Math.max(8, Math.round(segments / 3));
  const positions: number[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    const py = cy + ay * Math.cos(t), pz = cz + az * Math.sin(t);
    // Outward normal of the ellipse in the Y–Z plane.
    let ny = Math.cos(t) / ay, nz = Math.sin(t) / az;
    const l = Math.hypot(ny, nz);
    ny /= l; nz /= l;
    for (let k = 0; k < tube; k++) {
      const a = (2 * Math.PI * k) / tube;
      const off = Math.cos(a) * s;
      positions.push(Math.sin(a) * s, py + ny * off, pz + nz * off);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < segments; i++)
    for (let k = 0; k < tube; k++) {
      const a = i * tube + k, b2 = i * tube + ((k + 1) % tube), c = ((i + 1) % segments) * tube + k, d = ((i + 1) % segments) * tube + ((k + 1) % tube);
      indices.push(a, c, b2, b2, c, d);
    }
  const mesh = { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
  ensureOutward(mesh);
  return mesh;
}

function signedVolume(m: SimpleMesh) {
  const P = m.positions, I = m.indices;
  let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]! * 3, b = I[t + 1]! * 3, c = I[t + 2]! * 3;
    v += (P[a]! * (P[b + 1]! * P[c + 2]! - P[b + 2]! * P[c + 1]!) - P[a + 1]! * (P[b]! * P[c + 2]! - P[b + 2]! * P[c]!) + P[a + 2]! * (P[b]! * P[c + 1]! - P[b + 1]! * P[c]!)) / 6;
  }
  return v;
}

/** Flip every triangle if the shell came out inward-facing (keeps winding rules in one place). */
function ensureOutward(m: SimpleMesh) {
  if (signedVolume(m) >= 0) return;
  const I = m.indices;
  for (let t = 0; t < I.length; t += 3) [I[t + 1], I[t + 2]] = [I[t + 2]!, I[t + 1]!];
}

export { signedVolume as pendantSignedVolume };

/** Dimensions of the generated pendant (body excludes the bail; overall includes it). */
export function pendantDimensions(pd: RoundPendant) {
  const box = (P: Float32Array) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, P[i + k]!); max[k] = Math.max(max[k]!, P[i + k]!); }
    return { min, max };
  };
  const b = box(pd.body.positions);
  let maxR = 0;
  const P = pd.body.positions;
  for (let i = 0; i < P.length; i += 3) maxR = Math.max(maxR, Math.hypot(P[i]!, P[i + 2]!));
  const all = pd.bail ? box(new Float32Array([...pd.body.positions, ...pd.bail.positions])) : b;
  const r3 = (x: number) => +x.toFixed(3);
  return {
    body: { diameterMm: r3(2 * maxR), depthMm: r3(b.max[1]! - b.min[1]!), volumeMm3: r3(signedVolume(pd.body)) },
    bail: pd.bail ? { volumeMm3: r3(signedVolume(pd.bail)), note: "Separate component; overlap with the body not subtracted." } : null,
    overall: { widthMm: r3(all.max[0]! - all.min[0]!), heightMm: r3(all.max[2]! - all.min[2]!), depthMm: r3(all.max[1]! - all.min[1]!) },
  };
}
