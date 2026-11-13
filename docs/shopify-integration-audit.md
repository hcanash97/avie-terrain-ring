# Shopify integration audit and plan

Status: audit only, 13 Nov 2026. No code was changed for this report. It was written from the repository at `main` (`7ad8d8a`), the built configurator, and the public storefront.

Milestone goal: a customer opens the designer on an **unpublished** Shopify theme, saves a design, and submits an enquiry; staff can then review the exact saved version. Payment and manufacturing release stay manual and come later.

## 1. Answers to the audit questions

| # | Question | Finding | Evidence |
|---|---|---|---|
| 1 | What framework runs the configurator? | React 18, Three.js 0.169, Zustand and Leaflet, built with Vite 5. It is a single-page app mounted on `#root`. | `terrain-ring/package.json`, `terrain-ring/src/main.tsx` |
| 2 | What command builds it? | `npm --prefix terrain-ring run build` (`tsc --noEmit && vite build`). It outputs `terrain-ring/dist`: one 864 KB JS file (256 KB gzipped), 30 KB of CSS, and the baked terrain PNGs. | built on 13 Nov |
| 3 | Where is it hosted? | **Static only.** There's an owner-private preview on ChatGPT Sites, and earlier review copies went to a claude.ai artifact and Netlify Drop. Nothing runs server-side. | `docs/hosting.md` |
| 4 | Which backend routes exist and work? | **None.** The API is documented as "planned; no handlers deployed". | `docs/product-family-plan.md` §5 |
| 5 | Is the database connected or merely defined? | **Defined and tested, not connected.** Drizzle schema with 3 migrations, tested in-process with PGlite. No runtime reads `DATABASE_URL`, and no database is provisioned. | `packages/db`, `packages/db/tests/migrations.test.ts` |
| 6 | Are designs saved server-side? | **No.** Designs live only in browser memory (Zustand). There's no local storage and no share link; refreshing loses the design. | `terrain-ring/src/state/*` |
| 7 | Is the original elevation data retained? | **No, not for customer designs.** See the detail below. | `terrain-ring/src/three/heightmap-loader.ts`, `packages/production/src/ring-source.ts` |
| 8 | Are approved design versions immutable? | **Enforced in the schema, unused at runtime.** Version tables are append-only, with triggers rejecting UPDATE, DELETE and TRUNCATE; provenance checks and current-version pointers are in place. All tested on PGlite. | `packages/db/src/immutable-versions.sql` |
| 9 | Does a Shopify app already exist? | **No.** There's no `shopify.app.toml`, no extensions, no Liquid and no Shopify CLI project. | repository search |
| 10 | Is Shopify authentication implemented? | **No.** There's no app-proxy signature check, webhook HMAC, OAuth or session handling. The schema has `shops`, `owner_sessions` (hashed tokens) and `webhook_deliveries` tables ready for it. | `packages/db/src/schema.ts` |
| 11 | Is the 3DM/STL exporter implemented and tested? | **Yes, as a local CLI; partly incomplete.** See the detail below. | `packages/production` |
| 12 | What automated tests and CI run? | **Tests run locally only; there is no CI.** `npm run check` runs typecheck, lint (0 warnings) and 57 workspace tests (1 skipped). `npm --prefix terrain-ring test` runs 396 configurator tests. There's no `.github/` folder, so nothing runs on pull requests. | `package.json` |
| 13 | Which product types have working geometry? | **Ring only** (bar and cushion; 3 face sizes; 3 shoulders; 3 band profiles). The pendant and signet exist only as registry entries, schemas and provisional constraint profiles, with no geometry. | `packages/geometry/src/products`, `packages/product-types` |
| 14 | What is documentation-only? | The API contracts, the worker, pricing, Shopify product mapping, cart and webhooks, the production spec PDF, and the hosting for the API, database and storage. | `docs/product-family-plan.md`, `docs/production-and-expansion-plan.md` |

**Detail for question 7 (elevation data).**
- The configurator fetches public Terrarium elevation tiles in the browser (AWS open data) and keeps the samples in memory only.
- The production builder can only read the 7 baked preset PNGs (`loadSavedTerrain`), so it can't yet build a ring from a customer's own location.
- `packages/terrain` already has `decodeHeightmap`, `sourceFromGrid` and `replayTerrainSource` for replaying a saved float32 grid, but nothing stores one yet.

**Detail for question 11 (exporter).**
- **Built and tested:** binary STL, Rhino 3DM (triangle mesh, mm), the validation report, the spec JSON, the SHA-256 manifest, reopen checks, and deterministic hashes.
- **Missing:**
  - the production spec PDF;
  - headless renders (they're passed in by hand today);
  - building from a saved customer design (presets only);
  - private storage for issued packages.
- **Open finding:** 12 cushion configurations, on Matterhorn and Table Mountain, read below the 0.9 mm design substrate on the structural-wall measure. Not yet investigated.

### Storefront and theme (checked 13 Nov)
- **Live theme:** "Version 5.1 - 10/11/26", schema **Craft 15.5.0**, role `main`, `theme_store_id: null` (a customised copy). Craft is a Shopify Online Store 2.0 theme, so JSON templates and app blocks are expected to work. This still has to be confirmed on an unpublished duplicate using Shopify's theme-support check.
- **Theme tokens on the live site:** background `239,236,236` (#EFECEC), text `37,37,37` (#252525), buttons `63,81,71` (#3F5147), font Trirong. These match the palette already in the configurator, so they no longer need extracting. The theme's own CSS variables, such as `--font-body-family`, still need confirming as the source of truth.
- `/pages/design-your-terra` returns 404. The page doesn't exist yet.

## 2. Implemented, incomplete, documented, missing

| Area | Implemented and tested | Implemented but incomplete | Documented only | Missing |
|---|---|---|---|---|
| Configurator UI | Ring designer, live and baked terrain, 396 tests | Mounts only on `#root`; global CSS reset (`html`, `body`, `button`, `h1`…); analytics placeholder; final CTA is "Next steps" plus a contact link | — | `mountDesigner()` and `destroy()` lifecycle; scoped CSS |
| Terrain engine | Processing, relief scaling, saved-grid replay | — | Server-side elevation fetching job | Storage of customer elevation grids |
| Geometry and validation | Ring geometry; validator v2 (structural wall, feature size, rim angle) | Cushion structural-wall finding uninvestigated | Pendant and signet geometry | — |
| Database | Schema, immutability, provenance, PGlite tests | — | — | A provisioned database, migration runner, runtime connection |
| Designs and versions | Schema (`terrain_designs`, `product_configurations`, versions, owner sessions) | — | API contracts | Routes, services, guest access |
| Quotes and enquiries | `price_quotes` (a priced quote record) | — | Quote API contract | An **enquiry** record with customer contact details, a reference and an idempotency key; notifications |
| Staff review | — | — | — | Any admin interface |
| Shopify | — | — | Product mapping, cart, webhooks | App, theme extension, app proxy, authentication |
| Production package | CLI package for preset terrain | Spec PDF, renders, customer terrain, private storage | — | Job intake from orders |
| Production jobs | Schema; deduplicated webhook intake test | Uniqueness is order + line + revision, **not per unit** (two rings on one line become one job) | — | Worker |
| CI | — | — | — | GitHub Actions |

## 3. Current deployment architecture

```text
Browser (static SPA)
  ├─ Terrarium elevation tiles (AWS, public)      ← client fetch
  ├─ OSM / Esri map tiles, Nominatim search        ← client fetch
  └─ No backend; nothing is saved

Local machine only
  └─ npm run package  → review-only manufacturer package (preset terrain)
```

There's no server, database, object storage, queue, email or Shopify app.

## 4. Shopify integration approach (recommended)

Build **one Shopify app**, made with the Shopify CLI on its current Node template (React Router at the time of writing). Add it as a workspace in this monorepo, so the existing packages are reused rather than copied. It covers four things:

1. **Theme app extension:** the "À Vie terrain designer" app block. Its JS and CSS are **generated from the existing `terrain-ring` build** through a library-mode entry that exports `mountDesigner(element, options)`. The files are never hand-maintained copies.
2. **App proxy:** `prefix = "apps"`, `subpath = "avie"`, so storefront calls go to `/apps/avie/api/...`.
   - Every request is checked with the framework's app-proxy verification.
   - Design access is then checked **separately**, using a guest access token. Its hash goes in the existing `owner_sessions.token_hash`. The token is sent in a request header, never in a URL, and never logged.
3. **Embedded admin pages** for staff review, authenticated by Shopify admin session tokens. Only staff with access to the app can see enquiries. No separate login has to be built.
4. **Database:** the existing `@avie/db` Drizzle schema on PostgreSQL, plus a migration runner. Shopify session storage uses the same database; the adapter must be confirmed for the chosen template.

**What this reuses:**
- the saved-design tables, versions and immutability triggers;
- `owner_sessions`;
- `webhook_deliveries` and the outbox (later);
- `packages/terrain` replay;
- the shared-types Zod schemas;
- the production package builder (later).

**What it doesn't change:** ring geometry, the measurement-only validation work, and the standalone preview build.

### Conflicts and corrections to resolve
1. **Cart versus draft orders.** `docs/product-family-plan.md` planned variant mapping plus cart, and kept draft orders for bespoke quotes. The new brief makes draft orders the route for this release. **Recommendation:** follow the brief (quote, then staff approval, then a draft order and invoice), and mark the cart route as deferred in that document.
2. **The enquiry is not a price quote.** `price_quotes` stores a priced, expiring quote. A customer enquiry with contact details needs a **new** `quote_requests` table, which is justified because nothing equivalent exists. It also needs a notification outbox entry. Staff pricing then uses `price_quotes`.
3. **Ring size.** The schema stores `innerDiameterMm`. The UK chart in `ring-sizing.ts` follows the ISO 8653 convention, but it is marked "confirm against your caster's mandrels" and **has not been verified with your maker**. **Recommendation:** store the size label and a `sizingTableVersion` alongside the diameter, and label the chart unverified until the maker confirms it.
4. **Elevation provenance.** The browser's samples can't be trusted as the source of record. **Recommendation:** at save time, the server fetches the same Terrarium tiles for the saved bounding box, stores the float32 grid privately with its checksum, and creates an immutable terrain version. This follows the existing `replayTerrainSource` design. Tile attribution must be recorded in the saved parameters (the schema already requires it).
5. **Production jobs are per line, not per unit.** This needs fixing before Gate C, by adding a unit index to the uniqueness rule. It doesn't block this milestone.

## 5. Exact files to change (first stop point)

New:
- `.github/workflows/check.yml`: typecheck, lint, workspace tests, configurator tests, configurator build.
- `apps/shopify/` (from the Shopify CLI template):
  - `shopify.app.toml` (with the app proxy)
  - `app/routes/proxy.api.designs.ts`
  - `app/routes/proxy.api.quote-requests.ts`
  - `app/routes/app.enquiries._index.tsx`
  - `app/routes/app.enquiries.$id.tsx`
  - `app/services/{design-service,design-access-service,quote-request-service,elevation-service}.ts`
  - `app/db.server.ts`
- `apps/shopify/extensions/avie-designer/`:
  - `blocks/terrain-designer.liquid`
  - `locales/en.default.json`
  - `assets/` (build output only)
- `terrain-ring/src/embed.tsx`: `mountDesigner()` and `destroy()`.
- `terrain-ring/vite.embed.config.ts`: library build into the extension's `assets/`.
- `terrain-ring/src/components/QuoteRequestForm.tsx`
- `terrain-ring/src/services/{design-client,quote-client}.ts`
- `packages/db/drizzle/0003_quote_requests.sql`: `quote_requests` table and notification outbox (see §4.2).

Changed:
- `terrain-ring/src/styles.css`: scope every rule under `.avie-designer-root`, with no `html`, `body` or global element resets in the embedded build.
- `terrain-ring/src/main.tsx`: the standalone preview calls `mountDesigner()` too.
- `terrain-ring/src/components/StepReview.tsx` and `Configurator.tsx`: the final CTA becomes "Save and request a quote".
- `packages/db/src/schema.ts`: the `quote_requests` table and outbox.
- `packages/shared-types`: the ring selection gains a size label and sizing-table version.
- `docs/product-family-plan.md`: draft orders replace the cart route for this release.

Untouched: `packages/geometry`, `packages/terrain` processing, and the validation and production packages.

## 6. Accounts, scopes and environment variables

**Accounts you need to create or decide on:**
- **Shopify:**
  - a Shopify Partner (or Dev Dashboard) account;
  - a **development store** for staging;
  - later, installing the app on the live store as a custom app;
  - an **unpublished duplicate** of the live theme for testing on the live store.
- **App host:** a Node host for the app, e.g. Fly.io, Render or Railway.
- **PostgreSQL:** e.g. Neon or Supabase, with separate staging and production databases.
- **Private object storage:** e.g. Cloudflare R2 or S3. The bucket must not be publicly listable.
- **Enquiry notifications:** a transactional email provider, or staff checking the admin page (no email) for the first release.

**Access scopes** (confirm against current Shopify docs when the app is created):
- This milestone needs no Admin API scopes for storefront data. The app proxy is set up in app configuration; whether it needs a scope depends on the current Shopify version, so check when creating the app.
- **Later (draft orders):** `write_draft_orders`.
- **Later (payment intake):** `read_orders`, plus Shopify's protected customer data approval for order and customer fields.

**Environment variables** (server-only unless marked):

```env
# Browser-safe (baked into the block at build time)
VITE_API_BASE=/apps/avie/api

# Server only
SHOPIFY_API_KEY=            # provided by the Shopify CLI per environment
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=
SCOPES=
DATABASE_URL=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
DESIGN_SIGNING_SECRET=      # HMAC for version signatures (schema key_id supports rotation)
NOTIFY_EMAIL_TO=            # optional, if email notifications are chosen
```

Rules:
- Nothing Admin-related goes in `VITE_*`.
- Staging uses its own store, database and bucket.
- Unit tests need no live credentials (PGlite and fakes).
- Migrations run only from the main branch deploy, never from previews.

## 7. Implementation plan (small, ordered pull requests)

Stop point for this milestone: **PR 7**.

| PR | Scope | Done when |
|---|---|---|
| 0 | This audit | Reviewed by you |
| 1 | **CI:** GitHub Actions running every existing check and the build | Checks show on pull requests |
| 2 | **Shopify app scaffold** in `apps/shopify`, connected to a dev store; database and migration runner wired; no customer features | The app installs on the dev store; migrations apply to staging Postgres |
| 3 | **Embeddable designer:** `mountDesigner`/`destroy`, scoped CSS, library build; the standalone preview still works | Tests: mount/unmount twice leaves no WebGL contexts, listeners or Leaflet maps behind; no global style leakage |
| 4 | **Theme app block** on the dev store, then on an unpublished duplicate of the live theme at `/pages/design-your-terra` | The designer loads in the theme editor and on the preview link; works when the section is added or removed; theme fonts and colours confirmed |
| 5 | **Persistent designs:** app-proxy verification, guest token, `POST /apps/avie/api/designs`, server-side elevation fetch and storage, immutable versions, owner-only `GET` | A saved design survives closing the browser; another visitor gets 404/403; versions can't be edited; tests for signature, access and immutability |
| 6 | **Quote requests:** table and outbox migration, idempotent route, form, confirmation ("Nothing has entered production") | A retry with the same key creates one enquiry; a failed notification doesn't lose it; the reference links to the exact design version |
| 7 | **Staff review:** embedded admin list and detail, showing the exact version, 3D preview from the saved version, validation coverage, and separate quote and manufacturing statuses, plus notes | Only app staff can open it; it shows exactly what the customer saved |

After the stop point, still in the brief's order:
- **F:** draft order and invoice from a staff-approved quote, with an explicit send step.
- **G:** verified paid-order webhook, then one production request per unit, then the review-only package built from the saved terrain, with manual release.
- **H:** the pendant prototype through the existing product registry.

Each needs your approval before it starts.

## 8. Risks and open questions
- **Bundle size:** 864 KB of JS. Shopify's limits and guidance for theme app extension assets must be checked. The likely fix is code-splitting the 3D viewer and map so the block's first load is small.
- **Third-party tiles:** OSM and Nominatim usage policies limit heavy production use. A commercial tile and geocoding provider (the deferred Mapbox decision) may be needed before going live.
- **Personal data:** quote requests store names and emails. They need a privacy-policy entry, a retention period, and staging kept free of production data.
- **Unverified items:** the ring-size chart and all manufacturing minimums are still unverified. The storefront must say a quote is not a production commitment.
- **Cushion structural-wall finding:** to investigate before quoting cushion rings on Matterhorn and Table Mountain.
