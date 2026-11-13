# Terra configurator UI refinement — 13 November 2026

The UI uses the existing ring and pendant geometry engines. This change does not alter physical ring dimensions, material costing, production eligibility or Shopify checkout.

## Customer experience

- Bar/Cushion and Slim/Standard/Bold choices have mesh-derived style illustrations, at one example terrain and finger size. These are labelled illustrations, not photographs or a promise of the customer's finished landscape.
- Option groups use native radios with fieldset/legend names, keyboard selection and individual descriptions. Metal, finish, shoulders and band profile explain what changes.
- Review links return to the relevant editing step. Ring settings remain in the store while switching views. Enquiries remain manual: no button claims to send a request or save a design remotely.
- Map failure uses a compact fallback; preset selection, frame rotation and numeric area entry remain available. Cached elevation is distinguished from a customer-saved design; unavailable locations display explicitly labelled example terrain.
- Touch rotation is opt-in on coarse-pointer devices, leaving page scrolling available by default. Camera buttons provide a non-drag alternative. Reduced-motion users get static loading indicators and no orbit damping.
- Loading has finite timeouts, friendly errors and retry actions. Rendering errors do not remove the ring configuration controls.

## Internal pendant review

The pendant route remains `#pendant-preview`; it is not enabled for ordering. The optional collection link appears in development, single-file review builds, or builds explicitly made with `VITE_INTERNAL_REVIEW=true`. This is a presentation switch, not access control. Hosting permissions remain responsible for private previews.

All four existing styles remain available internally. Proposed names, dimensions, availability gates and manufacturing limitations come from the catalogue. Raw engine errors, profile IDs, clay controls and unresolved manufacturing data are in a collapsed inspector. A failed preview shows a labelled style illustration, not a substitute for the requested model.

The inline WASM loader supplies decoded bytes directly to Emscripten, avoiding `fetch(data:)` in single-file review hosts. Failed initialisation can be retried. Hosts that prohibit WebAssembly itself may still fail; the UI reports this without claiming that a model was built.

## Regenerate images

From the repository root run `npm --prefix terrain-ring run thumbnails`. Install root and app dependencies first. The script calls the existing geometry generators and rasterises deterministic projected meshes with resvg. Ten PNGs are committed under the app's public/products directory; no extra WebGL contexts run for option cards.

## Verification and limits

UI tests cover native keyboard choices, accessible group names/descriptions, review editing, preserved ring options, stalled loads, missing terrain and retry after pendant failure. Axe checks structural accessibility of the option panel; colour contrast is checked separately because jsdom cannot measure it. This is not a claim of full WCAG conformance. Desktop/mobile browser review is required alongside the tests. Existing geometry/production regressions, typecheck, lint, normal build and single-file build must pass before merge.

Existing development-tool advisories reported by npm affect the old Vite/Vitest toolchain; this UI change does not upgrade the framework or expose a development server publicly. Review those upgrades separately.
