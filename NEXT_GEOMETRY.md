# Head-corner tangent correction (12 Nov 2026)

The README is the current task order. The earlier underside/nub notes in this file have been superseded by the continuous head width field.

## Implemented

The outer edge round now moves toward the inner wall endpoint, rather than always pulling radially toward the ring centre. Across the round, a smootherstep correction follows the actual `widthAt` field. The start correction has zero derivative; the endpoint follows the tapered wall's width derivative. This removes the forced vertical tangent above a sloping wall.

Outer columns use sine spacing and side-wall columns cluster near the outer edge, so the mesh resolves the join without adding vertices. Terrain remains displaced vertically. The intentional terrain perimeter and `CREASE_ANGLE_DEG = 40` are unchanged.

## Verification

- 191 tests pass, including six new actual surface-tangent checks for Bar/Cushion × all shoulder styles.
- Those six checks fail on the previous generator (roughly 56–67 degrees at the worst sampled joins), and pass below 15 degrees with the correction.
- Existing closure, dimensions, proportions, terrain and material tests pass.
- TypeScript and production build pass.
- Visually inspected Standard Bar in three-quarter/front clay views and Standard Cushion in three-quarter clay view.

These are preview checks, not proof of self-intersection freedom or casting suitability. Next: assess head bulk against the reference side views.
