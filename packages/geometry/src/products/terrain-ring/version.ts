/**
 * Ring mesh algorithm versions.
 *
 * The configuration row's geometry_version (see product configuration versions)
 * is the identifier. Replay must be given that recorded string. A missing
 * string is not treated as the current algorithm.
 *
 * terra-ring/a7c4afe is the only identifier this repository has ever written
 * onto a new ring configuration. It names the published preview revision, and
 * it was not updated when the full-width shoulder construction landed, so it
 * does not reconstruct that older preview commit. It selects the legacy
 * generator below, which is the full-width-shoulders construction with the
 * inner centre column left to floating-point cancellation. It does not select
 * the centre-plane correction.
 *
 * Three guarantees stay separate:
 * A. Repeatability: one algorithm, run twice in the same environment, returns
 *    the same raw buffers.
 * B. Cross-environment agreement is only what the centre-plane tests show for
 *    the corrected buffers on the two tested platforms.
 * C. SHA-256 manifests identify the exact bytes of a file written by a run.
 *    They are not rewritten after the fact, and agreeing position buffers do
 *    not mean STL or 3DM bytes match on another machine.
 */

/** Legacy generator: full-width shoulders, centre column by cancellation. */
export const RING_GEOMETRY_LEGACY = "terra-ring/full-width-shoulders";

/**
 * Historical configuration stamp. Same generator as {@link RING_GEOMETRY_LEGACY}.
 * Kept so a stored design is not silently rebuilt with the corrected algorithm.
 */
export const RING_GEOMETRY_RECORDED_LEGACY = "terra-ring/a7c4afe";

/**
 * Current generator: the legacy construction, with the inner centre column
 * set to positive zero at its construction index.
 */
export const RING_GEOMETRY_CENTRE_PLANE = "terra-ring/centre-plane-zero";

/** Algorithm written onto a newly created ring configuration. */
export const RING_GEOMETRY_VERSION = RING_GEOMETRY_CENTRE_PLANE;

export const RING_GEOMETRY_VERSIONS = [
  RING_GEOMETRY_CENTRE_PLANE,
  RING_GEOMETRY_LEGACY,
  RING_GEOMETRY_RECORDED_LEGACY,
] as const;

export type RingGeometryVersion = (typeof RING_GEOMETRY_VERSIONS)[number];

/**
 * Resolve a version stored on a design. Missing, blank and unknown versions
 * throw. They are never replaced with {@link RING_GEOMETRY_VERSION}.
 */
export function assertRecordedRingGeometryVersion(
  version: string | null | undefined,
): RingGeometryVersion {
  if (version == null || version === "") {
    throw new Error(
      "Recorded ring geometry version is missing; refusing to use the current algorithm",
    );
  }
  if (
    version === RING_GEOMETRY_CENTRE_PLANE ||
    version === RING_GEOMETRY_LEGACY ||
    version === RING_GEOMETRY_RECORDED_LEGACY
  ) {
    return version;
  }
  throw new Error(`Unsupported ring geometry version: ${version}`);
}

/** True only for the corrected algorithm. Legacy stamps keep cancellation. */
export function usesExplicitInnerCentrePlane(
  version: RingGeometryVersion,
): boolean {
  return version === RING_GEOMETRY_CENTRE_PLANE;
}
