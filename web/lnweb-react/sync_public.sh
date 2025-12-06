#!/usr/bin/env bash
# Copyright Clean and Green Communities CIC / Litter Networks
# SPDX-License-Identifier: Apache-2.0


set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
echo "[info] Validating SPDX headers..."
if ! python3 "$REPO_ROOT/tools/license_check.py"; then
  echo "[error] License header validation failed. Run: python3 tools/license_fix.py"
  exit 1
fi

pushd "${SCRIPT_DIR}" >/dev/null

export AWS_PROFILE="${AWS_PROFILE:-ln}"
export DEPLOY_BUCKET="lnweb-public"
export DISTRIBUTION_ID="${DISTRIBUTION_ID:-E38XGOGM7XNRC5}"
export SMOKE_TEST_URL="${SMOKE_TEST_URL:-https://aws.litternetworks.org}"
export BUILD_INFO_JSON="$(jq -n --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --arg sha "$(git rev-parse --short HEAD)" '{buildTime:$ts, commit:$sha}')"

current_stage="initialisation"

function on_error() {
  echo "Error: The script failed during the '${current_stage}' stage. Exiting..."
}

trap 'on_error' ERR

function print_time_taken() {
  local start_time="$1"
  local label="$2"
  local end_time
  local elapsed
  end_time=$(date +%s)
  elapsed=$(( end_time - start_time ))
  echo "${label} took ${elapsed} seconds."
}

function run_stage() {
  local label="$1"
  shift
  current_stage="${label}"
  echo ""
  echo "${label}... ========================="
  local stage_start
  stage_start=$(date +%s)
  "$@"
  print_time_taken "${stage_start}" "${label}"
}

function sync_assets() {
  if [ "${SYNC_READ_ONLY:-false}" = "true" ]; then
    echo "[info] Read-only mode: skipping S3 sync and metadata updates."
    return 0
  fi
  python3 scripts/sync_s3_with_metadata.py
}

start_time=$(date +%s)

run_stage "ESLint" npm run lint
run_stage "TypeScript check" npm run typecheck
run_stage "Vitest suite" npm run test
run_stage "npm audit" npm audit --audit-level=low
run_stage "Vite build" npm run build

run_stage "S3 sync + metadata" sync_assets

popd >/dev/null

total_end_time=$(date +%s)
total_elapsed=$(( total_end_time - start_time ))
echo ""
echo "Total time taken: ${total_elapsed} seconds. ========================="
