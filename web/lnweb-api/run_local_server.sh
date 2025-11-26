#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

export NODE_PATH="$SCRIPT_DIR/lambda-layer/nodejs/node_modules:$SCRIPT_DIR/node_modules"
export AWS_PROFILE="${AWS_PROFILE:-ln}"

echo "Building TypeScript (if any) ..."
npm run build

echo "Starting LNWeb-API locally on http://local.litternetworks.org:8080 ..."
exec node dist/server.js
