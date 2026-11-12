# Shared terrain engine — Milestone 2

The existing processing and ring generator have moved into workspace packages. The ring's shape, dimensions, presets, shoulder rules, smoothing, relief caps, camera/UI and nominal mass rules are preserved. No pendant/signet geometry, API, pricing, commerce or production export is introduced by this milestone. The hosted preview has not been redeployed for this internal extraction.

## One implementation

`packages/terrain/src/heightmap.ts` owns sampling, normalization, bilinear interpolation, Gaussian and range-weighted smoothing. `processing.ts` resolves an explicit physical mount's dimensions and relief cap into normalized samples plus mm displacement. Its input is a product-neutral `TerrainMountDimensions`; it imports no ring preset, React, Three.js or browser API. `edge-falloff.ts` retains the existing opt-in mask; it is not silently applied to current rings.

`packages/geometry/src/products/terrain-ring/geometry.ts` owns the existing ring generator. Shared mesh types, volume, closure counting and crease-aware normals live in `products/shared/`. These are existing geometric tools, not complete production validation. `adapter.ts` connects source sampling to ring generation, and `RingViewer` now calls this adapter.

The old app paths re-export the same functions for compatibility. There is no second terrain engine or retained copy of the old generator. The current ring's legacy footprint-matched crop, preview size-later behaviour and adaptive LOD remain unchanged. This preview adapter is not the signed production configuration path. Other products must explicitly resolve their mount/crop policy rather than silently reuse the ring crop.

## Saved-data replay

`@avie/terrain/snapshot` decodes a float32 little-endian source grid and creates an owned, bilinear sampling source. It validates dimensions, finite samples and coverage. Caller mutation of input buffers cannot change subsequent samples. Coordinates are local metres east/north about the saved centre; raw rows run north-to-south and columns west-to-east. This source convention must be used by any future elevation ingest service. Current global-map loaders remain browser I/O adapters; they were not moved into the pure package.

`@avie/terrain/server` verifies the immutable terrain hash, exact source-byte SHA-256 and the supported processing version (`terrain/v1`) before decoding. Unsupported versions, corrupt bytes or out-of-coverage samples fail closed, without live downloads or replacement terrain. Authorization and approval are the caller's responsibility. This is an in-memory replay utility, not object storage or an API endpoint.

The public core entry excludes the optional snapshot/validation entry. Signing/checksum verification is a separate server-only export with browser access blocked. No server secret, database module or signing implementation is imported by the configurator. Existing preview geometry remains browser code, as before.

## Frozen parity evidence

Before moving code, a one-off recorder ran against source revision `0452596`. It produced `packages/geometry/tests/fixtures/pre-extraction.json`. The recorder was removed; normal tests cannot regenerate or overwrite this file.

The fixture contains 486 combinations: both heads, all three face sizes, three opening diameters, all three shoulders and band profiles, and flat/ramp/synthetic mountain sources. Detail, rotation and relief settings vary across the cases. Test resolution is 48 terrain columns, 40 face segments, 72 back segments and 32 width segments. It is representative regression coverage, not every possible continuous input or every preview LOD.

The new viewer adapter must exactly match stored hashes for positions, indices, normals, finish weights, shade values and processed terrain samples, plus exact volume, relief/exaggeration/range, triangle counts, adaptation flag and closure result. Equality is byte-exact on the tested Node runtime, not a new cross-platform floating-point guarantee. The fixture is only changed after an intentional, reviewed geometry revision, never to fix a refactor failure.

Additional tests exercise shared/old import identity, little-endian decoding, north-up orientation, immutable source buffers, source reuse at different physical mount sizes, corrupt/unknown-version rejection and coverage checks. The original 396 ring tests remain in place.

## Setup

From the repository root:

```sh
npm ci
npm --prefix terrain-ring ci
npm run check
npm run format:check
npm run test:all
npm --prefix terrain-ring run build
npm --prefix terrain-ring run dev
```

The root installs workspace packages; the app declares local file dependencies on `../packages/terrain` and `../packages/geometry`. Keep the complete repository layout. Copying only `terrain-ring/` is no longer a supported source setup. Production `terrain-ring/dist` remains a standalone static build.

Both root and app clean installs were verified from lockfiles with cached packages and install scripts disabled. Root typecheck/lint/tests, app tests/build and formatting checks pass. Build retains the existing bundle-size and mixed dynamic/static-import warnings. The static preview's normal bundle stays about 863 kB uncompressed; optional saved-source validation does not inflate the existing preview path.

## Deployment and next work

The live Site remains version 1. A future update must include the shared workspace when building, then deploy only the resulting static bundle. See `hosting.md` for the preserved Site identity and source layout requirements.

Next is the first pendant geometry and preview, using this terrain engine with its own mount, border, body and integrated-loop topology. Attachment checks, global thickness/self-intersection validation, product-specific approval and manufacturer review remain unresolved; none are implied by ring parity.
