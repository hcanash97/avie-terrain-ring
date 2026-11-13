# Pendant prototype contracts and review gates

13 November 2026. This change hardens review data and package integrity. It does
not change ring or pendant vertex generation, thicknesses, relief, sizing or
manufacturing limits. No prototype becomes purchasable or production-ready.

## Supported contract

`pendantPrototypeSelectionSchema` records product type, contract version,
configuration version, style and catalogue preset ID. `resolvePendantPrototype`
checks their actual implemented combination. `buildProductionPendant` validates
the complete configuration before loading terrain or starting a Boolean operation.
Invalid materials, non-finite values, invalid relative-height levels, retired IDs,
future presets and mismatched style/preset combinations are rejected.

The legacy `configurationInputSchema` remains unchanged for reading saved records.
Its planned pendant mount is **not** the implemented prototype contract. The
legacy `configureProduct` path still reports that planned generator unimplemented;
do not route new prototype jobs through it or relabel old configurations. The
prototype resolver returns `pendant-prototype/v1` and always denies manufacturing
release. Future API/database integration must persist the validated prototype
snapshot explicitly. This PR does not claim that integration exists.

| Style ID | Preset IDs (suffix petite/classic/statement) | Body dimensions mm | Attachment |
|---|---|---|---|
| tablet_slider | pendant-tablet-* | 10×16 / 12×20 / 15×25 | Through channel |
| cushion_tab | pendant-cushion-* | 12×12 / 16×16 / 20×20 | Solid strap-shaped mesh union |
| round_slider | pendant-round-* | Ø14 / Ø18 / Ø22 | Through channel |
| round_loop | pendant-round-* | Ø14 / Ø18 / Ø22 | Solid loop mesh union |

These are twelve supported style/size combinations using nine existing preset
IDs. Oval and hexagonal definitions are not implemented. Dimensions remain
proposed; all profile numbers remain preview-only. The round loop profile's
applicability now describes all three existing sizes, without changing a number.

`terrain_object` remains readable in the historical product registry/database
enum. It has no new selectable preset or prototype contract. The CLI explicitly
rejects unsupported product names rather than silently falling through to ring
generation. No stored identifier was renamed or deleted.

## Immutable review attempts and provenance

Package directories use exclusive creation. An existing target causes EEXIST;
the exporter never deletes or rewrites that prior attempt. Choose a new order
reference for a deliberate retry, including after a failed attempt. Failed
partial output is retained for diagnosis and is not a completed handoff.

The design hash includes the configuration version, terrain algorithm version,
generator version, supplied geometry revision, profile ID, hash of the actual
provisional profile/outline/manufacturing data, original saved-source checksum,
parameters and exact elevation bytes. No timestamp is added to geometry identity.
Specifications retain value, status, owner, source, approver and notes intact.
The 3DM stores the same provenance metadata and validates it after reading back.

Chain SKU, cross-section, largest end-fitting width/height, assembly route and
clearance remain null with supplier/manufacturer ownership. No nominal opening
measurement approves compatibility. A chain's end fittings may be larger than
its wire; they must pass along the actual assembly route.

## Validation semantics

Pendant-only reporting separates `execution` (completed/not_run) from
`assessment` (assessed/unassessed) for shared solid checks. Dimensions, volume,
mass, relief, wall and feature measurements without approved limits are warnings
with an unassessed acceptance status. They are not manufacturing passes. Actual
geometry failures are retained. Attachment measurements are completed but
unassessed; strength and perimeter rim checks are unperformed.

Both exports are reopened. The 3DM now also checks volume equality against the
source mesh. Any failed round-trip Boolean assertion makes `valid` false,
status fail and records EXPORT_REIMPORT_FAILED. Parse exceptions abort generation
and retain the failed attempt. Successful integrity checks still yield only
held_for_review; the specification remains review_only in every case.

Topology closure, triangle quality, ray sampling and intersection algorithms are
unchanged. Structural rays that start/end at the back do not establish the
complete local minimum around a channel or junction. Coplanar intersections,
attachment strength and manufacturing suitability remain unresolved. Sliver
warnings are retained, not repaired or suppressed.

## Ring parity blocker resolved separately

The historical Linux failure was isolated to near-zero inner centre-column
coordinates. PR #12 introduced the approved, versioned positive-zero centre
plane, retained the historical fixture and legacy generation path, and added
exact-buffer and coordinate-delta checks on Linux x64 and macOS ARM64 under Node
24.22.2. That correction was merged before this pendant PR.

This branch incorporates the approved correction and subsequent Cloudflare
hosting fixes from main. Its pendant changes add no further ring geometry or
baseline changes. Historical configuration and file preservation follow the
version policy documented in `packages/geometry/src/products/terrain-ring/version.ts`.

## Next milestones and decisions

1. Keep both platform CI checks passing against the separately approved centre-plane representation.
2. Obtain À Vie decisions on pendant outlines, sizes, terrain edge/fade treatment,
   rear finish, visible attachment and target weight. Do not change dimensions
   globally to make a lighter product before structural assessment.
3. Obtain manufacturer alloy-specific wall/feature/relief/edge and attachment
   limits; supplier chain SKU/end fittings; assembly/finishing requirements.
4. Pendant-only local-wall/junction diagnostics and bounded sliver remediation,
   with measured geometry deltas and all twelve fixtures, require a later PR.
5. Complete private review packets with PDF and automatic front/rear/side/¾ views,
   plus immutable source/heightmap and file checksums. The current exporter does
   not yet create those PDF/render deliverables. External renders remain supplied
   images, not verified evidence of configuration equivalence.

No paid-order automation, new product generators, NURBS, STEP, IGES, SLDPRT, USDZ,
manufacturer contact, manufacturing release or deployment is included here.

## Initial pendant verification (before incorporating PR #12)

- `npm run check`: typecheck and lint pass; 224 workspace tests pass, one intentional
  baseline-regeneration test skipped. Includes real STL/3DM round trips, collision
  preservation and an injected wrong-unit readback that persists a failed report.
- `npm --prefix terrain-ring test`: 407 tests pass.
- `npm --prefix terrain-ring run build`: passes (existing chunk-size warning).
- `git diff --exit-code -- packages/geometry MEASUREMENTS.md TERRA_VOLUME_COMPARISON.md`:
  no changes to generators, parity baselines or ring measurement reports.
