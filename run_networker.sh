#!/usr/bin/env bash
# Copyright Clean and Green Communities CIC / Litter Networks
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
TARGET_SCRIPT="${SCRIPT_DIR}/apps/litter-networker/run_dev.sh"

exec "${TARGET_SCRIPT}" "$@"
