# Terra shape refinement: reference-photo follow-up

Implemented 12 November 2026, following the silver broad-signet and gold narrow-signet reference photos. Comparison is qualitative: the original CAD, exact terrain crop, dimensions and lighting are unavailable.

## Changed

- Face underside support now follows the local footprint instead of inheriting the narrow end width across the entire head. This reduces the unsupported-cap impression, especially on Cushion.
- Cushion corner radii are now 1.3 / 1.5 / 1.8 mm for Slim / Standard / Bold, versus 2.5 / 3 / 3.5. Overall length and width remain unchanged, but plan area increases. The squarer end provides a wider shoulder attachment. Bar radii are unchanged.
- Classic and Curved shoulders retain their width further down before narrowing. Straight's eased endpoints are retained.
- Terrain collar displacement rotates gradually toward the local XY shoulder normal (bounded 65% turn), with zero rotation derivative at the head and fading displacement at the other end. This is a restrained improvement over world-Y lift, not a complete ridge-following surface-field solution.
- High/Fine detail uses range-weighted smoothing. Low/Medium retain Gaussian filtering. The new filter averages existing samples without sharpening or overshoot; it cannot restore absent elevation detail. Normalisation and relief caps remain unchanged.
- Studio strip cards are broader and the floor bounce is more neutral. Clay is now darker with reduced environment contribution, making shape easier to inspect.
- Detail camera fits the terrain face bounds rather than the entire shank. It intentionally crops the lower ring. Other cameras restore whole-ring framing. Wrapped toolbar and caption heights reserve actual space on mobile.
- Dev-only Build comparison sheet creates 24 labelled views: both shapes and all sizes, with front/side/three-quarter clay and three-quarter silver. It uses synthetic terrain, 17.2 mm opening, 5 km length, 70% relief, High detail, Classic shoulders, Comfort profile and the same studio. Framing fits each case. It does not alter the customer design.

## Verification

396 tests pass across 13 files, including the geometry matrix, rounded-edge tangent regression, finite normals on steep Cushion fixtures, edge-filter extrema/constant preservation and projected detail-camera bounds at phone/desktop aspects. TypeScript/production build passes; existing bundle warnings remain.

Comparison sheet generated and visually inspected. Browser inspected in silver, gold and clay, Detail and whole-ring views, desktop and 390 x 844 mobile. Mobile caption overlap was found and corrected; temporary viewport override reset.

## Metal trade-off

Nominal palm thickness and head offset are unchanged. Broadening support and squaring Cushion corners add material; this is not another blanket weight reduction. Updated `TERRA_VOLUME_COMPARISON.md` reports every measured case against f657b84, and explicitly identifies the changed Cushion plan area. Slim Cushion cases are 3.3–6.3% heavier than that baseline; Standard/Bold Cushion remain lighter. Earlier universal 3–26% reduction claims no longer describe this revision. Mass values remain estimates, not quotations or casting allowances.

## Still unresolved

- Long-edge terrain relief still connects to the bare perimeter through a simple strip. A properly constrained adaptive loft remains necessary for steep boundary cases. Merely subdividing a straight wall would not resolve its shape, so that was not presented as a fix.
- Collar length/direction does not yet track full two-dimensional ridge curvature or individual catchments. No artificial engraved veins were added based on uncertain photographic reflections.
- The source terrain and lighting still do not reproduce the fine drainage detail in the original product photos. High-detail filtering is an improvement in preservation, not proof of a visual match.
- Global wall thickness, self-intersection validation, caster-specific feature limits and physical sample acceptance remain outstanding. Current tests do not certify production readiness.

Next: compare matched terrain crops with raw elevation and clay views; develop and validate the adaptive perimeter loft; then generate a review-only manufacturer sample from the frozen geometry revision.
