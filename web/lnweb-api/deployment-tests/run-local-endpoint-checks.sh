#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Clearing previous latest responses..."
rm -rf "$REPO_ROOT/deployment-tests/latest-responses"

echo "Building TypeScript bundle before local golden checks..."
npm run build >/dev/null

export NODE_PATH="$REPO_ROOT/lambda-layer/nodejs/node_modules:$REPO_ROOT/node_modules"
export PORT="${PORT:-18080}"
export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${PORT}}"
export AWS_PROFILE="${AWS_PROFILE:-ln}"

LOG_FILE="${LOG_FILE:-/tmp/lnweb-api-local.log}"
echo "Starting local server for golden checks (logs: $LOG_FILE)..."
node dist/server.js >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && ps -p "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Waiting for local server to be ready..."
for _ in {1..30}; do
  if curl -fsS "$API_BASE_URL/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "$API_BASE_URL/" >/dev/null 2>&1; then
  echo "Local server failed to respond at $API_BASE_URL/ (see $LOG_FILE)"
  exit 1
fi

echo "Running golden checks against $API_BASE_URL ..."
cd "$REPO_ROOT/deployment-tests"
SKIP_TS_BUILD=true API_BASE_URL="$API_BASE_URL" ./run-remote-endpoint-checks.sh
