// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from "react";
import type { AppSnapshot } from "@shared/app-state";

export const useAppSnapshot = () => {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await window.appApi.getAppSnapshot();
      setSnapshot(data);
    } catch (err: any) {
      console.error("Failed to load snapshot", err);
      const rawMessage = err?.message ?? "Unable to load workspace data.";
      const lower = rawMessage.toLowerCase();
      let friendly = rawMessage;
      if (lower.includes("dynamodb") || lower.includes("resourcenotfound") || lower.includes("aws")) {
        friendly = `${rawMessage}

What to check:
• AWS_PROFILE (currently set for the CLI) should have access to LN-* tables.
• AWS_REGION should match the region those tables live in (e.g. eu-west-2).
• Try: aws dynamodb describe-table --profile ln --region eu-west-2 --table-name LN-NetworksInfo`;
      }
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  return { snapshot, loading, error, refresh: fetchSnapshot };
};
