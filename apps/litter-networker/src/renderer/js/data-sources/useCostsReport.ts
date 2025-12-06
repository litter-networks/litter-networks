// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from "react";
import type { MonthlyCostsReport } from "@shared/costs";

type State = {
  loading: boolean;
  data: MonthlyCostsReport | null;
  error?: string;
};

export const useCostsReport = () => {
  const [state, setState] = useState<State>({ loading: true, data: null });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const report = await window.appApi.getMonthlyCosts?.();
      setState({ loading: false, data: report ?? null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ loading: false, data: null, error: message });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    refresh
  };
};
