# À Vie Terra Ring: configurator prototype

A browser configurator for À Vie Diamonds that turns real elevation data into a made-to-order landscape signet ring. The customer chooses a place on a map; its terrain becomes the ring's face. They then choose head shape, face size, metal, finish, shoulders, band profile and size. The 3D preview is generated live.

**Public prototype:** Cloudflare Workers Builds deploys this repository. See [hosting notes](docs/hosting.md). The earlier ChatGPT Sites preview is superseded.

**Historical preview (Claude-hosted; live map blocked there, presets work):** https://claude.ai/artifact/CGRQ13s5c5kgj6JMji3ojB

## Run it

```bash
npm run build:site # repository root: install both trees and write terrain-ring/dist
npm ci             # shared workspace dependencies, from the repository root
cd terrain-ring
npm ci
npm run dev        # http://localhost:5173 (live map, search and elevation work here)
npm test           # 396 geometry, terrain, map and material tests
npm run build      # static site in terrain-ring/dist
node scripts/make-artifact.mjs   # single-page bundle in terrain-ring/artifact for Claude artifacts
node scripts/bake-terrain.mjs    # re-bake saved terrain for the preset places
```

Inspection: open `http://localhost:5173/#blank` for the plain clay ring with a flat face. The ¾ / Front / Side / Top buttons are fixed cameras.

## Stack
- Vite 5, React 18, TypeScript (strict), Three.js 0.169, Zustand, Leaflet (map), Vitest.
- **Elevation:** AWS Terrain Tiles (Terrarium PNG, no key), decoded in the browser. Saved terrain for 7 presets is in `public/baked/`.
- **Search:** OpenStreetMap Nominatim, light use only. Replace with Mapbox before launch.

## Where things are
| Path | What |
|---|---|
| `terrain-ring/src/geometry/ring-blank.ts` | **The ring generator** (pure, unit-tested): inner surface, band cross-section, head footprint, Hermite shoulders, head-to-shoulder width field, terrain displacement, crease-aware normals, closure and volume checks |
| `terrain-ring/src/geometry/heightmap.ts` | Terrain sampling for a rotated frame, blur, bilinear sampling |
| `terrain-ring/src/three/terrain-surface.ts` | Relief rules (% of max relief, 30× true-scale cap, 3 m noise floor) and detail in mm |
| `terrain-ring/src/three/heightmap-loader.ts` | Live tile loading, saved-terrain fallback, place search |
| `terrain-ring/src/three/scene.ts`, `environment.ts`, `materials.ts` | Renderer, studio reflections, metals, finish zones (textured terrain face vs polished body) |
| `terrain-ring/src/components/` | 4-step UI (Place, Landscape, Ring, Size & review), map picker, viewer |
| `terrain-ring/tests/` | Closure, dimensions, seams, proportions, cushion head, relief rules, measurement report |
| `terrain-ring/scripts/` | Capture, look statistics, contact strips, terrain baking, artifact bundling |

## Decisions and status documents (read these first)
- [Pendant review contracts and outstanding gates](docs/pendant-review-contracts.md): validated prototype choices, immutable review exports, provenance and the unresolved Linux ring-parity check. No pendant geometry or manufacturing release changes.
- `DECISIONS.md`: product decisions by À Vie (both head shapes, five metals, all shoulder and band options, slider meaning) and open questions.
- `MEASUREMENTS.md`: measured opening, face footprint and band sizes for every head shape, face size and finger size.
- `LOOK.md`: approved preview look (studio, metal colours, roughness) and its acceptance numbers.
- `MANUFACTURING_CHECKS.md`: what the tests prove, and what is still needed before casting.
- `NEXT_GEOMETRY.md`: head-underside model notes.
- `REVIEWER_BRIEF.md`: prompt for an independent AI review.

## Brand (from aviediamonds.com)
- **Typography:** Trirong for headings and copy; Inter for compact controls.
- **Colours:** dark green #3F5147, off-white #EFECEC, charcoal #252525, muted gold #CDA349, body text #585757.
- **Corners and buttons:** near-square corners; gold primary buttons, green secondary buttons.
- **Copy:** calm and quote-based ("nothing is made until you approve it"). Don't add delivery, lead-time or certification promises until À Vie confirms them.

## Current state (12 Nov 2026) and next steps, in priority order

**Latest geometry update:** [Full-width shoulders and 15 saved location presets](docs/full-width-shoulders.md). This supersedes the older narrow flat-end shoulder connection described below.

**Latest reference-photo pass:** [Shape refinement and remaining gaps](docs/shape-refinement.md). Includes the Detail camera and dev-only controlled comparison sheet.

**Implemented Terra refinement:** read [TERRA_IMPLEMENTATION.md](TERRA_IMPLEMENTATION.md) for current dimensions, validation, rendering recovery and remaining manufacturing work. The older round notes below are historical and are superseded by that report.

**Latest direction:** see [Terra audit and implementation plan](TERRA_AUDIT_AND_PLAN.md). The user now requests reduced substrate metal, width-led shoulder scaling, landscape-dependent shoulder veins, rendering-state recovery and the Terra name. This plan supersedes the older ordering and face-only terrain guidance below.
Latest external review: joins first, then proportions, then presentation. Keep the feature set fixed until the joins look clean.

1. **Done this round:**
   - The notches under the head are gone. The head is now one continuous width field: a 1 mm full-width wall under the table, a 2.8 mm taper into the shoulders, and a 1.6 mm ease beyond the face ends.
   - The far-side nub is gone.
   - Outer-surface columns cluster at the edges, so edge rounding is resolved.
   - Shoulders leave the head less vertically.
2. **Fixed: head-corner edge/wall tangent.** The edge round follows the actual side-wall direction and width field, and outer/side-wall samples cluster at the join. Crease-normal threshold unchanged. Six geometric tangent regressions cover both head shapes and all shoulder styles; they fail on the previous generator. Checked Bar and Cushion in clay from fixed cameras. Continue with head bulk next.
3. **Head bulk:** compare the Bar side elevation with the reference photos; consider a lower `headHeightMm` and a shorter vertical wall.
4. **Soft or "liquid" terrain:** separate the causes before changing anything: elevation resolution (saved presets are about 38 m/px; live tiles are finer), smoothing (`DETAIL`), normals, and reflections. Don't turn sharpening back on.
5. **Default camera:** raise it slightly so the landscape is visible immediately (`src/three/camera.ts`, `VIEWS` in `scene.ts`).
6. **Viewer text overlaps the ring at some sizes:** reserve space for the stage heading and fit the camera to the remaining area.
7. **Dev panel:** expose clay, flat terrain and views (they exist in code as `clay`, `flat`, `#blank`) as visible developer controls.
8. **Mapbox:** replace Leaflet/OSM with Mapbox GL. It needs À Vie's own token and must be tested on the deployed site, not the Claude preview. The frame must match the face aspect, with no pitch and with attribution kept.
9. **Later phases:** Shopify cart and checkout (Phase 14), production geometry and export (Phase 15). Not started.

## Working conventions
- Geometry code is pure and unit-tested. Add a test with every shape rule.
- Judge shape changes in clay (`#blank`) with fixed cameras before changing materials. `scripts/capture.js` and `scripts/look.js` run in the dev page; `scripts/look-stats.mjs` measures clipping and crushed blacks.
- `captures/` is not in the repository: it's regenerable output.

## Product-family foundation

The new workspace packages implement reusable terrain/configuration snapshots, a nine-product registry, provisional mount constraints and a local Drizzle/PostgreSQL schema. The existing ring app remains in `terrain-ring/`. See [Milestone 1 guide](docs/product-family-foundation.md) for commands, tests and current limitations. Pendant/Signet geometry, live APIs and production exports are later milestones.

## Shared terrain engine (Milestone 2)

Terrain processing and the ring generator now live in `packages/terrain` and `packages/geometry`. The viewer uses an adapter, with frozen 486-case regression coverage against the original engine. See [shared engine guide](docs/shared-terrain-engine.md). Clone/build the complete repository; production `terrain-ring/dist` is still standalone.
