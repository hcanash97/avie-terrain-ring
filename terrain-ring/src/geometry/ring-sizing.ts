/**
 * UK ring sizes → inner diameter.
 *
 * Based on the BS EN ISO 8653 convention: size A has a 37.8 mm inner
 * circumference and each letter adds 1.25 mm. (The table in the Phase 13
 * brief undersized the larger letters by ~1 mm.) Half sizes are supported.
 * Confirm against your caster's mandrels before launch.
 */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE_CIRCUMFERENCE_MM = 37.8;
const STEP_MM = 1.25;

export const UK_RING_SIZES: string[] = (() => {
  const sizes: string[] = [];
  for (let i = LETTERS.indexOf("H"); i <= LETTERS.indexOf("Z"); i++) {
    const letter = LETTERS[i]!;
    sizes.push(letter);
    if (letter !== "Z") sizes.push(`${letter}½`);
  }
  return sizes;
})();

export function getInnerCircumferenceMm(ringSize: string): number {
  const letter = ringSize.charAt(0);
  const index = LETTERS.indexOf(letter);
  const half = ringSize.endsWith("½") ? 0.5 : 0;
  if (index < 0 || !UK_RING_SIZES.includes(ringSize)) {
    throw new Error(`Unsupported ring size: ${ringSize}`);
  }
  return BASE_CIRCUMFERENCE_MM + (index + half) * STEP_MM;
}

export function getInnerDiameterMm(ringSize: string): number {
  return getInnerCircumferenceMm(ringSize) / Math.PI;
}
