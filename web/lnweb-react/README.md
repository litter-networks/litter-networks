# LNWebReact

The new client-side home for Litter Networks. This project replaces the Handlebars/Express UI with a Vite + React + TypeScript stack, consuming the LNWeb-API for data.

## Getting Started

```bash
npm install
npm run dev
```

Useful scripts:

- `npm run build` – Type-check and create the production bundle.
- `npm run test` / `npm run test:watch` – Run the Vitest suite.
- `npm run lint` – ESLint (type-aware rules).
- `npm run format` / `npm run format:fix` – Verify or apply Prettier formatting.
- `npm run deploy` – Build and sync `dist/` to the bucket defined by `DEPLOY_BUCKET`.

## Project Layout

- `src/router.tsx` – App routing definition.
- `src/layouts/*` – Global chrome, header/footer, and shared layout styles.
- `src/routes/*` – Feature routes starting with the welcome page.
- `src/config/env.ts` – Centralized environment + host configuration.
- `src/lib/httpClient.ts` – Fetch wrapper for LNWeb-API with tests in `*.test.ts`.
- `public/brand`, `public/icons` – Shared static assets copied from the legacy site.

## Environment

Override defaults using standard Vite variables in `.env`:

```
VITE_API_BASE_URL=https://aws.litternetworks.org/api
VITE_CDN_BASE_URL=https://cdn.litternetworks.org
VITE_STATIC_ASSETS_BASE_URL=https://cdn.litternetworks.org
```

## Next Steps

1. Expand LNWeb-API endpoints so the React app can source the same data as the legacy server.
2. Port each Handlebars page into typed React routes, reusing CSS via modules.
3. Replace the placeholder welcome view with the real content, and keep iterating route-by-route.
