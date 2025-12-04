# litter-networks

A single repository containing the web, API, and desktop tools that power Litter Networks. The code you see here drives the React public site, the express-based API, and the Electron-based `litter-networker` companion for admins who coordinate the clean-up community from their desktops. The goal is transparency, critique, and shared improvement; the project is still run by volunteers, so extra hands aren’t strictly required right now, but the code is open so you can review, suggest, or help us polish things. For a deeper breakdown of each surface (entry points, commands, and responsibilities), see `docs/architecture.md`.

## Repository structure

- `web/lnweb-react` – the public-facing React/Vite app served via CloudFront. It renders maps, stats, and onboarding flows, and fronts the CDN for users.
- `web/lnweb-api` – the Express/TypeScript backend that proxies OpenRouteService, reads from DynamoDB, and provides the JSON used by both the React site and the desktop admin tool. Deployments rely on SAM + CloudFront (Terraform lives in `web/terraform`).
- `apps/litter-networker` – the Electron + React admin client that trusted moderators run locally to sync content, review stats, and manage bag counts. Supporting Python utilities ship under `apps/litter-networker/src/python-utils`.
- `tools/`, `run_local_*.sh`, `sync_*` – shared scripts for linting, license enforcement, and launching the various surfaces.

See `docs/architecture.md` for per-surface entry files, dev commands, and deployment notes.

## Notable behaviors & conventions

- **Navigation memory (React site):** `web/lnweb-react/src/shared/navigation/sectionHistory.ts` stores at most one path per top-level section (Welcome, Join In, News, Knowledge) in `localStorage`. The header reuses that path the next time the visitor clicks the section link, so please update the section history whenever you add new section landing routes.
- **Secrets & infrastructure (API):** `web/lnweb-api` loads API keys from SSM and deploys through SAM; Terraform in `web/terraform` wires CloudFront, cache policies, and SPA rewrites.
- **Desktop automation:** `apps/litter-networker` packages Python helpers during `npm run build` and talks directly to DynamoDB/S3 using the caller’s AWS profile. The root shortcuts (`run_local_networker.sh`, etc.) mirror the per-package `run_dev.sh` scripts.
- **License enforcement:** Every source file starts with the Apache 2.0 SPDX header. Run `python3 tools/license_fix.py` if you need to repair headers en masse.

## Getting started

1. `npm install`/`npm ci` at the root for workspace scripts, then install per-package dependencies inside each subfolder (`apps/litter-networker`, `web/lnweb-react`, `web/lnweb-api`). For the API we also install the SAM lambda layer modules so `express` and the AWS SDK are available to tests:

   ```
   cd web/lnweb-api
   npm install
   npm --prefix lambda-layer/nodejs install
   ```
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

The `sync_lambda.sh` and `sync_public.sh` helpers support a read-only mode so CI can exercise their lint, audit, test, and build stages without triggering AWS deployments or invalidations. You can either set `SYNC_READ_ONLY=true` or call `sync_lambda.sh --read-only` (the flag sets the same mode). When running in CI you can also set `SKIP_ENDPOINT_CONTRACT_CHECKS=true` (or pass `--skip-golden-checks`) to skip the local/remote endpoint contract checks that require production data; the lnweb-api workflow already does this.

## Endpoint contracts

The API deployment test (`deployment-tests/check-endpoint-contracts.mjs`) now validates responses against the declarative `deployment-tests/endpoint-config.json` schema/anchor rules instead of comparing static golden files. Each endpoint definition includes the expected shape (JSON or CSV headers) plus anchor rows such as `anfieldlitter` or `lymmlitter` to keep the smoke checks meaningful while allowing routine data drift. If the contract fails, the latest response files remain under `deployment-tests/latest-responses/` and the error output reports which path/anchor triggered the regression.

## Licensing

This repository is licensed under the Apache License 2.0—see `LICENSE` for the full text. All new files should use the short SPDX notice described in `CONTRIBUTING.md`.
