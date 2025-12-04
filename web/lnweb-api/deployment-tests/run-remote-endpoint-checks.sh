#!/usr/bin/env bash
# Copyright 2025 Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0


set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! node "$SCRIPT_DIR/check-endpoint-contracts.mjs"; then
  echo
  echo "Endpoint contract validation failed. The latest API responses are saved at"
  echo "  deployment-tests/latest-responses"
  echo "Review the logged errors above or check the latest responses for debugging."
  exit 1
fi
