import { contextBridge, ipcRenderer } from "electron";
import type { AppSnapshot } from "../../shared/app-state";
import type { MonthlyCostsReport } from "../../shared/costs";
import type { NetworksResponse } from "../../shared/networks";

const api = {
  platform: process.platform,
  getAppSnapshot: () => ipcRenderer.invoke("appData:getSnapshot") as Promise<AppSnapshot>,
  getSplitRatio: () => ipcRenderer.invoke("appData:getSplitRatio") as Promise<number>,
  setSplitRatio: (ratio: number) => ipcRenderer.invoke("appData:setSplitRatio", ratio) as Promise<void>,
  openWindow: () => ipcRenderer.invoke("window:new") as Promise<void>,
  closeWindow: () => ipcRenderer.invoke("window:close") as Promise<void>,
  onNavigateHotkey: (callback: (payload: { direction: "next" | "prev"; ctrl: boolean }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { direction: "next" | "prev"; ctrl: boolean }) => {
      callback(payload);
    };
    ipcRenderer.on("hotkey:navigate", handler);
    return () => ipcRenderer.removeListener("hotkey:navigate", handler);
  },
  setArrowLock: (enabled: boolean) => ipcRenderer.invoke("nav:setLock", enabled),
  getMockStatus: () => ipcRenderer.invoke("mock:getStatus") as Promise<{ enabled: boolean; url: string | null }>,
  setMockEnabled: (enabled: boolean) =>
    ipcRenderer.invoke("mock:setEnabled", enabled) as Promise<{ enabled: boolean; url: string | null }>,
  applyBagCount: (payload: { networkId: string; bagCount: number; districtIds: string[] }) =>
    ipcRenderer.invoke("bag:apply", payload) as Promise<{ mode: string }>,
  getBagStats: (networkId: string) =>
    ipcRenderer.invoke("bag:getStats", networkId) as Promise<{
      all: { session: number; lastUpdated?: string };
      network: { session: number; lastUpdated?: string };
    }>,
  getMonthlyCosts: () => ipcRenderer.invoke("costs:getMonthly") as Promise<MonthlyCostsReport | null>,
  getNetworks: () => ipcRenderer.invoke("networks:get") as Promise<NetworksResponse>,
  updateNetworkRow: (payload: { uniqueId: string; changes: Record<string, string> }) =>
    ipcRenderer.invoke("networks:update", payload) as Promise<void>,
  addNetworkRow: (payload: { uniqueId: string; newRow: Record<string, string> }) =>
    ipcRenderer.invoke("networks:add", payload) as Promise<void>,
  deleteNetworkRow: (uniqueId: string) => ipcRenderer.invoke("networks:delete", uniqueId) as Promise<void>,
  runContentJob: (payload: { networkId?: string; force?: boolean }) =>
    ipcRenderer.invoke("content:run", payload) as Promise<{ ok: true }>,
  stopContentJob: () => ipcRenderer.invoke("content:stop"),
  subscribeContentProgress: () => ipcRenderer.send("content:subscribe"),
  onContentProgress: (callback: (payload: { type: string; message?: string; detail?: any }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { type: string; message?: string; detail?: any }) => {
      callback(payload);
    };
    ipcRenderer.on("content:progress", handler);
    return () => ipcRenderer.removeListener("content:progress", handler);
  }
};

contextBridge.exposeInMainWorld("appApi", api);
