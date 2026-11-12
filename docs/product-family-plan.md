# Terra product-family architecture — approval draft

Status: Milestones 1 and 2 are implemented; see [shared engine guide](shared-terrain-engine.md). Milestone 1 details follow; see [foundation guide](product-family-foundation.md). Later milestones remain planned. The paragraphs below record the approved architecture baseline.

Original planning status: PLAN ONLY. No application/schema migrations, Shopify changes, product exports or hosting changes implemented by this document. Existing source is a Vite/React browser configurator in `terrain-ring/`; none of the proposed packages/apps/API/database exist. `docs/product-brief.md` and `docs/manufacturing-rules.md` are also absent. Read alongside `production-output.md` and `shape-refinement.md`.

## 1. Decisions and boundaries

- Keep `terrain-ring/` running and the private online preview unchanged while introducing npm workspace packages alongside it. Do not rename/move the app in the foundation milestone.
- One shared terrain pipeline, product-specific mounting and validation. A geographic design is reusable; a product's validation/approval never transfers automatically to another product.
- Existing ring is already an integrated terrain signet. Retain `terrain_ring` as the current product ID, display Terra Ring. Register `terrain_signet` as planned and hide it from purchase until a distinct head/body specification is approved. Its eventual generator can compose ring-body primitives with a different mounting policy; it must not fork the terrain engine or claim to be a new form merely by renaming the old mesh.
- Proposed ring 12–20 mm / 1.8 mm limits conflict with current Bar/Slim dimensions and nominal 1.5 mm palm thickness. Preserve current preview presets in a legacy-preview profile. Store requested new limits as provisional candidate constraints, not retroactive acceptance rules or automatic geometry changes.
- New pendant/signet constraints, material compatibility, bail dimensions and commercial prices are unapproved. Previews and review-only samples may exist; purchase and production release stay disabled.
- Preserve the existing browser preview engine for now. Moving production generation to a server does not make already shipped JavaScript private. New authoritative geometry, signatures, paid quotes and release decisions are server-only. No browser boolean operations.

## 2. Domain and mounting model

TerrainDesignVersion: immutable geographic centre, bbox, CRS, extent in metres, rotation, normalized detail/smoothing intent, relief intent and exact source samples. Store source-elevation range/units/nodata policy, grid dimensions, byte order/encoding, source attribution and algorithm version with its checksum. Do not store product face dimensions in this object. Terrain-height preference is dimensionless; mm relief and physical feature smoothing resolve at the product mount. Keep raw elevation input and any processed snapshot separately identified.

TerrainMount: versioned product-specific mapping: face outline/dimensions, crop policy, local origin/basis, mounting datum, substrate, edge/border policy, physical relief and feature limits, attachment interfaces and finishing zones. It is resolved into and hashed with a ProductConfigurationVersion.

Crop policy is explicit: preserve the saved geographic area, or create a deliberate crop mapping without mutating the terrain version. No silent bounding-box changes on product switch. Aspect changes must preview the chosen crop/letterbox interpretation and require configuration approval. Multiple locations are rejected for now.

ProductConfigurationVersion pins terrain version, product ID, mount policy/version, full resolved options and constraints, geometry algorithm version, material/finish, engraving status, quote reference and configuration hash. Changing size, crop, alloy or constraints creates a new version and invalidates the old quote/approval.

ProductArtefact pins one configuration version and its provenance. Manufacturing STL/mesh-3DM use a pinned manufacturing mesh; preview LOD is a separate artefact purpose, never a production source. Preserve ring engine axes; each product declares local axes and an explicit export transform. mm internally and for STL coordinates/3DM units; GLB, if added later, converts explicitly to metres.

Hash canonical validated JSON plus exact sample hashes using SHA-256. Exclude timestamps and mutable lifecycle state. Terrain signature attests content; configuration signature also binds shop/owner reference, terrain/version, mount, constraints and geometry version. Expiring quote signature additionally binds price/currency/variant/quantity and expiry. HMAC key IDs permit rotation; keys remain server-only. Signatures do not establish ownership, design approval or castability.

## 3. Registry and customer options

| ID | Initial status | Size/options | Mount and generator scope |
|---|---|---|---|
| terrain_ring | active preview | Existing size, head, face, shoulder, profile, material, finish | Adapter around existing generator; purchase disabled |
| terrain_pendant | planned | 14–22 mm; round/oval/cushion/hex candidate shapes; 45/50/60 cm chain | First preview: cushion, integrated fixed loop; more shapes via outline module; removable bail disabled until separate component design |
| terrain_signet | planned | 14–20 mm; size; oval/cushion/round/shield candidates | First preview: cushion, distinct head mount specification required |
| terrain_cufflinks | future | Pairing metadata only | No generator/flow; multiple locations disabled |
| terrain_charm | future | Attachment metadata only | No generator/flow |
| terrain_tie_bar | future | Panel metadata only | No generator/flow |
| terrain_bracelet | future | Wrist sizing metadata only | No generator/flow |
| terrain_locket | future | Chain/compartment metadata only | No generator/flow |
| terrain_object | future | Base/dimension metadata only | No generator/flow |

Each registry entry declares identity, description, lifecycle, generator capability, mount version, available option schema, candidate shapes/dimension ranges, material/finish/engraving/fixing policies, terrain extent limits (unknown if unconfirmed), constraints reference, QC/export profile, pricing-rule reference and nullable Shopify mapping. Product lifecycle, preview availability and purchasability are separate flags.

Candidate limits: ring 12–20 mm width/length, relief <=3.5 mm, wall >=1.8 mm, feature >=0.6 mm; pendant 14–22 mm width/height, relief <=2.5 mm, wall >=1.4 mm, feature >=0.6 mm; signet 14–20 mm width/height, relief <=3 mm, wall >=1.8 mm, feature >=0.6 mm. Approval status is provisional for all. Future products have unknown numerical limits, not made-up production thresholds. Compatibility data is candidate intent until manufacturer approval.

Pendant is its own solid-body generator. Construct terrain top, boundary/frame, reverse and integrated-loop attachment with shared boundary topology, rather than overlapping a torus and slab and calling them fused. Validate the aperture and neck geometrically; attachment strength still needs engineering/maker review. Chain is a separately costed component, not part of the pendant mesh. Reverse engraving is represented and priced independently; engraving geometry remains explicitly unsupported until its subtractive server implementation passes clearance validation. Never export an unengraved mesh as engraved.

## 4. Database schema specification (PostgreSQL + Drizzle)

Use UUID PKs, timestamptz timestamps, JSONB with application Zod validation and SQL checks on critical values, positive integer versions, SHA-256 length/encoding constraints, enum status columns and tenant/owner scoping. JSONB alone is not a validation boundary.

| Table | Main columns and integrity |
|---|---|
| terrain_designs | id, public_id UNIQUE, shop_id, owner_session_id, status enum, current_version_id, location/bbox/centre/rotation/height/detail/smoothing summary, heightmap object key/checksum, terrain_version, design_hash, signature/key_id, created_at/updated_at. Summary is non-authoritative; approved content comes from pinned immutable versions. |
| terrain_design_versions | id, terrain_design_id FK, version, parameters_json, heightmap object key/checksum, terrain_version, checksum, signature/key_id, created_at; UNIQUE(design_id,version), UNIQUE(design_id,id). Version approval recorded separately. |
| product_types | id, slug UNIQUE enum identifier, display_name, description, status enum, supports_terrain_design/requires_size/supports_engraving/supports_chain/supports_multiple_locations, public option metadata, created_at/updated_at. Generator implementation is an allowlisted code registry, never arbitrary DB code. |
| product_type_constraints | id, product_type_id FK, constraint_version, approval_status enum, manufacturer_profile_version_id nullable, numeric width/height/wall/feature/relief/volume candidate limits, allowed materials/finishes/shapes/attachments, validation_rules_json, created_at; UNIQUE(type_id,version), immutable. Constraints may be stricter per alloy/process; unknown remains null, never zero/default pass. |
| product_configurations | id, public_id UNIQUE, shop_id, owner_session_id, terrain_design_id, terrain_design_version_id, product_type_id, constraint_version_id, current_version_id, status enum, options_json/material/finish/engraving summary, price_quote_id nullable, design_hash, signature/key_id, created_at/updated_at. Composite FKs bind design version to its design and constraints to product type. |
| product_configuration_versions | id, product_configuration_id FK, version, configuration_json (fully resolved mount/options), terrain_design_version_id FK, constraint_version_id FK, geometry_version, checksum, signature/key_id, created_at; UNIQUE(configuration_id,version), UNIQUE(configuration_id,id). No mutation after insert. |
| product_artefacts | id, configuration_version_id FK, terrain_version_id FK, product_type_id FK, constraint_version_id FK, geometry_version, kind/format/purpose/status enums, private object key, checksum, byte_length, media_type, created_at. Derived provenance must match configuration version; never update ready file bytes in place. |
| production_jobs | id, configuration_id, configuration_version_id, shop_id, order_gid, line_item_gid, order_number, quantity, status enum, priority, manufacturer_profile_version_id FK, artefact/packet/validation refs, error_code/message, attempts, idempotency_key UNIQUE, created_at/updated_at. Composite FK binds version to configuration; unique order-line/configuration/profile key. |

Supporting tables required for a real implementation: shops/installations (encrypted credentials, isolated from browser), immutable manufacturer_profile_versions, price_quotes (integer minor units, currency, expiry, rule/cost versions, approved status, configuration hash and Shopify merchandise binding), design_approvals (version/hash/owner/time), webhook_deliveries UNIQUE(shop_id,event_id), transactional job_outbox, and production_release_approvals. Minimal anonymous sessions suffice; no customer accounts added.

Enums: terrain draft/ready/archived; configuration draft/preview_ready/quote_pending/quoted/approved/ordered/archived; catalogue active/planned/future/retired; constraint provisional/approved/retired; artefact generating/ready/failed/superseded; purpose preview/review_sample/production; job awaiting_input/queued/generating/validation_failed/export_failed/awaiting_review/released/cancelled/superseded. Check outcomes pass/fail/not_run/not_applicable.

Indexes: tenant + owner + created_at for design/config listing; all FK columns; design/version and configuration/version UNIQUE composites; type/constraint version UNIQUE; job status/priority/created_at for queue polling; artefact configuration/version/purpose; quote hash/expiry; webhook shop/event UNIQUE. Historical references use RESTRICT, not cascading deletion. DB migration adds UPDATE/DELETE-reject triggers to immutable version rows; retired constraints remain available to reproduce old artefacts. Version allocation/current-pointer updates and outbox insertion are transactional.

No database or storage account is provisioned yet. Proposed services: PostgreSQL + private S3-compatible object storage + durable queue + Node worker. The current static Sites preview remains separate; do not pretend it provides PostgreSQL or heavy geometry processing.

## 5. API contracts (planned; no handlers deployed)

All requests/replies use strict Zod schemas and a shared structured error: code, message, field errors and request ID. Reject unknown option fields and out-of-range/unsupported combinations. Owner/session authorization is independent of signatures; use authenticated Shopify app proxy for storefront routing plus scoped anonymous session authorization, request expiry/replay protection, rate limits and body limits. No arbitrary external URL ingestion (SSRF), no arbitrary geometry from the client for production.

| Endpoint | Input -> output / behavior |
|---|---|
| POST /apps/avie/api/terrain-designs | Location, centre, bbox, rotation, detail/smoothing/relief intent -> design public ID and draft version. Server computes hashes/signatures, not client. |
| POST /apps/avie/api/terrain-designs/:id/elevation | Owned version + allowlisted source request -> 202 elevation job; server obtains/validates samples, stores exact bytes and creates immutable ready version. Sealed versions cannot be overwritten. |
| GET /apps/avie/api/product-types[/:slug] | Public registry/preview capabilities/available options. No keys, internal costs, unapproved purchase promises or arbitrary internal generation code. |
| POST /apps/avie/api/product-configurations | Terrain public ID + pinned version, type, option union, alloy, finish, explicit engraving -> configuration/version/hash, compatibility results and preview job. Server resolves constraints/mount. |
| GET /apps/avie/api/product-configurations/:id | Owned configuration with pinned provenance, status and permitted links. Public ID alone is not authorization. |
| GET /apps/avie/api/product-configurations/:id/preview | Owned revision -> 202 while rendering; otherwise preview artefact with short-lived read URL and content hash. Production files never returned here. |
| POST /apps/avie/api/product-configurations/:id/quote | Version + quantity -> unavailable with missing costing, or server-signed price/quote ID, currency, expiry and rule versions. No placeholder zero-price sales. |
| POST /apps/avie/api/product-configurations/:id/cart | Approved configuration version + valid quote ID + quantity + idempotency key -> Shopify cart/checkout reference. Revalidate owner, exact variant/product, quote and constraints; no arbitrary requested amount. |
| POST /webhooks/orders-create | Verified raw-body Shopify event -> persist order/line references and acknowledge after durable intake. No manufacture merely because order exists. |
| POST /webhooks/orders-paid | Verified raw-body payment event -> reconcile actual payment/configuration/quote/variant and enqueue review-only job once. Size/approval/profile missing -> awaiting_input. Maker approval still required before release. |

A new version endpoint can be added later for editing; the foundation service must already append rather than mutate approved snapshots. Async elevation/preview job status returns through the owned design/configuration read endpoint.

## 6. Pricing and Shopify policy

Pure integer-minor-unit calculation from versioned inputs: product base, alloy/mass, size/band, finish, complexity, engraving, chain, attachment, production surcharge; tax/market/shipping policy separate. Rounding rules explicit. Missing rates yield quote_unavailable. Recompute price and pin the signed result server-side; never trust cart properties for price, entitlement or geometry approval.

One logical product mapping per type per shop, nullable until configured: product GID/handle plus variant mapping by approved purchasable options. Only bounded approved Shopify merchandise/price combinations can enter the standard cart initially. Cart line attributes cannot set an arbitrary custom price. Bespoke written quotes outside that mapping use a separately approved draft-order/checkout mechanism; do not silently create a variant per design or choose a pricing mechanism without validation.

Cart attributes contain concise public references: type, terrain ID/version, configuration ID/version, location, material/finish, applicable size/chain, engraving display, safe preview link, configuration hash and opaque signed purchase reference. Private file URLs, meshes, raw samples, secrets and internal costs never enter Shopify. Any user-visible signature/attribute is untrusted on webhook receipt until verified against stored records and actual order lines.

Shopify orders/create is not a payment signal. Verify separate paid topic, deduplicate deliveries, reconcile out-of-order events and handle cancellation/refund events before release. The queue guarantees idempotent job creation through DB uniqueness and an outbox, not exactly-once webhook delivery assumptions.

Official references:
- https://shopify.dev/docs/api/storefront/latest/input-objects/CartLineInput
- https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
- https://shopify.dev/docs/apps/build/webhooks/subscribe/https
- https://shopify.dev/docs/api/webhooks/latest

## 7. File-by-file implementation plan

| Milestone | New/changed files | Reviewable outcome |
|---|---|---|
| M1 foundation | root package.json workspace scripts; packages/shared-types/src/{terrain,configuration,artefact,validation,signatures}.ts; packages/product-types/src/{product-types,mounts,constraints,options}.ts; packages/db/src/{schema,enums}.ts; packages/db/drizzle/0000_product_families.sql; packages/db/src/immutable-versions.sql; docs/{product-brief,manufacturing-rules}.md | Registry, strict boundary schemas, migration specification and immutable snapshot/hash service; test fixture reuse across types. Existing app unchanged. |
| M1 tests | packages/product-types/tests/{registry,compatibility}.test.ts; packages/shared-types/tests/{snapshots,hashes,invalid-input}.test.ts; packages/db/tests/{migrations,immutability,foreign-keys}.test.ts | Unit tests plus local PostgreSQL integration tests, no external APIs. No applied remote migrations. |
| M2 shared extraction | packages/terrain/src/{sampling,processing,snapshot}.ts; packages/geometry/src/products/shared/{types,terrain-relief,edge-falloff}.ts; packages/geometry/src/products/terrain-ring/{index,geometry,constraints,validation}.ts; terrain-ring/src imports/adapters | Existing generator output reproduced within declared numeric tolerance; preserve 396 existing tests and app behaviour. No duplicated terrain engine. |
| M3 expansion previews | packages/geometry/src/products/terrain-pendant/{index,geometry,constraints,validation}.ts; packages/geometry/src/products/terrain-signet/{index,geometry,constraints,validation}.ts; products/shared/{outlines,mesh-validation,wall-thickness}.ts; validation/{common,ring,pendant,signet,index}.ts; worker preview handlers; configurator product/mount selector | Pendant and distinct signet review previews, no future-product generators. Unknown checks never pass. Engraving/fixings unsupported capabilities disabled. |
| M4 pricing/API | packages/pricing/src/{types,base-price,terrain-complexity,material-price,size-price,engraving-price,product-price,index}.ts; apps/api/src/{routes,auth,services}; apps/worker/src/jobs/{elevation,preview}.ts | Owned versioned designs/configurations, async previews and provisional quotes; test DB and fake storage/queue/Shopify adapters. No sales without approved costing. |
| M5 handoff | packages/production/src/{provenance,profiles,package-builder,manifest,specification}.ts; apps/worker/src/jobs/{sample-package,validate-export,render}.ts; STL and rhino3dm services | Product-aware review-only STL + mesh 3DM + PDF/JSON/validation/manifest/three renders/source snapshots; independent reopen checks, no STEP/NURBS claims. |
| M6 commerce | apps/api/src/shopify/{mapping,cart,webhooks}.ts; apps/worker/src/jobs/production.ts; production DB outbox/approval handlers | App-proxy authorization, authenticated/idempotent webhook flow, paid-state reconciliation and held sample jobs. No automated casting/release. |

Existing storefront can remain under terrain-ring rather than adding a second apps/configurator app. Package filenames are organization guidance, not a requirement to create empty modules. Use one cohesive implementation per focused PR; root scripts provide strict typecheck/tests/lint (no linter exists today, so configure it deliberately).

## 8. First milestone acceptance and approval

M1 implements domain schemas, all nine registry definitions, mounts/constraint data, safe compatibility outcomes, stable hashes, server-signing contracts, and Drizzle schema + migration/integration tests locally. It does not install remote infrastructure, migrate production, change the online UI, generate new jewellery, change prices, create Shopify products or enable checkout. No live API routes are promised in M1.

Approval requested for this M1 scope and the following default decisions: retain current ring as-is; register separate signet as hidden/planned pending a distinct form; first pendant is cushion with an integrated fixed loop; all new manufacturing numbers remain provisional. Later milestones each receive focused review.

Manufacturer questions before geometry finalisation: desired pendant face/frame style; alloy-specific wall/feature/relief limits; loop aperture/neck dimensions and chain-end clearance; fixed vs separate bail; signet physical difference from current ring and comfortable weight; engraving method/clearance; mesh-3DM/Rhino version acceptance; shrinkage/support/sprue responsibility; sample acceptance and remake policy. Do not send messages without the user's instruction.
