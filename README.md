# litter-networks

A single repository containing the web, API, and desktop tools that power Litter Networks. The code you see here drives the React public site, the express-based API, and the Electron-based `litter-networker` companion for admins who coordinate the clean-up community from their desktops. The goal is transparency, critique, and shared improvement; the project is still run by volunteers, so extra hands aren’t strictly required right now, but the code is open so you can review, suggest, or help us polish things.

## Repository structure

- `web/lnweb-react` – the public-facing React app served by CloudFront and built with Vite. It renders maps, stats, and join-in flows and is optimized for browsers and the static CDN.
- `web/lnweb-api` – the Express/TypeScript backend that proxies OpenRouteService, reads from DynamoDB, and exposes the JSON data used by both the React app and the desktop admin tool. Deployments rely on SAM/CloudFront (see `web/terraform`).
- `web/terraform` – Terraform definitions for CloudFront, cache policies, and the routes your CDN uses to reach Lambda and S3 origins.
- `apps/litter-networker` – the Electron + React admin client that talks to AWS DynamoDB/S3, builds Python helpers, and surfaces operational data for trusted moderators.
- `apps/litter-networker/src/python-utils` – supporting Python scripts that generate docs, logos, and other artifacts before they are pushed to S3 and DynamoDB.

## Key components

### `web/lnweb-react` (Public website)

- Uses Vite + React Router to surface the public site, map overlays, and general info about Litter Networks.
- Hit `npm run dev` to run a local Vite server, `npm run build` to prepare a CI deploy, and `npm run deploy` (calls `sync_public.sh`) to publish static assets.
- Includes shared assets in `public/` (icons, CSS, Leaflet, etc.) and can run Vitest for unit tests (`npm run test`).

### `web/lnweb-api` (Express backend)

- TypeScript/Node API that loads secrets from Parameter Store (e.g., `/LNWeb-API/OPENROUTE_API_KEY`) and handles routes such as `/api/maps/*`, `/area-info`, and other REST endpoints.
- Built with `tsc -p .` and tested via Jest; deployments happen via SAM/Lambda (see `web/lnweb-api/template.yaml` for IAM permissions and layers).
- The `sync_lambda.sh` script will build, test, run audits, and optionally `sam deploy`; it also invalidates CloudFront when changes reach the origin.

### Terraform & supporting services

- `web/terraform/cloudfront.tf` defines the CloudFront distributions, cache policies, OAC, and response headers for both the dynamic API and the static CDN buckets.
- `spa-rewrite.js` implements the CloudFront Function for SPA routing.

### `apps/litter-networker` (Electron desktop)

- Builds a React renderer, an Electron main process, and bundles the Python utilities (`copy-python-utils.mjs`, `run_dev.sh`) so administrators can run the app locally or as a packaged release (`npm run dist`).
- Talks directly to DynamoDB/S3/CloudWatch via the AWS SDK using the caller’s profile (`AWS_PROFILE=ln` by default). Environment variables (`AWS_REGION`, `CDN_BUCKET`, etc.) keep prod/test behavior configurable.
- Ships utilities for looking up networks, costs, bags, and content-sync jobs, and it boots a Python virtualenv when legacy scripts are required.

Scripts worth noting:

```
# install/build the renderer + Electron bits
npm run build
# run all dev servers (renderer + ts watchers + Electron shell)
npm run dev
# package an AppImage / tarball
npm run dist
```

## Getting started

1. `npm install`/`npm ci` at the root for workspace scripts, then install per-package dependencies inside each subfolder (`apps/litter-networker`, `web/lnweb-react`, `web/lnweb-api`).
2. Node 18+ is required for the backend; the Electron app relies on Vite (Port 5173 by default) and TypeScript for the renderer+main build.
3. AWS access comes from your local credentials (`~/.aws/credentials`) plus env vars. No AWS credentials are stored in the repo.
4. If Python scripts are involved, `npm run build` in `apps/litter-networker` also runs `copy-python-utils.mjs` and installs the `.venv` before executing the helper scripts.

## AWS access & deployments

We run deployments using AWS resources defined in `web/terraform` and `web/lnweb-api/template.yaml`. If you need access to any of the AWS services (DynamoDB, S3, Lambda, CloudFront), please contact dev@litternetworks.org; access is granted on a case-by-case basis. At the moment we don’t have capacity for large pull requests, but we welcome critiques, bug reports, and suggestions via email.

## Contributing & feedback

While we don’t have a formal contribution backlog, you can:

- Open issues with observations, typos, or architectural questions.
- Email dev@litternetworks.org with recommendations, especially if you spot security or scaling gaps.
- Reference `CONTRIBUTING.md` when touching new files for the preferred SPDX notice.

## License header enforcement

All source files in this repo must begin with the two-line Apache 2.0 SPDX header. The enforcement script lives in `tools/license_check.py`, and the desktop/web/service starter scripts invoke it before running. If you need to add the header to multiple files, run `python3 tools/license_fix.py` (or with `--dry-run` to preview) to auto-apply it.

## Automation scripts

The `sync_lambda.sh` and `sync_public.sh` helpers accept `SYNC_READ_ONLY=true` so CI can exercise their lint, audit, test, and build stages without triggering AWS deployments or invalidations. The GitHub Actions defined under `.github/workflows/` rely on that read-only mode.

## Licensing

This repository is licensed under the Apache License 2.0—see `LICENSE` for the full text. All new files should use the short SPDX notice described in `CONTRIBUTING.md`.
