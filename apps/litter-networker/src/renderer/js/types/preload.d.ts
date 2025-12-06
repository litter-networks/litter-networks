// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import type { AppSnapshot } from "@shared/app-state";
import type { MonthlyCostsReport } from "@shared/costs";
import type { NetworksResponse } from "@shared/networks";
import type { TablePreferences, TableScanRequest, TableScanResult } from "@shared/tables";

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
      applyMemberCount: (payload: { networkId: string; memberCount: number; dataSource?: string }) => Promise<{
        uniqueId: string;
        memberCount: number;
        sampleTime: number;
        dataSource: string;
        reviewAdjustments: unknown[];
      }>;
      getMemberCount: (
        networkId: string
      ) => Promise<{ memberCount: number; sampleTime: number; dataSource?: string; reviewAdjustments?: unknown[] } | null>;
      invalidateDistribution: (distributionId: string) => Promise<void>;
      getMonthlyCosts: () => Promise<MonthlyCostsReport | null>;
      getNetworks: () => Promise<NetworksResponse>;
      updateNetworkRow: (payload: { uniqueId: string; changes: Record<string, string> }) => Promise<void>;
      addNetworkRow: (payload: { uniqueId: string; newRow: Record<string, string> }) => Promise<void>;
      deleteNetworkRow: (uniqueId: string) => Promise<void>;
      listMapFiles: (mapSource: string) => Promise<string[]>;
      listTables: () => Promise<string[]>;
      scanTable: (payload: TableScanRequest) => Promise<TableScanResult>;
      putTableItem: (payload: { tableName: string; item: Record<string, unknown> }) => Promise<void>;
      deleteTableItem: (payload: { tableName: string; key: Record<string, unknown> }) => Promise<void>;
      getTablesPreferences: () => Promise<TablePreferences | null>;
      setTablesPreferences: (prefs: TablePreferences) => Promise<void>;
      getLastTabId: () => Promise<string | null>;
      setLastTabId: (tabId: string) => Promise<void>;
      getSelectedNetworkId: () => Promise<string | null>;
      setSelectedNetworkId: (networkId: string | null) => Promise<void>;
      getMockPreference: () => Promise<boolean | null>;
      setMockPreference: (value: boolean) => Promise<void>;
      runContentJob: (payload: { job?: "legacy" | "docs"; networkId?: string; force?: boolean; dryRun?: boolean }) => Promise<{ ok: true }>;
      stopContentJob: () => Promise<{ stopped: boolean }>;
      subscribeContentProgress: () => void;
      onContentProgress: (callback: (payload: { type: string; message?: string; detail?: any }) => void) => () => void;
    };
  }
}

export {};
