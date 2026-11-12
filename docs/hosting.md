# Terra private preview hosting

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
