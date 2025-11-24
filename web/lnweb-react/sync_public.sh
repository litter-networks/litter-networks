#!/usr/bin/env bash

set -euo pipefail

export TERM="${TERM:-xterm}"

clear

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

start_time=$(date +%s)

run_stage "ESLint" npm run lint
run_stage "TypeScript check" npm run typecheck
run_stage "Vitest suite" npm run test
run_stage "npm audit" npm audit --audit-level=low
run_stage "Vite build" npm run build

run_stage "S3 sync + metadata" \
  python3 scripts/sync_s3_with_metadata.py

total_end_time=$(date +%s)
total_elapsed=$(( total_end_time - start_time ))
echo ""
echo "Total time taken: ${total_elapsed} seconds. ========================="
