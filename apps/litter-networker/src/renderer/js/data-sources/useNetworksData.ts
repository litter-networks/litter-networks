import { useCallback, useEffect, useState } from "react";
import type { NetworksResponse } from "@shared/networks";

type State = {
  loading: boolean;
  data: NetworksResponse | null;
  error?: string;
};

export const useNetworksData = () => {
  const [state, setState] = useState<State>({ loading: true, data: null });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const payload = await window.appApi.getNetworks?.();
      setState({ loading: false, data: payload ?? null });
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
