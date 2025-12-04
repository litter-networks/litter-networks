#!/bin/bash
# Copyright 2025 Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0


set -e  # Exit immediately if a command exits with a non-zero status

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
echo "[info] Validating SPDX headers..."
if ! python3 "$REPO_ROOT/tools/license_check.py"; then
  echo "[error] License header validation failed. Run: python3 tools/license_fix.py"
  exit 1
fi

clear

export AWS_PROFILE="${AWS_PROFILE:-ln}"

# on_error prints an error message indicating which `current_stage` failed and notifies that the script is exiting.
function on_error() {
    echo "Error: The script failed during the '$current_stage' stage. Exiting..."
}

# Trap errors and call the on_error function
trap 'on_error' ERR

# Parse arguments
LAMBDA_DEPLOY=${LAMBDA_DEPLOY:-true}
if [ "${SYNC_READ_ONLY:-false}" = "true" ]; then
    echo "[info] Running sync_lambda in read-only mode; skipping deploy/invalidation phases."
    LAMBDA_DEPLOY=false
fi

# print_time_taken prints the elapsed time in seconds since the given start time and echoes "<label> took <seconds> seconds."
function print_time_taken() {
    end_time=$(date +%s)
    elapsed=$(( end_time - $1 ))
    echo "$2 took $elapsed seconds."
}

# Start time for the entire script
start_time=$(date +%s)

# Ensure TypeScript sources are compiled before any other steps rely on dist/
current_stage="TypeScript build"
echo ""
echo "Building TypeScript... ========================="
stage_start=$(date +%s)
npm run build
print_time_taken $stage_start "TypeScript build"

# Run ESLint
current_stage="ESLint"
echo ""
echo "Running ESLint... ========================="
stage_start=$(date +%s)
npx eslint src --ignore-pattern "src/public/leaflet/" --ignore-pattern "src/public/js/3rd-party" --max-warnings=0
print_time_taken $stage_start "ESLint"

# Run npm audit with a low severity threshold
current_stage="npm audit"
echo ""
echo "Running npm audit (allowing moderate warnings)... ========================="
stage_start=$(date +%s)
npm audit --prefix ./lambda-layer/nodejs/ --audit-level=high || true
npm audit --prefix ./ --audit-level=high || true
print_time_taken $stage_start "npm audit"

# Run npm test with coverage
current_stage="Jest tests"
echo ""
echo "Running Jest tests... ========================="
stage_start=$(date +%s)
npm test
print_time_taken $stage_start "Jest tests"

# Run local golden checks before any deployment
current_stage="Local endpoint golden checks"
echo ""
echo "Running local endpoint golden checks... ========================="
stage_start=$(date +%s)
(cd deployment-tests && ./run-local-endpoint-checks.sh)
print_time_taken $stage_start "Local endpoint golden checks"

# Deploy to Elastic Beanstalk (optional)
if [ "$LAMBDA_DEPLOY" = true ]; then
    current_stage="SAM Lambda build"
    echo ""
    echo "SAM Build... ========================="
    stage_start=$(date +%s)
    sam build
    print_time_taken $stage_start "SAM Lambda build"

    current_stage="SAM Lambda deploy"
    echo ""
    echo "SAM Deploy... ========================="
    stage_start=$(date +%s)
    should_invalidate=true
    set +e
    deploy_output=$(sam deploy 2>&1)
    deploy_status=$?
    set -e
    echo "$deploy_output"
    print_time_taken $stage_start "SAM Lambda deploy"
    if [ $deploy_status -ne 0 ]; then
        if echo "$deploy_output" | grep -qi "No changes to deploy"; then
            echo "SAM deploy reported no changes; continuing deployment steps."
            should_invalidate=false
        else
            current_stage="SAM Lambda deploy"
            echo "Error: SAM deploy failed."
            exit $deploy_status
        fi
    fi
    
    if [ "$should_invalidate" = true ]; then
        current_stage="Cloudfront Invalidation for Website"
        echo ""
        echo "Cloudfront Invalidation for Website-API... ========================="
        stage_start=$(date +%s)
        invalidation_id=$(aws cloudfront create-invalidation \
            --distribution-id E38XGOGM7XNRC5 \
            --paths "/api/*" \
            --query "Invalidation.Id" \
            --output text)
        aws cloudfront wait invalidation-completed \
            --distribution-id E38XGOGM7XNRC5 \
            --id "$invalidation_id" > /dev/null 2>&1
        print_time_taken $stage_start "Cloudfront Invalidation for Website-API"
    else
        echo ""
        echo "Skipping Cloudfront invalidation because no changes were deployed."
    fi
else
    echo ""
    echo "Skipping SAM Lambda deploy. ========================="
fi

current_stage="Remote endpoint golden checks"
echo ""
echo "Running remote endpoint golden checks... ========================="
stage_start=$(date +%s)
(cd deployment-tests && ./run-remote-endpoint-checks.sh)
print_time_taken $stage_start "Remote endpoint golden checks"

# Total time taken
total_end_time=$(date +%s)
total_elapsed=$(( total_end_time - start_time ))
echo ""
echo "Total time taken: $total_elapsed seconds. ========================="
