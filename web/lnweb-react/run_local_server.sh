#!/usr/bin/env bash
# Copyright Litter Networks / Clean and Green Communities CIC
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

echo "Running lint..."
npm run lint

echo "Running typecheck..."
npm run typecheck

echo "Running tests..."
npm run test

echo "Starting development server..."
npm run dev
