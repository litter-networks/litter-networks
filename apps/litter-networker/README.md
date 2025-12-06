<!--
Copyright Litter Networks / Clean and Green Communities CIC
SPDX-License-Identifier: Apache-2.0
-->

# litter-networker (Electron desktop)

The desktop companion app helps moderators review bag counts, costs, and content sync jobs. It bundles a Vite-powered renderer, an Electron main process, and supporting Python utilities.

## Development scripts

- `npm install && npm run dev` – installs deps and runs the renderer + Electron shell with hot reload.
- `npm run build` – builds the renderer/main bundles and copies Python utilities into the output folder.
- `npm run dist` – packages the app (AppImage/tarball) for distribution.
- `./run_dev.sh` – convenience wrapper that starts Vite, TypeScript watchers, and Electron together (mirrored by the root `run_local_networker.sh`).

The app uses your local AWS credentials; no secrets live in the repo. When content tooling is required (e.g., docs conversion), the renderer exposes buttons that invoke the Python utilities located in `src/python-utils/`.
