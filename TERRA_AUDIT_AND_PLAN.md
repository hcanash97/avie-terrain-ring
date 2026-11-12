# Terra ring — geometry, rendering and UX audit

12 November 2026. Baseline: d22c618 on fix/head-corner-tangent. This document records the user's latest direction and the next implementation plan. It supersedes earlier guidance to keep all terrain strictly on the top face. Application code was not changed during this audit.

## Direction confirmed by the user

- Customer-facing name: **Terra ring** (À Vie Terra Ring for the full product name).
- Slim / Standard / Bold should primarily vary head footprint and band/shoulder width. Do not increase thickness automatically merely to make a wider ring.
- Smooth, deliberate shoulder transitions for all styles. Straight means a straighter taper, not an angular junction.
- Reduce unnecessary solid metal beneath the terrain. Preserve supported physical thickness and wearable edges.
- Carry real landscape ridges subtly down the upper shoulders, with blending dependent on the selected terrain and ring dimensions.
- Resolve the persistent black-render failure.
- Retain the working map and scale. Do not replace the map merely to match the competitor's provider.
- Larger, obviously clickable bottom step buttons and a restrained UI refresh.
- Pendants with a chain loop/bail are the next product phase after the ring is stable.

## Evidence and comparison

The reference evidence is the user's Wildring screenshots, particularly the low-relief London ring, the front/three-quarter ring views, and the mountainous product photographs. These support visual comparisons; they do not reveal Wildring's internal algorithms or exact physical dimensions.

| Area | Current Terra prototype | Reference appearance / intended direction |
|---|---|---|
| Shoulder width | Broadens toward the head, but mixes lateral flare with added radial bulk | Broad polished shoulders, with the head supported by widening rather than a projecting cap |
| Shoulder profile | Head begins at a fixed horizontal table; Hermite shoulder initially leaves vertically | A more continuous sweep, with less visible vertical pedestal |
| Straight style | Width function is linear in shoulder parameter and stops at a constant-width band | Straighter main taper with eased endpoints; no obvious hinge |
| Terrain integration | Only face rows receive terrain displacement; shoulder geometry is terrain-independent | Landscape-shaped edge and restrained ridge/vein continuation into the upper shoulder |
| Head substrate | Fixed head height and fixed wall/taper depths for a given preset | Low-relief locations should have a more economical, restrained head |
| Metal appearance | Fresh scene renders correctly; existing scene can remain nearly black through metal changes | Readable alloy appearance across normal views and configuration changes |
| Step navigation | Bottom steps are clickable, but very small; mobile CSS hides labels | Large labelled targets with clear current/completed states |
| Brand | Terrain Ring name, location-first heading | Terra ring name, landscape retained as the personal design title |

### Width and thickness are currently coupled by the presets

| Preset | Bar face | Palm-side band width | Nominal band thickness | Head height above inner radius |
|---|---|---:|---:|---:|
| Slim | 12 × 5.5 mm | 2.4 mm | 1.5 mm | 1.9 mm |
| Standard | 13 × 7.5 mm | 3.0 mm | 1.7 mm | 2.1 mm |
| Bold | 14 × 10 mm | 4.0 mm | 1.9 mm | 2.4 mm |

The head also has a 0.12 mm base lift. At size N, the flat head's centre-line vertical separation from the circular inner surface is approximately 2.02 / 2.22 / 2.52 mm at its centre, and 4.46 / 5.19 / 6.12 mm at its ends, before terrain. These are derived vertical separations, **not minimum wall-thickness measurements**. A horizontal head crossing a circular opening naturally gets deeper toward its ends. Lowering a single constant cannot solve every proportion.

### Confirmed black-render failure

In the user's existing local tab: Bold Bar, Custom area around 15 km, Classic shoulder, D-profile, polished 9ct gold. The ring body was almost black. Resetting to three-quarter and switching to silver did not restore it. No captured console warnings/errors explained it. A fresh tab rendered normally, including after selecting Bold, D-profile and Straight shoulders.

This is a persistent scene-state symptom, not proof of excessive shadows or a specific faulty setting. The scene has a separate contact-shadow plane; the body appearance depends on its environment reflections. Investigate environment/PMREM lifecycle, context recovery, hot reload, materials, and generated normals. Do not claim a root cause until a controlled reproduction isolates it.

Screenshots (local, regenerable): captures/audit-black-gold.jpg and captures/audit-straight-shoulder.jpg.

### Additional geometry defect: D-profile rim clearance

At the palm-side outermost band column, the current D-profile outer radial offset is `0.45 * bandThickness - 0.45`; the inner rounded edge offset is `0.35`. Their difference is -0.125 mm for Slim, -0.035 mm for Standard, and only +0.055 mm for Bold. Thus the formula places the Slim/Standard outer rim inside the inner rim. This is a cross-section ordering defect; it must not be treated as a safe solid merely because edge-closure tests pass. Comfort-profile rim clearance is also very small in Slim. Correct cross-section/edge construction before choosing any lower thickness defaults.

## Implementation order

### 1. Stabilise rendering and establish measurements

Files: three/scene.ts, environment.ts, renderer.ts, materials.ts, components/RingViewer.tsx; geometry verification tests.

- Capture the affected state before resetting it; distinguish live-page state corruption from configuration-dependent geometry.
- Reproduce on a fresh page with a recorded sequence of changes, rapid slider input, repeated style/profile/metal switches, resize and camera reset. Include hot reload and WebGL context recovery in development diagnostics.
- Verify that environment textures remain usable and material state is reapplied after scene recreation. Inspect normal lengths/orientation and triangle groups rather than assuming lighting is solely responsible.
- Establish consistent fixed-camera captures, geometry volume and estimated mass for representative landscapes and ring sizes.
- Fix the D-profile/inner-edge ordering. Add local cross-section thickness checks for every profile, including edges; closure is insufficient.

Acceptance: no persistent black state after configuration changes; gold/silver remain identifiable in standard views; geometry has positive supported edge clearance. Pixel statistics supplement visual inspection, not replace it.

### 2. Redesign the underlying shank and head support

File: geometry/ring-blank.ts and its regression tests.

- Separate head footprint, lateral shoulder width, palm-side band width, radial thickness and head clearance into explicit physical parameters.
- Keep the selected inner size accurate. Compare consistent thickness across face sizes, adding thickness only where structural constraints justify it.
- Replace the forced vertical shoulder start with a transition designed for the lower head. Use position and tangent continuity at both ends; evaluate curvature to avoid a visible hinge.
- Make Straight mainly straight through its middle, with eased endpoint derivatives. Keep Classic and Curved distinct without abrupt flares.
- Preserve the successful rounded edge-to-wall tangent correction from d22c618.

Acceptance: clay front/side/top/three-quarter views for both shapes, all face sizes and all shoulder/profile styles at small/medium/large finger sizes; no projecting shelf, notches or width-derivative breaks at the band join. Dimensions and minimum clearance pass independently of normal smoothing.

### 3. Reduce head volume using a terrain-aware support rule

- Compare a lower planar substrate with a gently shaped support surface. Choose on visual fidelity and measured volume, not an arbitrary aesthetic thickness target.
- Build the minimum supporting envelope from the finger opening and a configurable manufacturing thickness requirement. Place/adapt terrain relative to that envelope; do not remove supporting metal by globally subtracting a fixed amount.
- Keep valleys above the support envelope and peaks recognisable. Where a selected landscape needs local adaptation, record the adjustment and show an appropriate explanation.
- Remove unnecessary pedestal/wall depth and reflow the shoulder, rather than hollowing the ring by default.
- Report before/after volume and estimated mass for the same size, alloy, footprint, landscape and relief. Do not promise savings or infer a retail price until measured and priced.

Acceptance: low-relief rings visibly slimmer; mountainous rings retain their landscape without a universal tall base. Lower mass for the agreed representative designs, without inverted cross-sections or unsupported thin regions. Manufacturing thresholds remain provisional until agreed with the caster.

### 4. Extend terrain into the upper shoulders

- Use the selected terrain's boundary elevations and local ridge directions to generate a continuation, including the landscape bearing. Do not add random decorative veins or copy a particular competitor ring.
- Continue boundary position and slope through a short shoulder collar, then fade smoothly into polished metal with zero displacement slope at its end.
- Scale collar length/strength to actual head width, shoulder geometry, terrain relief and physical detail limits. Flat locations should not acquire invented ridges.
- Blend geometric detail and finish roughness over the collar so a hard material boundary does not replace the old geometric boundary.

Acceptance: coherent veins for mountain/ramp fixtures, negligible continuation on flat terrain, no lip at the face, no seam at the fade-out, and no intrusion into the finger opening. Include peaks/valleys at every edge and corner in tests.

### 5. Terra naming and focused interface polish

Files: Configurator, RingViewer, styles, page metadata and review summary.

- Rename visible product to À Vie Terra Ring, preserving internal identifiers and historical notes where needed.
- Enlarge the existing bottom step controls into labelled, full-area buttons at least 44 px high. Keep labels on mobile, support keyboard/focus, and expose current step with aria-current.
- Allocate separate space for metadata and the model; fit the camera to available space and bounds rather than letting the model overlap text.
- Stop ordinary page scrolling over the viewer from accidentally causing extreme zoom; add deliberate zoom controls/gesture handling suitable for touch and trackpads.
- Keep the working map and geographic selection. Add subtle step transitions, clear selected states and a concise dimensions/estimated-weight summary. Avoid decorative UI features that compete with the ring.
- Expose clay/flat inspection controls in development. Keep metal reduction/production algorithms out of the customer flow unless they affect a meaningful choice.

Acceptance: labelled bottom navigation usable on a phone, no overlapping text, no scroll-induced unusable zoom, accurate summary, reduced-motion support, consistent Terra naming.

### 6. Terra pendant prototype (subsequent phase)

Reuse the geographic selection and processed terrain, then generate a separate pendant body with controlled back thickness, rounded edges and an integrated chain bail/loop. Design bail aperture for an agreed chain and clasp clearance, check attachment thickness and hanging balance, and validate the union as one solid. Start with one shape/size; approve a physical sample before expanding the range. The ring geometry should not simply be flattened into a pendant.

## Delivery checkpoints

1. Rendering recovery + trustworthy cross-section checks.
2. Clay approval: wider shoulders, continuous Straight style, lower support.
3. Terrain/shoulder continuity and measured mass comparison.
4. Terra name, navigation and responsive UI.
5. Pendant body and bail prototype.

Each implementation checkpoint gets targeted regressions, the existing test suite/build, fixed-camera evidence and a Git commit pushed to the private repository. No claim of production readiness until thickness, intersections, sizing and physical samples are validated.
