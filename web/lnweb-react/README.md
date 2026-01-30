# lnweb-react

## Purpose and tech stack

- Vite + React 19 + TypeScript powering a single-page app that implements the public LNWeb navigation.
- Vitest is wired up (see `src/lib/httpClient.test.ts`) for unit + RTL suites; Jest is not used here.

## Directory intent

- `features/…` contains feature-specific UI and context logic (e.g., `features/nav/NavDataContext.tsx`), including providers that compose multiple data sources plus navigation helpers.
- `data-sources/…` exposes the React hooks/helper functions (e.g., `useNetworks`, `fetchNearbyNetworks`) that wrap the remote `lnweb-api` endpoints and fetch whatever payload the UI needs. These hook files own caching/deduplication: at the moment they issue fresh fetches on each mount (with local `useEffect`/`useState`) and let feature providers memoize derived values, so there isn’t comprehensive client-side caching yet—if you want to cache network lists or nearby lookups, that logic belongs inside these hooks (memoized fetch results, `Promise` dedup, stale-while-revalidate, etc.).
- `shared/…` holds reusable UI atoms, hooks, or helpers that span multiple features, while `lib/…` keeps low-level utilities (HTTP clients, constants) that don’t depend on React. Keep the distinction consistent by placing React-aware helpers in `shared` and framework-agnostic logic in `lib`.
- `layouts/…` currently houses the `AppLayout` that wraps all routes; if more layouts appear, consider splitting them under clearer subfolders, but for now this folder expresses “route-level scaffolding.”

## Routing notes

- `router.tsx` wires the layout, `RouteErrorBoundary`, and the `/news`, `/join-in`, `/knowledge`, `/maps`, etc. routes; each page sits under `pages/` to keep route-specific UI consolidated.
- `NavDataProvider` resides with the nav feature because it orchestrates navigation state (selected network, redirects, helper builders) across multiple routes, rather than acting as a plain data fetcher.

## Testing/maintenance

- Keep Vitest + RTL suites focused on features/components by mocking `useNavigate`, `useNetworks`, `window.appApi`, or `fetch` as needed.
- New helpers or context logic should update this README if they blur the `features` vs `data-sources` distinction.

## Deployment

- `npm run deploy` executes `sync_public.sh`, which lints, typechecks, runs Vitest, audits dependencies, builds the SPA, and then uploads `dist/` to S3 with metadata enforcement and targeted CloudFront invalidations (via `scripts/sync_s3_with_metadata.py`).
- Required environment variables:
  - `DEPLOY_BUCKET`: target bucket for the static assets (e.g., `lnweb-public`).
  - `AWS_PROFILE`: defaults to `ln` if unset.
- Optional environment variables:
  - `DISTRIBUTION_ID`: when provided, CloudFront invalidations run for only the folders that changed.
  - `SMOKE_TEST_URL`: URL to `curl` after deployment to confirm CDN freshness (e.g., `https://litternetworks.org`).
