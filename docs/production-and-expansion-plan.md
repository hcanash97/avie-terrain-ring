# Production outputs and product-type expansion: plan for approval

Status: plan approved 12 Nov 2026. **Milestone A implemented** (see section 8). Later milestones are not started. This continues `docs/product-family-plan.md` (milestones M1–M6) and `docs/production-output.md`. It responds to the "Production Outputs and Product-Type Expansion" brief of 12 Nov 2026.

## 1. What already exists (do not rebuild)

| Brief item | Status in `main` |
|---|---|
| Shared terrain design, immutable versions, hashes | Built (M1): `packages/shared-types`, `packages/terrain`, `terrain_designs` / `terrain_design_versions` tables |
| Product-type registry: 9 types, statuses active/planned/future | Built: `packages/product-types/src/product-types.ts` |
| Constraint profiles with the brief's numbers (ring 12–20 mm / 1.8 mm, pendant 14–22 mm / 1.4 mm, signet 14–20 mm / 1.8 mm) | Built as **provisional**: `constraints.ts`. Current ring presets are kept as `legacy-ring-preview` |
| DB schema: every table the brief lists, plus quotes, approvals, webhook deliveries, outbox, manufacturer profiles | Built: Drizzle schema plus 3 migrations, tested with PGlite |
| Shared terrain engine, ring geometry adapter | Built (M2): `packages/terrain`, `packages/geometry/src/products/terrain-ring` |
| Ring slim profile (1.2 mm band, 0.9 mm substrate, height-defined shoulder taper) | Built, 12 Nov |

## 2. What is missing

- Pendant geometry and signet geometry (M3).
- Validation modules (`packages/geometry/src/validation/*`), including real wall-thickness and self-intersection checks.
- `packages/pricing` (M4).
- API (`apps/api`) and worker (`apps/worker`). Not built, and no hosting is provisioned.
- Production output: binary STL, mesh 3DM via `rhino3dm`, spec PDF/JSON, validation report, manifest, renders, and the package builder (M5).
- Shopify mapping, cart and webhooks (M6).

## 3. Conflicts that need a decision

1. **Ring minimum wall 1.8 mm versus the slim ring.** You approved a 1.2 mm band and 0.9 mm substrate on 12 Nov. The brief's 1.8 mm minimum would make every current ring fail validation and return to the thick look. Recommendation: keep the slim ring, and treat 1.8 mm as a placeholder until the manufacturer gives alloy-specific minimums (question 2). Validation reports the measured value against whichever profile is approved.
2. **Ring versus signet.** The current ring is already an integrated terrain signet, and the cushion head overlaps the brief's 14–20 mm signet. Recommendation: keep `terrain_ring` as the bar/cushion product, and make `terrain_signet` the larger, classic signet head (oval, round, shield, 14–20 mm) on a heavier shank. Keep it hidden from purchase until the form is approved.
3. **Ring face sizes.** The brief says ring faces of 12–20 mm, cushion or rounded square. The current faces are 12 × 5.5 to 14 × 13 mm, bar and cushion, which you decided to keep. Recommendation: keep current sizes; the 12–20 mm range belongs to the signet.
4. **Infrastructure.** The API and worker need PostgreSQL, private object storage, a queue and a Node host. None exists, and Netlify hosts only the static site. This needs your accounts and spending. The candidates are a Node host (Fly.io, Render or Railway), Postgres (Neon or Supabase), and private files (Cloudflare R2 or S3).

## 4. Proposed order (small, reviewable PRs)

| # | Milestone | Output | Needs |
|---|---|---|---|
| **A (first)** | **Review-only manufacturer package for the existing ring**, as a local command, no server | Binary STL; Rhino 3DM containing the final triangle mesh (mm, layers, metadata; explicitly *not* NURBS); validation report with measured wall thickness, self-intersections, manifoldness, units, scale, orientation and volume/mass; spec JSON; front/side/¾ renders; SHA-256 manifest. Reopen tests for STL and 3DM. | Nothing external |
| B | Shared validation modules | `packages/geometry/src/validation/{common,ring,pendant,signet,index}.ts` with the brief's structured result format | A |
| C | Pendant geometry (preview, review-only) | Cushion pendant with border and integrated fixed loop, reverse face kept clear for engraving, closed mesh, validation | Manufacturer answers 1–6 (placeholders until then) |
| D | Signet geometry (preview, review-only) | Classic signet head (oval/round/cushion/shield), signet shoulders, comfort shank | Decision 2, manufacturer answers 7–9 |
| E | Pricing package | Integer minor units, rule data with clear placeholders, no sale at £0 | Manufacturer costing |
| F | API + worker | Endpoints in `product-family-plan.md` §5, Zod at every boundary, server-side signing | Decision 4 (hosting) |
| G | Shopify + paid-order production jobs | Product mapping, cart attributes, verified webhooks, held-for-review jobs | F, Shopify app setup |

**Why A first:** your manufacturer needs 3DM + STL, and one real sample package answers the most blocking questions (11–14: mesh-based 3DM acceptable? which Rhino version? who adds shrinkage, supports and sprues? file limits?). It needs no servers or accounts, and it also gives the first true wall-thickness measurement of the slim ring.

## 5. Milestone A: file-by-file

- `packages/production/src/stl.ts`: binary STL writer (mm, 1:1) and reader for reopen checks.
- `packages/production/src/rhino-3dm.ts`: `rhino3dm` (npm, WASM) writer. Final mesh on layer "Terra final mesh". Units: millimetres. Document user strings: design ID, version, configuration hash, mesh SHA-256, geometry and constraint versions, and the note "triangle mesh, not NURBS". Reopen check using `rhino3dm`.
- `packages/geometry/src/validation/common.ts`, used by A:
  - edge manifoldness and orientation (reuses `openEdgeCount`), vertex manifoldness, connected shells
  - finite coordinates and degenerate faces
  - self-intersection (triangle–triangle with a BVH)
  - wall thickness by inward ray casting, reported as minimum and 1st percentile with locations
  - relief measured from the base
  - bounding box, volume, mass by alloy
- `packages/production/src/package-builder.ts`: the folder structure from the brief (`01_cad`, `02_specification`, `03_visuals`, `04_source`), with every file hashed in `checksum-manifest.json`. Status `review_only` unless every check passes against an **approved** manufacturer profile. Today there is none, so packages are always review-only.
- `packages/production/src/cli.ts`: `npm run package -- --design snowdon --face standard --shape bar --size N --metal gold_9ct`.
- Renders: reuse the existing fixed-camera capture (front, side, ¾) through a headless browser step.
- Tests: STL and 3DM byte round-trip, dimension and volume parity with the canonical mesh, manifest completeness, deterministic output for the same inputs, and validation failing on deliberately broken fixtures (hole, flipped face, thin wall).
- The production spec PDF follows in milestone B (JSON first).

## 6. Claims we will not make
- The 3DM contains a triangle mesh in a Rhino-compatible container, not editable NURBS or parametric CAD.
- Closure is not casting readiness. Packages stay review-only until an approved manufacturer profile and physical sample sign-off exist.
- No STEP, IGES, SLDPRT or USDZ in this phase.

## 7. Manufacturer questions
The brief's 15 questions stand. Send them with the first review-only package from milestone A, so the maker can answer while looking at real files.

## 8. Milestone A: implemented (12 Nov 2026)

`npm run package -- --place "Snowdon, GB" --shape bar --face slim --size N --metal gold_9ct [--min-wall 1.0] [--renders <dir>]`

- **Code:**
  - `packages/production` (STL, 3DM via rhino3dm 8.17.0, ring source from saved terrain, package builder, CLI).
  - `packages/geometry/src/validation` (BVH, edge and vertex manifoldness, shells, orientation, self-intersections, ray-cast wall thickness, relief, dimensions, mass).
- **Tests:**
  - Validation catches a hole, a flipped face, inward normals, a 0.5 mm wall, intersecting shells and excess relief.
  - STL and 3DM round trips.
  - Deterministic mesh and design hashes.
  - Package structure and checksum verification.
  - Review-only status.
- **Output (sample):** `ORDER-SAMPLE-001_WR-CDC7E86` (Slim bar, Snowdon, 9ct, N). Validation is held for review with no errors, and the reopen checks passed. Mass is 3.59 g; the production mesh has about 263k triangles at Standard size.
- **Not yet:**
  - `production-spec.pdf` (the JSON is authoritative for now).
  - A feature-size minimum and rim-angle minimum (both measured since validator v2; neither is set).
  - Renders are passed in from the configurator's fixed-camera capture, not generated headless.

### Findings from the first runs
1. **Self-intersections at the head's plan corners: fixed 12 Nov** (`fix/head-corner-fold`).
   - Symptom: with high terrain at the face edge, the top surface folded over itself near the corners. Seen on Standard and Bold bar and on cushion, Snowdon and Ben Nevis, at 70% height, and at more configurations at size H and full height.
   - Cause: the edge round pulled points toward the ring's centre, which also moved them sideways in plan. At a plan corner the footprint turns through 90°, so a move of hundredths of a millimetre changed the head's width by up to 0.5 mm between neighbouring rows. Terrain was also sampled at the row's nominal position rather than where the point really sat.
   - Fix:
     - The round pulls along the surface's inward normal: straight down on the table, radial on the band, blended along the shoulder.
     - The side wall leaves the round along the same direction, so there is no new crease.
     - Terrain is sampled at each point's true plan position.
   - Effect: 99% of vertices move under 0.25 mm (largest 0.81 mm, at cushion corners). There are no self-intersections in an 82-configuration sweep (7 places, both shapes, 3 face sizes, 3 shoulders, sizes H/N/Z, 70% and 100% height). A regression test guards it.
2. **Thin regions: measurement split (validator v2, 12 Nov).**
   - **Investigation:** the earlier figures (1st percentile 0.65 mm; 0.1–0.3 mm on Grand Canyon and Lake District) mixed three different things into one ray-cast number:
     - **Structural metal**, between the outside and the finger: about 1.08 mm at the 1st percentile on every place tested. That is the 1.2 mm band less its comfort curve, and the 0.9 mm table under the terrain.
     - **Terrain sharpness:** on steep terrain the inward ray re-exits through a nearby crest. Straight-down rays from the same points found thick metal 91% (Grand Canyon) and 98% (Lake District) of the time, and at least 1.13 mm sits behind every thin reading. The sphere method confirms these are sharp crests and narrow spurs, not missing metal.
     - **Rim knife-edges:** where a cliff runs into the frame edge, the terrain meets the vertical head wall at as little as 20° (Grand Canyon) and 29° (Lake District), against 63° or more on Snowdon and Matterhorn. These are real cliffs in the data, not an edge-processing artefact.
   - **Change (no shape change):**
     - The generator labels each triangle as body, terrain, inner or rim.
     - The validator reports three things separately:
       - **structural wall:** rays that start or end on the finger surface;
       - **terrain feature size:** sphere method, terrain relief only;
       - **rim angle:** long sides, from the height data.
     - Body-to-body edge readings are reported but not judged.
     - Each check states its method. Nothing is judged without a minimum, and no minimum has been set: the CLI's `--min-wall`, `--min-feature` and `--min-rim-angle` are a reviewer's trial values, never an approval.
   - **Not done:** any local correction of the terrain. The options are a rolling-ball limit on narrow features and a rim fill. They wait for a feature-size and rim-angle minimum, ideally the manufacturer's (question 2).
