/**
 * Terrain-ring specific checks that need the design, not just the mesh.
 *
 * Rim angle: along the long sides of the head the terrain stops at a vertical
 * wall. Where terrain rises steeply into that wall (a cliff cut by the frame),
 * the metal between the slope and the wall narrows to a knife-edge. The rim
 * angle is the interior angle between the terrain and the wall: 90° for flat
 * terrain, smaller as the terrain climbs into the rim.
 */
import type { Check, ValidationError } from "./common";

export type RimInput = {
  /** Normalised heights, row-major; row 0 at −Z (one long side), col 0 at −X. */
  data: ArrayLike<number>;
  cols: number;
  rows: number;
  reliefMm: number;
  faceLengthMm: number;
  faceWidthMm: number;
  cornerRadiusMm: number;
};

/** Distance inside the rim over which the rise is measured (about one edge-round width). */
export const RIM_RUN_MM = 0.15;

export function rimAngles(t: RimInput) {
  const { cols, rows } = t;
  const dz = t.faceWidthMm / (rows - 1);
  const dx = t.faceLengthMm / (cols - 1);
  const k = Math.max(1, Math.round(RIM_RUN_MM / dz));
  const h = (i: number, j: number) => t.data[j * cols + i]! * t.reliefMm;
  const angles: { deg: number; at: number[] }[] = [];
  for (let i = 0; i < cols; i++) {
    const x = -t.faceLengthMm / 2 + i * dx;
    // Skip the plan corners: there the rim is curved and the height map edge lies outside the head.
    if (Math.abs(x) > t.faceLengthMm / 2 - t.cornerRadiusMm) continue;
    for (const [j0, step, z] of [[0, 1, -t.faceWidthMm / 2], [rows - 1, -1, t.faceWidthMm / 2]] as const) {
      const rise = Math.max(0, h(i, j0) - h(i, j0 + step * k));
      angles.push({ deg: 90 - (Math.atan2(rise, k * dz) * 180) / Math.PI, at: [x, z] });
    }
  }
  return angles;
}

export function rimAngleCheck(t: RimInput, minDeg: number | null): { check: Check; error?: ValidationError } {
  const angles = rimAngles(t);
  let worst = angles[0] ?? { deg: 90, at: [0, 0] };
  for (const a of angles) if (a.deg < worst.deg) worst = a;
  const share = (lim: number) => +((100 * angles.filter((a) => a.deg < lim).length) / Math.max(1, angles.length)).toFixed(2);
  const measured = { minDeg: +worst.deg.toFixed(1), percentBelow45Deg: share(45), percentBelow30Deg: share(30), samples: angles.length };
  const method = `interior angle between the terrain and the vertical head wall along both long sides, from the terrain rise over the last ${RIM_RUN_MM} mm (plan corners excluded); judged on the minimum`;
  const location = worst.at.map((v) => +v.toFixed(3)); // [x, z] on the face, mm
  if (minDeg === null)
    return { check: { status: "not_run", method, measured, location, note: "Measured only: no minimum rim angle is set. The 45°/30° shares are reporting bands, not requirements." } };
  const ok = worst.deg >= minDeg;
  return {
    check: { status: ok ? "pass" : "fail", method, measured, required: minDeg, location },
    error: ok ? undefined : { code: "MINIMUM_RIM_ANGLE", message: "Terrain meets the head wall at a knife-edge sharper than the minimum rim angle.", measured: +worst.deg.toFixed(1), required: minDeg }
  };
}
