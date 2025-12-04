#!/usr/bin/env bash
# Copyright 2025 Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
TARGET_SCRIPT="${SCRIPT_DIR}/web/lnweb-api/run_local_server.sh"

exec "${TARGET_SCRIPT}" "$@"
