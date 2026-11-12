> Current implementation: see [TERRA_IMPLEMENTATION.md](TERRA_IMPLEMENTATION.md). Its Terra dimensions, collar behaviour and validation status supersede conflicting historical guidance below.

# What the tests prove, and what they don't

Status after the visual pass of 12 November 2026.

## Verified by automated tests (116 passing)

Preview geometry only, at test resolution:

- **Closure.** The mesh is closed with consistent outward orientation (every directed edge matched by exactly one reverse edge, compared by position), with finite coordinates and positive volume. Checked for all 27 weight × shoulder × band combinations at both minimum (5%) and maximum (100%) terrain height, on a sloped terrain fixture.
- **Face size.** The face footprint is exactly the advertised length × width (12 × 5.5, 13 × 7.5, 14 × 10 mm), with terrain applied.
- **Inner size.** The inner diameter at the centre line equals the chosen UK size for every band profile.
- **Seam.** The face meets the shoulders with no lip: under 0.3 mm vertical step and no overhang, for all shoulder styles at maximum relief. Before this pass the step was the full relief height.
- **Shading.** Normals are continuous across every join between surface strips.
- **Proportions.** Corners stay under 1.4× the centre head thickness; the flare ends within 25° of the face.
- **Relief rule.** Flat ground gives zero relief, a few metres of data noise gives under 0.2 mm, and mountains use the slider's share of the style maximum.

## Not established, needed before casting

1. **Self-intersection.** Not tested. A production mesh check (e.g. a mesh-boolean library or the caster's software) must confirm there are none.
2. **Minimum wall thickness.** Not measured. It needs a thickness analysis against the caster's minimum (typically 0.6–0.8 mm for silver and gold), especially under deep valleys near the face edges.
3. **Minimum feature size.** "Fine" detail keeps features down to about 0.06 mm (Gaussian sigma). Those will not survive casting and polishing. Production must set the smallest feature the caster can hold and clamp to it.
4. **Production resolution and export.** The preview is a display mesh. A production build needs a server-side, higher-resolution, deterministic build exported as STL or 3MF, then checked (Phase 15).
5. **Sizing tolerance.** The UK size table follows ISO 8653 arithmetic and has not been confirmed against the caster's mandrels.
6. **Weight and price.** Weights shown are estimates from preview volume. They have not been checked against cast pieces.
7. **Physical review.** At least one sample per weight should be cast and compared with the preview before launch.
