# Terra refinement — 12 November 2026

Implemented on `feature/terra-refinement`. This document supersedes older face-only terrain and substrate dimensions in the historical audit/geometry notes.

## Geometry

Both Bar and Cushion retain their original face footprints and palm band widths for Slim, Standard and Bold. Face size now primarily widens the shoulders rather than increasing palm thickness: all use a 1.5 mm nominal band and 1.2 mm nominal head radial offset. The extra terrain block base was removed. The full-width wall is reduced to 0.35 mm, followed by a 2.2 mm taper and 2.4 mm end blend.

Straight shoulders retain a straighter middle with eased endpoints, avoiding an abrupt angular departure. Classic and Curved retain distinct width curves. The head departure tangent is horizontal and the earlier rounded edge tangent fix is preserved.

A terrain collar samples the actual boundary elevation and slope, continuing them down each shoulder over 1.4–2.5 mm before fading to the plain band. Flat terrain adds no invented veins. Extreme boundary slopes are limited to avoid negative collar displacement; the UI identifies adjusted terrain. Surface roughness blends continuously from terrain to body across the collar.

Provisional constraints are configurable: a 1.0 mm minimum head radial offset from the sizing circle and 0.7 mm minimum palm radial clearance. These are local geometric constraints, not proof of global minimum wall thickness or casting suitability. D-profile rim clearance has been corrected.

## Rendering and interaction

The WebGL availability probe previously allocated an unreleased context on each Configurator render. It now probes once and releases that temporary context. Scene disposal releases its context; context loss pauses rendering, restoration rebuilds the scene and re-applies mesh, material and camera state. A public Reset preview control rebuilds the renderer without clearing the design. Forced loss/restoration was verified in the browser. This remedies an identified leak and provides recovery; it does not establish that the leak was the sole cause of every earlier black preview.

Physical metal settings are explicitly restored on material changes. Camera framing accounts for model bounds and viewport aspect. Explicit zoom buttons replace accidental scroll zoom.

The visible product is named Terra Ring. Bottom step buttons now have large numbered, labelled targets on desktop and mobile. Viewer metadata and controls reserve their own space. The working Leaflet map is retained. Its resize observer preserves the selected ground extent; the previous phone/desktop resize could silently change it. The final action says Next steps and makes clear that no enquiry has been sent.

## Evidence

- 389 tests across 12 files pass; TypeScript and production build pass.
- Geometry matrix covers both heads, all three face sizes, three representative finger diameters, all shoulders and band profiles with steep terrain; checks include closure, finite coordinates, positive volume, opening dimensions and blend bounds.
- Browser checks included gold and silver, polished/satin, Bar/Cushion, Slim/Standard/Bold, shoulder/profile changes, flat inspection, low/high relief, preset changes, fixed views, forced GPU recovery and design-preserving preview reset.
- Phone viewport 390×844 and desktop were inspected; map selection stayed at 6.0 km across resize after the fix.
- `TERRA_VOLUME_COMPARISON.md` records 18 comparable synthetic cases against f657b84: 3.2–26.1% less preview volume. Standard cases reduce 11.2–19.0%. These are model estimates, not guaranteed finished weight or price savings.
- Build retains existing bundle-size and mixed static/dynamic import warnings.

## Next work, in order

1. Jeweller/caster review of minimum wall thickness, relief limits, smallest/largest supported sizes, polishing allowance and alloy-specific tolerances; add global thickness and self-intersection validation before exporting production files.
2. Review physical resin/silver samples against the preview, especially steep boundary collars and the reduced head underside.
3. Confirm commercial pricing, quoting and persistence before connecting checkout or claiming an enquiry was submitted.
4. Develop pendants as a separate geometry family with a validated bail/chain aperture after ring approval.

The historical Claude artifact is not automatically updated by these repository changes. Test the local Vite preview or deploy the production build separately.
