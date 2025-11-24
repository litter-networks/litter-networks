# lnweb-api

## Purpose and stack
- Express app that serves the LNWeb API, packaged for Lambda with `aws-serverless-express` and a dedicated Lambda layer (see `lambda-layer/`).
- Includes middleware, routing, and error handling synced with `src/routes/index`, exposed via `lambdaHandler` in `src/lambda.js`.

## Directory intent
- `src/app.js` initializes the Express app, applies CORS, JSON parsing, logging, and mounts the router; `app.js` returns a shared `app` instance used by both local runs and the Lambda handler.
- `src/routes/…` hosts the actual endpoint handlers (info, stats, knowledge, etc.), so review that folder when extending functionality or middleware.
- `lambda.js` transforms API Gateway events to the `aws-serverless-express` shape, proxies them via `PROMISE` mode, and returns the HTTP-level response to API Gateway function URLs or Function URLs.
- `lambda-layer/` contains the shared dependencies that are bundled separately for Lambda.

## Testing
- Jest suites under `src/__tests__/unit` mock controllers/services, while `src/__tests__/integration` boots the real Express app with mocked AWS clients to verify middleware, caching headers, and error handling.
- Keep `NODE_PATH` configured as in `package.json` so both the app’s and layer’s node_modules are resolvable during tests.
- Deployment smoke tests live in `deployment-tests/check-deployed-endpoints.mjs`. Use `node deployment-tests/check-deployed-endpoints.mjs --update` to refresh the golden fixtures located in `deployment-tests/goldens/`, or run the script without `--update` as a quick post-deploy health check.

## Deployment notes
- Local testing uses `run_local_server.sh` or `test-lambda.js`; deployment is coordinated via `template.yaml` + `sync_lambda.sh`.
