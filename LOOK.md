> Current implementation: see [TERRA_IMPLEMENTATION.md](TERRA_IMPLEMENTATION.md). Its Terra dimensions, collar behaviour and validation status supersede conflicting historical guidance below.

# Approved preview look (12 Nov 2026)

These are preview renders, tuned by fixed-camera captures and pixel statistics. They are not physical material specifications; confirm against photographed cast samples before launch.

## Studio (`src/three/environment.ts`, DEFAULT_STUDIO)
- **Walls:** #A9A49D.
- **Floor:** warm #5A4C3C at 0.8.
- **Horizon card:** 0.5.
- **Dark flag:** 0.18, for edge definition.
- **Light panels (unchanged):** overhead softbox 2.2, warm key strip 2.6, cool rim strip 2.4, low bounce 1.2, front fill 1.6.
- **Tone mapping:** ACES, exposure 1.05.

## Materials (`src/three/materials.ts`)

| | Polished | Satin |
|---|---|---|
| Body roughness | 0.17 | 0.32 |
| Terrain face roughness (textured zone) | 0.34 | 0.42 |

| Metal | Base colour |
|---|---|
| 18ct yellow | #E9C27A |
| 14ct yellow | #E7C58C |
| 9ct yellow | #E2CB9F |
| 925 silver | #EEEDEA |
| Platinum 950 | #DCDCDD |

- **Metalness:** 1.
- **Environment intensity:** 0.95.
- **Valley darkening:** none. The terrain shows its real depth.

## Terrain detail (`src/three/terrain-surface.ts`)
- **Fine:** 0.04 mm smoothing.
- **Balanced:** 0.08 mm.
- **Soft:** 0.16 mm.
- **Sharpening:** off.

## Acceptance targets and results
Targets: under 2% of ring pixels crushed (luminance ≤ 30) and under 1% clipped (≥ 250), on the ¾, front, side and top cameras.

All metals and both finishes meet them. The one exception is polished silver from directly above: 1.5% clipped, because silver is the most reflective metal. Full numbers: `node terrain-ring/scripts/look-stats.mjs lookF`. Images: `captures/look-comparison.html`.
