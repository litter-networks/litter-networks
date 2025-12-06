#!/usr/bin/env bash
# Copyright Clean and Green Communities CIC / Litter Networks
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
TARGET_SCRIPT="${SCRIPT_DIR}/web/lnweb-react/sync_public.sh"

exec "${TARGET_SCRIPT}" "$@"
