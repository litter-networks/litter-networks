<!--
Copyright 2025 Litter Networks / Clean and Green Communities CIC
SPDX-License-Identifier: Apache-2.0
-->

# Repository architecture

This repo contains three deployable surfaces plus shared tooling. Each surface lives in its own workspace folder with scripts for development, testing, and deployment.

## apps/litter-networker (Electron desktop)

| Purpose                                                                          | Entry points                                                                                                                                               | Common commands                                                                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Electron app for moderators to inspect bag counts, costs, and content pipelines. | `apps/litter-networker/src/main/index.ts` (Electron main), `src/renderer/main.tsx` (Vite/React renderer), `scripts/run_dev.sh` (multi-process dev server). | `npm run dev` (renderer + Electron), `npm run build`, `npm run dist`, `./run_local_networker.sh` (root shortcut). |

- Relies on AWS credentials from the user’s environment; never stores keys in the repo.
- Bundles Python utilities from `src/python-utils` during `npm run build` via `scripts/copy-python-utils.mjs`.
- Tests run through Vitest (`npm run test`).

## web/lnweb-api (Express/TypeScript API)

| Purpose                                                                        | Entry points                                                                                                                       | Common commands                                                                                                                               |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Lambda-backed Express API serving stats, join-in data, and legacy CSV exports. | `web/lnweb-api/src/app.ts` (Express app), `src/routes/index.ts` (aggregates routes), `sync_lambda.sh` (build/test/deploy wrapper). | `npm run build`, `npm test`, `./sync_lambda.sh --read-only --skip-golden-checks` (CI validation), `./run_local_api_lnweb.sh` (root shortcut). |

- Uses AWS SDK v3, DynamoDB, and OpenRouteService; secrets loaded from SSM.
- Unit + integration tests live under `src/__tests__` and are executed via Jest.
- Deployment is handled by SAM; the sync script runs lint/audit/tests before packaging and invalidating CloudFront.

## web/lnweb-react (Public React site)

| Purpose                                                                             | Entry points                                                                                                            | Common commands                                                                               |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Static React/Vite site hosted on CloudFront with maps, stats, and onboarding flows. | `web/lnweb-react/src/main.tsx` (Vite bootstrap), `src/routes.tsx` (client routing), `run_local_server.sh` (dev helper). | `npm run dev`, `npm run build`, `npm run lint`, `./run_local_react_lnweb.sh` (root shortcut). |

- Fetches JSON from lnweb-api, renders Leaflet overlays, and precaches assets via Vite.
- Navigation memory for section links lives in `src/shared/navigation/sectionHistory.ts` (see README for expectations).
- Deployments upload the `dist/` bundle to CloudFront via `sync_lnweb-react.sh`.

## Root-level tooling

- `run_local_*.sh` scripts start individual apps or all services together.
- `tools/license_check.py` / `license_fix.py` enforce/repair the Apache 2.0 SPDX header.
- The desktop app now handles documentation conversion/publishing workflows that previously required `convert-docs.sh`.

Use this document as a quick orientation guide when jumping between subprojects or wiring new tooling. For deeper contribution details see `CONTRIBUTING.md` and per-folder READMEs.
