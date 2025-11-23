#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${DEPLOY_BUCKET:-}" ]]; then
  echo "DEPLOY_BUCKET environment variable is required." >&2
  exit 1
fi

echo "Building LNWebReact..."
npm run build

echo "Syncing dist/ to s3://${DEPLOY_BUCKET}..."
aws s3 sync dist "s3://${DEPLOY_BUCKET}" --delete

echo "Remember to invalidate CloudFront if needed."
