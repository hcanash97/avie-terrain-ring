# Pendant presets

Generated from `packages/product-types/src/catalogue/pendant-styles.ts` and the catalogue by `npm run catalogue:report`. Do not edit by hand; a test fails if this file differs from the code.

- **Body sizes** are the catalogue's proposed tiers. **All other dimensions are preview-only** values from each style's profile: not manufacturing values.
- Size names are proposals and are always shown with millimetres. Style names are proposals for À Vie to approve.
- Body dimensions exclude the attachment; overall dimensions include it. Depth is the body's maximum (base + maximum relief); the actual relief depends on the place and terrain height.
- Measured volume, mass, structural wall and attachment slices are in each review package (`npm run package -- --product pendant --style <id> --size <tier>`).
- No chain has been chosen: no channel or bail is claimed to fit any chain.

## Terrain Tablet Pendant (`tablet_slider`)

- A solid tablet; the chain passes through a hidden channel across the top.
- Expected topology: 1 shell, 1 hole through the solid. One hole: the chain channel through the top.
- Preview-only profile: `pendant-tablet-slider-preview-dev-1`. Default terrain: full relief.

| Size | Body W × H | Corner radius | Base | Max relief | Max body depth | Edge round | Attachment | Metal around channel / sections | Overall W × H × D | Status |
|---|---|---:|---:|---:|---:|---:|---|---|---|---|
| Petite · 10 × 16 mm | 10 × 16 | 0.6 | 3.6 | 1.4 | 5 | 0.4 | channel Ø1.8 along X; centre 2.2 below top, 1.8 above back | 1.3 above / 0.9 behind / 0.9 in front | 10 × 16 × 5 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |
| Classic · 12 × 20 mm | 12 × 20 | 0.6 | 3.6 | 1.4 | 5 | 0.4 | channel Ø1.8 along X; centre 2.2 below top, 1.8 above back | 1.3 above / 0.9 behind / 0.9 in front | 12 × 20 × 5 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |
| Statement · 15 × 25 mm | 15 × 25 | 0.6 | 3.6 | 1.4 | 5 | 0.4 | channel Ø1.8 along X; centre 2.2 below top, 1.8 above back | 1.3 above / 0.9 behind / 0.9 in front | 15 × 25 × 5 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |

## Terrain Cushion Pendant (`cushion_tab`)

- A solid strap-shaped sweep united with the cushion; not an engineered folded-sheet assembly.
- Expected topology: 1 shell, 1 hole through the solid. One hole: the opening of the folded tab.
- Preview-only profile: `pendant-cushion-tab-preview-dev-1`. Default terrain: full relief.

| Size | Body W × H | Corner radius | Base | Max relief | Max body depth | Edge round | Attachment | Metal around channel / sections | Overall W × H × D | Status |
|---|---|---:|---:|---:|---:|---:|---|---|---|---|
| Petite · 12 × 12 mm | 12 × 12 | 2.64 | 1.6 | 1.4 | 3 | 0.5 | tab: opening 3 high × 2.4 front-to-back, along X; 1 into the top edge | strap 3 × 0.9 | 12 × 15.8 × 4.3 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |
| Classic · 16 × 16 mm | 16 × 16 | 3.52 | 1.6 | 1.4 | 3 | 0.5 | tab: opening 3 high × 2.4 front-to-back, along X; 1 into the top edge | strap 4 × 0.9 | 16 × 19.8 × 4.3 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |
| Statement · 20 × 20 mm | 20 × 20 | 4.4 | 1.6 | 1.4 | 3 | 0.5 | tab: opening 3 high × 2.4 front-to-back, along X; 1 into the top edge | strap 5 × 0.9 | 20 × 23.8 × 4.3 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |

## Terrain Medallion (`round_slider`)

- The chain passes through a hidden channel across the top of the disc.
- Expected topology: 1 shell, 1 hole through the solid. One hole: the chain channel through the top.
- Preview-only profile: `pendant-round-slider-preview-dev-1`. Default terrain: full relief.

| Size | Body W × H | Corner radius | Base | Max relief | Max body depth | Edge round | Attachment | Metal around channel / sections | Overall W × H × D | Status |
|---|---|---:|---:|---:|---:|---:|---|---|---|---|
| Petite · Ø14 mm | 14 × 14 | 7 | 2.6 | 1.2 | 3.8 | 0.4 | channel Ø1.6 along X; centre 2.2 below top, 1.3 above back | 1.4 above / 0.5 behind / 0.5 in front | 14 × 14 × 3.8 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |
| Classic · Ø18 mm | 18 × 18 | 9 | 2.6 | 1.2 | 3.8 | 0.4 | channel Ø1.6 along X; centre 2.2 below top, 1.3 above back | 1.4 above / 0.5 behind / 0.5 in front | 18 × 18 × 3.8 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |
| Statement · Ø22 mm | 22 × 22 | 11 | 2.6 | 1.2 | 3.8 | 0.4 | channel Ø1.6 along X; centre 2.2 below top, 1.3 above back | 1.4 above / 0.5 behind / 0.5 in front | 22 × 22 × 3.8 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |

## Round loop pendant (internal prototype) (`round_loop`) — internal prototype

- A round-section loop above the top edge, joined to the disc.
- Expected topology: 1 shell, 1 hole through the solid. One hole: the opening of the loop.
- Preview-only profile: `pendant-preview-dev-1`. Default terrain: full relief.

| Size | Body W × H | Corner radius | Base | Max relief | Max body depth | Edge round | Attachment | Metal around channel / sections | Overall W × H × D | Status |
|---|---|---:|---:|---:|---:|---:|---|---|---|---|
| Petite · Ø14 mm | 14 × 14 | 7 | 1 | 1.5 | 2.5 | 0.3 | loop: opening 3 high × 2 front-to-back, along X; 0.6 into the top edge | wire Ø1 | 14 × 18.4 × 4 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |
| Classic · Ø18 mm | 18 × 18 | 9 | 1 | 1.5 | 2.5 | 0.3 | loop: opening 3 high × 2 front-to-back, along X; 0.6 into the top edge | wire Ø1 | 18 × 22.4 × 4 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |
| Statement · Ø22 mm | 22 × 22 | 11 | 1 | 1.5 | 2.5 | 0.3 | loop: opening 3 high × 2 front-to-back, along X; 0.6 into the top edge | wire Ø1 | 22 × 26.4 × 4 | design proposed; manufacturing unassessed; preview yes; review package yes; checkout no |
