# Full-width shoulder support and additional presets

12 November 2026.

## Shape change

The previous generator attached each shoulder to the narrow flat end of the rounded face (`faceWidth / 2 - cornerRadius`). From the side, wider corners stood behind that connection as projecting ears. Smaller corner radii reduced that effect but did not remove its cause.

The table and shoulder now share a curved end boundary across the entire face width. Each shoulder column starts on that boundary; the corner offset fades smoothly into the shoulder. A single height-based width field supports the face and narrows towards the palm band. The end boundary uses a bounded, eased curve rather than a circular parameterisation with an infinite end derivative, which caused folds when combined with the taper.

The small edge round keeps its plan width. The body wall leaves it along its actual 3D tangent, including the curved boundary. Terrain continuation samples the same boundary and stays vertically displaced: sideways displacement and a second inward width correction could make steep collars cross the perimeter wall.

Finger sizing, nominal face dimensions, 1.2 mm band thickness and 0.9 mm substrate remain the existing design values. The upper support distribution changes; mass can change. This does not resolve or approve manufacturing wall, feature-size or rim-angle limits.

## Verification

- Full-width end connection, gradual shoulder narrowing and closure across Bar/Cushion, Slim/Standard/Bold, all three shoulders, three finger diameters, with flat and steep synthetic terrain (108 configurations).
- The new width regression fails on the previous generator.
- Full-resolution topology and intersection checks across all fifteen saved places × two shapes × three shoulders at maximum terrain height (90 configurations).
- Existing tangent, dimension, opening, terrain, material and renderer checks retained.
- The 486-case deterministic geometry baseline is deliberately updated for this shape change; it is not a claim of parity with the original extracted shape.

## More preset places

Eight added: Mont Blanc, Mount Everest, Dolomites (Tre Cime area), Old Man of Storr, Yosemite (Half Dome area), Uluru, Milford Sound and Mount Etna. Coordinates are representative starting crops, and the map remains adjustable.

`terrain-ring/src/data/presets.json` is the shared catalogue for the UI, elevation baker and production default crop lengths. Every preset includes a real saved elevation PNG for offline fallback. New PNG metadata records the elevation unit size; Everest uses 0.2 m units to avoid overflowing the legacy 16-bit decimetre encoding. Existing PNGs keep their original 0.1 m decoding.

Run the baker from `terrain-ring`: `node scripts/bake-terrain.mjs` adds missing presets; `--all` explicitly refreshes every preset. Network access is required for baking, not for tests.

## Limits

Automated checks are sampled and do not establish casting suitability. The earlier Cushion wall readings and manufacturer-specific limits still require review. No terrain feature-size or rim-angle correction is silently applied here. Production remains review-only.
