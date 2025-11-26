#!/usr/bin/env bash

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! node "$SCRIPT_DIR/check-deployed-endpoints.mjs"; then
  echo
  echo "Endpoint golden verification failed. The latest API responses are saved at"
  echo "  deployment-tests/latest-responses"
  echo "Compare them to the committed goldens with"
  echo "  git diff --no-index deployment-tests/goldens deployment-tests/latest-responses"
  echo "When you want to accept the new values, rerun"
  echo "  node deployment-tests/check-deployed-endpoints.mjs --update"
  exit 1
fi
