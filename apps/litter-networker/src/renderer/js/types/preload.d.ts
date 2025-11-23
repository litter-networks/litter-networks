import type { AppSnapshot } from "@shared/app-state";
import type { MonthlyCostsReport } from "@shared/costs";
import type { NetworksResponse } from "@shared/networks";

declare global {
  interface Window {
    appApi: {
      platform: NodeJS.Platform;
      getAppSnapshot: () => Promise<AppSnapshot>;
      getSplitRatio: () => Promise<number>;
      setSplitRatio: (ratio: number) => Promise<void>;
      openWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      onNavigateHotkey: (
        callback: (payload: { direction: "next" | "prev"; ctrl: boolean }) => void
      ) => () => void;
      setArrowLock: (enabled: boolean) => Promise<void>;
      getMockStatus: () => Promise<{ enabled: boolean; url: string | null }>;
      setMockEnabled: (enabled: boolean) => Promise<{ enabled: boolean; url: string | null }>;
      applyBagCount: (payload: { networkId: string; bagCount: number; districtIds: string[] }) => Promise<{ mode: string }>;
      getBagStats: (
        networkId: string
      ) => Promise<{ all: { session: number; lastUpdated?: string }; network: { session: number; lastUpdated?: string } }>;
      getMonthlyCosts: () => Promise<MonthlyCostsReport | null>;
      getNetworks: () => Promise<NetworksResponse>;
      updateNetworkRow: (payload: { uniqueId: string; changes: Record<string, string> }) => Promise<void>;
      addNetworkRow: (payload: { uniqueId: string; newRow: Record<string, string> }) => Promise<void>;
      deleteNetworkRow: (uniqueId: string) => Promise<void>;
      runContentJob: (payload: { networkId?: string; force?: boolean }) => Promise<{ ok: true }>;
      stopContentJob: () => Promise<{ stopped: boolean }>;
      subscribeContentProgress: () => void;
      onContentProgress: (callback: (payload: { type: string; message?: string; detail?: any }) => void) => () => void;
    };
  }
}

export {};
