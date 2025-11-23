#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

clear

# Function to handle errors
function on_error() {
    echo "Error: The script failed during the '$current_stage' stage. Exiting..."
}

# Trap errors and call the on_error function
trap 'on_error' ERR

# Parse arguments
LAMBDA_DEPLOY=${LAMBDA_DEPLOY:-true}

# Start time for the entire script
start_time=$(date +%s)

# Function to calculate and print elapsed time
function print_time_taken() {
    end_time=$(date +%s)
    elapsed=$(( end_time - $1 ))
    echo "$2 took $elapsed seconds."
}

# Run ESLint
# current_stage="ESLint"
# echo ""
# echo "Running ESLint... ========================="
# stage_start=$(date +%s)
# npx eslint src --ignore-pattern "src/public/leaflet/" --ignore-pattern "src/public/js/3rd-party" --max-warnings=0
# print_time_taken $stage_start "ESLint"

# Run npm audit with a low severity threshold
current_stage="npm audit"
echo ""
echo "Running npm audit... ========================="
stage_start=$(date +%s)
npm audit --prefix ./lambda-layer/nodejs/ --audit-level=low
npm audit --prefix ./src/ --audit-level=low
print_time_taken $stage_start "npm audit"

# Run npm test with coverage
# current_stage="Jest tests"
# echo ""
# echo "Running Jest tests... ========================="
# stage_start=$(date +%s)
# npm test
# print_time_taken $stage_start "Jest tests"

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
    sam deploy
    print_time_taken $stage_start "SAM Lambda deploy"
    
    current_stage="Cloudfront Invalidation for Website"
    echo ""
    echo "Cloudfront Invalidation for Website-API... ========================="
    stage_start=$(date +%s)
    aws cloudfront create-invalidation --distribution-id E38XGOGM7XNRC5 --paths "/api/*" > /dev/null 2>&1
    print_time_taken $stage_start "Cloudfront Invalidation for Website-API"  
else
    echo ""
    echo "Skipping SAM Lambda deploy. ========================="
fi

# Total time taken
total_end_time=$(date +%s)
total_elapsed=$(( total_end_time - start_time ))
echo ""
echo "Total time taken: $total_elapsed seconds. ========================="
