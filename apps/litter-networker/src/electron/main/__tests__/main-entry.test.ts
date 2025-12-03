import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => {
  const webContents = {
    on: vi.fn(),
    send: vi.fn(),
    canGoBack: vi.fn(),
    canGoForward: vi.fn(),
    reload: vi.fn(),
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    isDevToolsOpened: vi.fn(),
    openDevTools: vi.fn()
  };

  class BrowserWindow {
    public webContents = webContents;
    constructor() {}
    once = vi.fn();
    on = vi.fn();
    show = vi.fn();
    loadURL = vi.fn();
    loadFile = vi.fn();
    close = vi.fn();
    static getAllWindows = vi.fn(() => []);
    static fromWebContents = vi.fn(() => null);
  }

  const app = {
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    getPath: vi.fn(() => "/tmp")
  };

  const Menu = {
    buildFromTemplate: vi.fn(() => ({ popup: vi.fn() }))
  };

  const ipcMain = {
    handle: vi.fn(),
    on: vi.fn()
  };

  return { app, BrowserWindow, Menu, ipcMain, WebContents: vi.fn() };
});

vi.mock("../shared-services/appData", () => ({ getAppSnapshot: vi.fn() }));
vi.mock("../shared-services/settingsStore", () => ({
  SettingsStore: class {
    constructor(_path: string) {}
    load = vi.fn(() => Promise.resolve());
    getSplitRatio = vi.fn(() => 0.5);
    setSplitRatio = vi.fn(() => Promise.resolve());
  }
}));
vi.mock("../shared-services/mockServer", () => ({
  startMockServer: vi.fn(() => ({ close: vi.fn(), urlBase: "http://mock" }))
}));
vi.mock("../shared-services/bagCounts", () => ({
  BagCountService: class {
    apply = vi.fn();
    getStats = vi.fn();
    invalidateDistribution = vi.fn();
  }
}));
vi.mock("../shared-services/costs", () => ({
  CostService: class {
    getMonthlyCosts = vi.fn();
  }
}));
vi.mock("../shared-services/content", () => ({
  ContentService: class {
    runJob = vi.fn();
    stop = vi.fn();
    subscribe = vi.fn();
  }
}));
vi.mock("../shared-services/networks", () => ({
  NetworksService: class {
    getNetworks = vi.fn();
    updateRow = vi.fn();
    addRow = vi.fn();
    deleteRow = vi.fn();
  }
}));
vi.mock("../shared-services/memberCounts", () => ({
  MemberCountService: class {
    apply = vi.fn();
    getLatestCount = vi.fn();
  }
}));

describe("main entrypoint", () => {
  it("loads without throwing (catches duplicate declarations)", async () => {
    await expect(import("../main")).resolves.toBeDefined();
  });
});
