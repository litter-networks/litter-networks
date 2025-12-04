#!/usr/bin/env bash
# Copyright 2025 Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0


set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
echo "[info] Validating SPDX headers..."
if ! python3 "$REPO_ROOT/tools/license_check.py"; then
  echo "[error] License header validation failed. Run: python3 tools/license_fix.py"
  exit 1
fi

cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

export NODE_PATH="$SCRIPT_DIR/lambda-layer/nodejs/node_modules:$SCRIPT_DIR/node_modules"
export AWS_PROFILE="${AWS_PROFILE:-ln}"

echo "Running API unit tests..."
npm run test

echo "Building TypeScript (if any) ..."
npm run build

echo "Starting LNWeb-API locally on http://local.litternetworks.org:8080 ..."
exec node dist/server.js
