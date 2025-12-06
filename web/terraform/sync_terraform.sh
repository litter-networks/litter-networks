#!/usr/bin/env bash
# Copyright Clean and Green Communities CIC / Litter Networks
# SPDX-License-Identifier: Apache-2.0


set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-ln}"

terraform apply

invalidate_distribution() {
    local distribution_id="$1"
    local label="$2"

    echo ""
    echo "${label}... ========================="
    if output=$(aws cloudfront create-invalidation --distribution-id "${distribution_id}" --paths "/*" 2>&1); then
        echo "${output}"
    else
        echo "CloudFront invalidation failed for distribution ${distribution_id}." >&2
        echo "${output}" >&2
        exit 1
    fi
}

invalidate_distribution "E38XGOGM7XNRC5" "CloudFront invalidation for Dynamic distro"
invalidate_distribution "EWXIG6ZADYHMA" "CloudFront invalidation for Static distro"
