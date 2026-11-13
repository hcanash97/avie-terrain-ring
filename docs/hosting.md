# Terra hosting

## Cloudflare Workers (current)

The public prototype is an assets-only Worker named `avie-terra-ring`. It serves the Vite build in `terrain-ring/dist`. A push to `main` deploys it. Any other branch, including a pull request, gets a preview URL when preview builds are enabled. This replaces the ChatGPT Sites preview below. Do not publish another Sites version for an ordinary update.

After the Worker is connected to this repository, production is [https://avie-terra-ring.aviediamonds.workers.dev](https://avie-terra-ring.aviediamonds.workers.dev). The `aviediamonds` workers.dev subdomain belongs to the Cloudflare account. The Worker name in `wrangler.jsonc` must stay `avie-terra-ring`.

No secrets are required. Live elevation (AWS Terrain Tiles) and place search (OSM Nominatim) run in the visitor's browser. Saved preset terrain is in the build, under `baked/`. The pendant boolean engine is the `manifold-3d` `.wasm` file Vite emits into `assets/`. Wrangler sends that file as `Content-Type: application/wasm`.

The site does not use path routing, so `wrangler.jsonc` does not set a single-page-app fallback. Views are hash addresses (`#blank`, `#pendant-preview`) and the production build uses relative asset URLs. Serving `index.html` for a missing path would make those URLs resolve in the wrong directory.

Preview URLs are public, the same as production, unless Cloudflare Access is added later. The Worker does not send `X-Frame-Options`, which leaves room for a later iframe on a hidden Shopify page. That embed is not part of this setup.

### Workers Builds settings

In the Cloudflare dashboard, open the `avie-terra-ring` Worker and go to **Settings** → **Build**. Connect this GitHub repository and enter:

| Setting | Value |
| --- | --- |
| Root directory | `/` (the repository root). Leave the field empty if an empty value means the root. Do not set `terrain-ring`. |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |

The preview field is the non-production branch deploy command. Enable preview builds under **Branch control**.

`npx wrangler versions upload` is the older non-production command. It uploads a Worker version and can mint a version URL, but it does not create a Preview and Workers Builds will not post a preview URL on the pull request. Use `npx wrangler preview` (Wrangler 4.135.0 or newer; this repo pins 4.161.0). Also leave workers.dev preview URLs enabled for the Worker, or the pull-request comment has no link to show.

Node is pinned to 24 in `.node-version`, the same major version CI requests. The Workers Builds image reads that file. Its current Node 24 build is 24.22.1, which is already on the image.

### Commands

From the repository root:

```bash
npm run build:site          # npm ci at the root, npm ci in terrain-ring, then the Vite build
npx wrangler deploy         # production
npx wrangler preview        # preview for the current branch; does not replace production
```

`npm run build` and `npm run build:site` are the same command. `build:site` installs dev dependencies as well (`--include=dev`). The Vite build depends on them. Workers Builds installs the root lockfile before the build command, but `terrain-ring` is not a root workspace, so the build command still has to install it. The root `package.json` has no other `build` script; the dashboard's usual `npm run build` has to be this one, or the build stops before `terrain-ring/dist` exists.

### What can fail on the build image

- The root `package.json` sets `"packageManager": "npm@10.9.9"`, the npm that wrote the root lockfile. Workers Builds installs that npm before `npm ci`. It does not read `engines.npm`, and its own default is 10.9.2, which can reject a lockfile written by a newer npm. The configurator lockfile is installed with the same npm.
- Do not set the build variable `NODE_ENV` to `production`. That makes `npm ci` skip dev dependencies. `build:site` passes `--include=dev` so a dashboard override does not drop Vite or TypeScript.
- Do not point the root directory at `terrain-ring`. Wrangler, `.node-version`, both lockfiles and `packages/` are at the repository root. A root install alone does not install the configurator.
- The free plan allows 20,000 static files per version and 25 MiB per file, and 100,000 requests a day. This site is a few megabytes and a few dozen files. Each visit still counts as a Workers request.
- The build does not need AWS, Nominatim, Google Fonts or any API token. Those are browser requests after the page loads. If they are blocked for a visitor, preset places still fall back to the saved terrain PNGs.

## Superseded: ChatGPT Sites preview

The owner-private ChatGPT Sites preview is no longer the hosted copy. GitHub pushes never updated it. Kept below so the Site identity is not lost. Do not change its audience, and do not create a second Site.

URL: https://avie-terra-ring-preview.aware-swift-8528.chatgpt.site
Audience: owner-private, ChatGPT sign-in required. Do not change audience without user direction.
Sites project ID: `appgprj_6af5f4cfb3b88191861dc93139cb3cab`
Version 1 published successfully on 12 November 2026 from GitHub application revision `a7c4afe`.

Deployment checkout: `/Users/hamishnash/Documents/ChatGPT/À Vie Diamonds/sites/terra-ring-preview`
Its `.openai/hosting.json` records the Site identity and `dist` static directory. The separate Sites source repository is managed by the Sites workflow; the private GitHub repo remains the application source of truth. No credentials are stored in this document.

For updates: reuse the existing Site and its source repository; sync the intended GitHub application revision into that checkout, build production assets, use the Sites source helper to commit/push/package, then save/deploy preserving owner-only access. Never create a second Site for an ordinary update. GitHub pushes do not automatically update the hosted preview.

This static preview has no checkout, paid-order pipeline or manufacturer exports. Dev-only inspection/capture tools are excluded by the production build. External map/search/elevation services still require connectivity. The laptop can sleep or shut down without stopping the hosted preview.

## Shared-engine source updates

After Milestone 2, copying only the app source into the deployment checkout is insufficient. Preserve this Site ID and its `.openai` identity, sync the complete workspace (`packages/`, root manifests/lockfile and `terrain-ring/`), install root and app dependencies, and build with `npm --prefix terrain-ring run build`. Stage the resulting `terrain-ring/dist` contents into the deployment checkout’s root `dist/` before using the Sites source packaging workflow. That keeps the existing supported `static.directory: dist` manifest. Source and build must be committed/packaged from the same checkout. Do not create another Site or publish raw source as static assets. The current online version has not been changed by this extraction.
