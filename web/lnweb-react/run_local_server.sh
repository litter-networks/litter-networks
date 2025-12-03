#!/usr/bin/env bash
set -euo pipefail

echo "Running lint..."
npm run lint

echo "Running typecheck..."
npm run typecheck

echo "Running tests..."
npm run test

echo "Starting development server..."
npm run dev
