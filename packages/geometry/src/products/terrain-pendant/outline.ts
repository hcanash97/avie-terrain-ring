/**
 * Pendant body outlines in plan (X across, Z down the piece). Every current
 * style is a rounded rectangle: a circle is the case width = height = 2 × radius,
 * a cushion has generous corners, a block has tight ones.
 */
export type PendantOutline = { widthMm: number; heightMm: number; cornerRadiusMm: number };

export function validateOutline(o: PendantOutline) {
  if (!(o.widthMm > 0 && o.heightMm > 0)) throw new Error("Outline width and height must be positive");
  if (!(o.cornerRadiusMm >= 0 && o.cornerRadiusMm <= Math.min(o.widthMm, o.heightMm) / 2 + 1e-9))
    throw new Error("Corner radius must lie between 0 and half the smaller side");
}

export const circleOutline = (diameterMm: number): PendantOutline => ({ widthMm: diameterMm, heightMm: diameterMm, cornerRadiusMm: diameterMm / 2 });

/**
 * Signed distance from (x, z) to the outline moved inward by `inset` (negative
 * inside). The inward offset of a rounded rectangle is a rounded rectangle with
 * radius reduced by the inset (sharp once the inset exceeds the radius).
 */
export function outlineDistance(o: PendantOutline, x: number, z: number, inset = 0): number {
  const hw = o.widthMm / 2 - inset, hh = o.heightMm / 2 - inset;
  const r = Math.max(0, Math.min(o.cornerRadiusMm - inset, hw, hh));
  const qx = Math.abs(x) - (hw - r), qz = Math.abs(z) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

/** Where the ray from the centre at angle θ meets the inset outline (convex, so exactly once). */
export function outlinePoint(o: PendantOutline, theta: number, inset = 0): [number, number] {
  const c = Math.cos(theta), s = Math.sin(theta);
  let lo = 0, hi = Math.hypot(o.widthMm, o.heightMm);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (outlineDistance(o, mid * c, mid * s, inset) < 0) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return [t * c, t * s];
}
