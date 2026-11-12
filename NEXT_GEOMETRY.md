# Head underside model: done (12 Nov 2026)

The head is now a vertical block with a rounded-rectangle footprint (L × W, corner radius r). It runs from the table down to an underside 3 mm below the table. Below that, the shoulders carry the ring; a 1.6 mm fillet joins the underside to the shoulders, and a 0.6 mm smooth-maximum fillet joins the head's end face to the shoulders. Side walls have 8 interior columns, so they follow the plan curves exactly instead of twisting.

**Implemented in `src/geometry/ring-blank.ts`:** `footprint`, `widthAt`, `HEAD_BLOCK_DEPTH_MM`, `HEAD_UNDERSIDE_FILLET_MM` and `SHOULDER_FILLET_MM`.

**Head shapes:**
- **Bar:** corner radius 0.8 / 1.0 / 1.2 mm.
- **Cushion:** 10.5 × 9.5, 12 × 11 and 14 × 13 mm, with radius 2.5 / 3 / 3.5 mm.

Both shapes are closed for every combination and match their footprints exactly (see MEASUREMENTS.md).

## Known remaining artefact
A small nub is visible on the far inside edge at one end of the head in the Standard ¾ clay view, where the head underside meets the inner edge rounding. It is cosmetic at preview resolution; investigate before production export.
