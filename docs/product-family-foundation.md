# Product-family foundation (Milestone 1)

Implemented locally, November 2026. The existing browser configurator and hosted preview are unchanged. No live API, remote database, infrastructure account, Shopify product, price, checkout or new geometry generator was created.

## Packages

- `@avie/shared-types`: strict Zod schemas for product-neutral terrain versions, explicit crop intent, product selections, resolved mounts, immutable configuration versions, artefact provenance and validation outcomes. The public entry is browser-safe. `/server` provides canonical SHA-256 hashes, byte-verified snapshot creation and HMAC attestation functions and has a blocked browser export.
- `@avie/product-types`: all nine catalogue definitions, provisional constraint data, separate legacy-ring-preview profile, mount/option resolution and compatibility checks. `/server` creates immutable configuration snapshots referencing a verified terrain hash. Ring/Pendant/Signet data can reference the exact same terrain version without mutation. Future types reject configuration attempts. Pendant/Signet remain non-previewable until their generators exist; everything is non-purchasable.
- `@avie/db`: Drizzle PostgreSQL enums, tables, composite FKs, indexes and local migration tests. Its schema is backend infrastructure, not a browser import. No connection URL or migration deployment command is configured.

Factories validate content and freeze returned objects. Hashes exclude version timestamps; relocating identical terrain bytes does not change a terrain hash. Configuration hashes pin the owner/shop, terrain version/hash, mount/crop, constraints hash/version and geometry version. Signing claims also bind entity/version and purpose. Example test keys are fixture-only; no production keys were created. Signature verification is not authorization and no signing HTTP endpoint exists.

Resolved mount values are policy data, not a wall-thickness measurement or generated part. The legacy ring adapter duplicates only preset dimensions, with a regression test against all six existing presets; terrain/geometry code extraction is Milestone 2. Terrain data is not refetched or reprocessed by these factories.

## Local commands

From the repository root (Node 22.12+, 24 or 26; tested on Node 26):

```sh
npm ci
npm run check          # strict typecheck, new-package lint, foundation tests
npm run format:check
npm run test:all       # foundation plus existing ring tests
npm run db:generate    # generate SQL only; does not apply to any database
npm --prefix terrain-ring run build
```

The ring remains a separate install: run `npm --prefix terrain-ring ci` if its dependencies are missing. Its existing package/lockfile were not migrated into the workspace. Root `node_modules` and lockfile belong to the new packages.

## Database integrity and verification

The eight core domain tables are present, with supporting shops, anonymous owner sessions, manufacturer-profile versions, quotes, design approvals, webhook intake, outbox and release approvals (16 tables total). Content lives in immutable version rows, rather than duplicated mutable JSON summaries on parent tables. Parent rows contain lifecycle, ownership and a pinned current-version pointer. Quotes are separate records referencing a configuration revision; immutable snapshots do not mutate when quote status changes.

Drizzle generates schema SQL and snapshots. `src/immutable-versions.sql` supplies custom PostgreSQL triggers, pointer FKs, provenance checks and the Milestone 1 release hold. Its migration copy must stay identical when maintaining this initial release. Later changes require a new migration, never editing deployed history.

Integration tests run the actual Drizzle migrations twice through the migrator against local, in-memory PGlite PostgreSQL (not SQLite or SQL-text mocks). Tests exercise:

- UPDATE/DELETE/TRUNCATE rejection for version/constraint rows;
- appended terrain versions and valid current-version pointers;
- transaction rollback when a deferred pointer FK fails;
- owner/product/constraint/terrain/artefact provenance mismatches;
- JSON pins matching parent and referenced version values;
- immutable ready artefacts, unsupported job release and duplicate job keys;
- status enums, checksum/signature structure, counters and webhook/outbox uniqueness.

This does not exercise a networked PostgreSQL deployment, credentials, deployment roles, RLS or multi-process concurrency. M1 has no network-accessible backend. SQL integrity constraints are not application authorization; future API services must verify session/shop ownership and validate Zod boundaries. Database owners can change/drop triggers, so deployed service roles must not have DDL privileges. The schema checks provenance and hash format; cryptographic content verification still belongs in the trusted service.

## Deliberate limits

- Product registry status, preview availability, generator availability and purchasability are distinct. Planned registry entries do not produce a pendant/signet mesh.
- Compatibility is configuration-level only. Every mesh/manufacturer check remains not_run and productionReady is always false. Validation report schemas require the common required checks, plus attachment checks for pendants; they do not implement those geometric algorithms.
- No final prices, runtime pricing service, cart handler, webhooks, exports or jobs are implemented. Their table contracts support later milestones; database tests use synthetic fixture records only.
- Declared material compatibility and all candidate constraints are provisional. Legacy ring dimensions are preserved, not retroactively rejected by candidate signet dimensions.
- The previously shipped ring generator remains browser code; adding server-only signing exports does not hide that historical implementation.

## Tooling

Root test/lint tooling is separate from the legacy ring app. Targeted transitive overrides update minimatch used by TypeScript ESLint and esbuild used by Drizzle's legacy loader; checks and migration generation are exercised with those versions. Root npm audit reported no advisories after these changes. This does not claim the unchanged ring application's older dependency graph has been remediated.

Next approved-plan milestone: extract the shared terrain/geometry primitives behind an adapter, preserving the existing ring output and tests before adding new mounts.
