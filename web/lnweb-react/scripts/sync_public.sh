#!/usr/bin/env bash

set -euo pipefail

clear

export AWS_PROFILE="${AWS_PROFILE:-ln}"

if [[ -z "${DEPLOY_BUCKET:-}" ]]; then
  echo "DEPLOY_BUCKET environment variable is required." >&2
  exit 1
fi

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

start_time=$(date +%s)

run_stage "ESLint" npm run lint
run_stage "TypeScript check" npm run typecheck
run_stage "Vitest suite" npm run test
run_stage "npm audit" npm audit --audit-level=low
run_stage "Vite build" npm run build

run_stage "S3 sync + metadata" \
  python3 scripts/sync_s3_with_metadata.py

if [[ -n "${SMOKE_TEST_URL:-}" ]]; then
  run_stage "Smoke test (${SMOKE_TEST_URL})" \
    bash -c "curl -fsSL \"${SMOKE_TEST_URL}\" >/dev/null"
else
  echo ""
  echo "Skipping smoke test: SMOKE_TEST_URL not provided. ========================="
fi

total_end_time=$(date +%s)
total_elapsed=$(( total_end_time - start_time ))
echo ""
echo "Total time taken: ${total_elapsed} seconds. ========================="
