// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { app, BrowserWindow, Menu, ipcMain, type BrowserWindowConstructorOptions, type MenuItemConstructorOptions, WebContents } from "electron";
import path from "node:path";
import { getAppSnapshot } from "../shared-services/appData";
import { SettingsStore } from "../shared-services/settingsStore";
import { startMockServer } from "../shared-services/mockServer";
import { BagCountService } from "../shared-services/bagCounts";
import { CostService } from "../shared-services/costs";
import { ContentJobParams, ContentService } from "../shared-services/content";
import { NetworksService } from "../shared-services/networks";
import { TablesService } from "../shared-services/tables";
import { MemberCountService, type ApplyMemberCountPayload } from "../shared-services/memberCounts";
import type { TablePreferences } from "../../shared/tables";

const DEFAULT_SPLIT_RATIO = 0.75;
const ENABLE_BROWSER_CONTEXT_MENU = process.env.NODE_ENV !== "production";
const ICON_FILE_NAME = "logo.png";

let settingsStore: SettingsStore | null = null;
let mockServer: { close: () => Promise<void>; urlBase: string } | null = null;
let mockEnabled = false;
let bagCountService: BagCountService | null = null;
let costService: CostService | null = null;
let networksService: NetworksService | null = null;
let contentService: ContentService | null = null;
let memberCountService: MemberCountService | null = null;
let tablesService: TablesService | null = null;

const resolveWindowIcon = () => {
  const baseDir = app.isPackaged ? path.join(process.resourcesPath, "images") : path.join(app.getAppPath(), "images");
  return path.join(baseDir, ICON_FILE_NAME);
};

const ensureMockServer = async () => {
  if (mockServer) return mockServer.urlBase;
  mockServer = startMockServer();
  console.log(`[mock] Facebook mock server running at ${mockServer.urlBase}`);
  return mockServer.urlBase;
};

const setMockEnabled = async (enabled: boolean) => {
  if (enabled) {
    const url = await ensureMockServer();
    process.env.MOCK_FACEBOOK_BASE_URL = url;
    mockEnabled = true;
    return { enabled: true, url };
  }

  mockEnabled = false;
  delete process.env.MOCK_FACEBOOK_BASE_URL;
  if (mockServer) {
    await mockServer.close().catch((err) => console.error("Failed to close mock server", err));
    mockServer = null;
  }
  return { enabled: false, url: null };
};

const buildContextMenuTemplate = (contents: WebContents, params: Electron.ContextMenuParams) => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "Back",
      enabled: contents.canGoBack(),
      click: () => contents.goBack()
    },
    {
      label: "Forward",
      enabled: contents.canGoForward(),
      click: () => contents.goForward()
    },
    { label: "Reload", click: () => contents.reload() },
    { type: "separator" }
  ];

  if (params.misspelledWord && params.dictionarySuggestions.length > 0) {
    template.push(
      ...params.dictionarySuggestions.map((suggestion) => ({
        label: suggestion,
        click: () => contents.replaceMisspelling(suggestion)
      }))
    );
    template.push({ type: "separator" });
  }

  if (params.selectionText) {
    template.push({
      label: "Copy",
      enabled: params.editFlags.canCopy,
      click: () => contents.copy()
    });
  }

  if (params.isEditable) {
    template.push(
      {
        label: "Cut",
        enabled: params.editFlags.canCut,
        click: () => contents.cut()
      },
      {
        label: "Paste",
        enabled: params.editFlags.canPaste,
        click: () => contents.paste()
      }
    );
  }

  template.push(
    { type: "separator" },
    {
      label: "Inspect",
      click: () => {
        contents.inspectElement(params.x, params.y);
        if (!contents.isDevToolsOpened()) {
          contents.openDevTools();
        }
      }
    }
  );

  return template;
};

const attachBrowserContextMenu = (contents: WebContents) => {
  contents.on("context-menu", (event, params) => {
    const template = buildContextMenuTemplate(contents, params);
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: BrowserWindow.fromWebContents(contents) ?? undefined });
  });
};

const registerNavigationHotkeys = (contents: WebContents, targetWindow: BrowserWindow, createNewWindow: () => void) => {
  contents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") {
      return;
    }

    const sendNavigation = (payload: { direction: "next" | "prev"; ctrl: boolean }) => {
      event.preventDefault();
      targetWindow.webContents.send("hotkey:navigate", payload);
    };

    if (input.key === "ArrowRight" && arrowLockEnabled) {
      sendNavigation({ direction: "next", ctrl: !!input.control });
    } else if (input.key === "ArrowLeft" && arrowLockEnabled) {
      sendNavigation({ direction: "prev", ctrl: !!input.control });
    } else if (input.control && !input.shift && !input.alt && input.key.toLowerCase() === "n") {
      event.preventDefault();
      createNewWindow();
    } else if (input.control && !input.shift && !input.alt && input.key.toLowerCase() === "w") {
      event.preventDefault();
      targetWindow.close();
    }
  });
};

const createWindow = async () => {
  const startMaximized = settingsStore?.isWindowMaximized(false) ?? false;
  const windowOptions: BrowserWindowConstructorOptions = {
    width: 1600,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: "#1a1a1a",
    show: false,
    autoHideMenuBar: true,
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  };

  const mainWindow = new BrowserWindow(windowOptions);
  if (startMaximized) {
    mainWindow.maximize();
    mainWindow.webContents.invalidate();
  }

  const persistMaximized = (value: boolean) => {
    settingsStore
      ?.setWindowMaximized(value)
      .catch((err) => console.error("Failed to persist window maximized state", err));
  };

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    if (startMaximized && !mainWindow.isMaximized()) {
      mainWindow.maximize();
      mainWindow.webContents.invalidate();
    }
  });

  mainWindow.once("show", () => {
    if (startMaximized && !mainWindow.isMaximized()) {
      mainWindow.maximize();
      mainWindow.webContents.invalidate();
    }
  });

  mainWindow.on("maximize", () => persistMaximized(true));
  mainWindow.on("unmaximize", () => persistMaximized(false));
  mainWindow.on("close", () => persistMaximized(mainWindow.isMaximized()));

  registerNavigationHotkeys(mainWindow.webContents, mainWindow, createWindow);

  mainWindow.webContents.on("did-attach-webview", (_event, contents) => {
    if (ENABLE_BROWSER_CONTEXT_MENU) {
      attachBrowserContextMenu(contents);
    }
    registerNavigationHotkeys(contents, mainWindow, createWindow);
  });

  if (ENABLE_BROWSER_CONTEXT_MENU) {
    attachBrowserContextMenu(mainWindow.webContents);
  }

  const devServerURL = process.env.VITE_DEV_SERVER_URL;

  if (devServerURL) {
    await mainWindow.loadURL(devServerURL);
  } else {
    const indexHtml = path.join(__dirname, "../../dist-renderer/index.html");
    await mainWindow.loadFile(indexHtml);
  }
};

let arrowLockEnabled = true;

if (process.platform === "win32") {
  app.setAppUserModelId("org.litternetworks.litter-networker");
}

app.whenReady().then(async () => {
  settingsStore = new SettingsStore(app.getPath("userData"));
  await settingsStore.load().catch((error) => console.error("Unable to load settings", error));

  // Enable mock by default if explicitly requested via env, otherwise fall back to stored preference.
  const envMock = process.env.MOCK_FACEBOOK === "1" || process.env.MOCK_FACEBOOK?.toLowerCase() === "true";
  const envBase = process.env.MOCK_FACEBOOK_BASE_URL;
  const storedMockPreference = settingsStore.getMockPreference();
  if (envMock || envBase) {
    await setMockEnabled(true);
    if (envBase) {
      process.env.MOCK_FACEBOOK_BASE_URL = envBase;
      mockEnabled = true;
    }
  } else if (storedMockPreference) {
    await setMockEnabled(true);
  }
  bagCountService = new BagCountService();
  costService = new CostService();
  networksService = new NetworksService();
  tablesService = new TablesService();
  contentService = new ContentService();
  memberCountService = new MemberCountService();

  ipcMain.handle("appData:getSnapshot", () => getAppSnapshot());
  ipcMain.handle("appData:getSplitRatio", () => settingsStore?.getSplitRatio(DEFAULT_SPLIT_RATIO) ?? DEFAULT_SPLIT_RATIO);
  ipcMain.handle("appData:setSplitRatio", (_event, ratio: number) =>
    settingsStore?.setSplitRatio(ratio).catch((error) => console.error("Failed to persist split ratio", error))
  );
  ipcMain.handle("window:new", () => createWindow());
  ipcMain.handle("window:close", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });
  ipcMain.handle("nav:setLock", (_event, enabled: boolean) => {
    arrowLockEnabled = enabled;
  });
  ipcMain.handle("mock:getStatus", () => ({
    enabled: mockEnabled,
    url: process.env.MOCK_FACEBOOK_BASE_URL ?? null
  }));
  ipcMain.handle("mock:setEnabled", (_event, enabled: boolean) => setMockEnabled(enabled));
  ipcMain.handle("bag:apply", async (_event, payload) => {
    if (!bagCountService) throw new Error("BagCountService unavailable");
    return bagCountService.apply(payload);
  });
  ipcMain.handle("bag:getStats", async (_event, networkId: string) => {
    if (!bagCountService) throw new Error("BagCountService unavailable");
    return bagCountService.getStats(networkId);
  });
  ipcMain.handle("bag:invalidateDistribution", async (_event, distributionId: string) => {
    if (!bagCountService) throw new Error("BagCountService unavailable");
    return bagCountService.invalidateDistribution(distributionId);
  });
  ipcMain.handle("member:getCurrent", async (_event, networkId: string) => {
    if (!memberCountService) throw new Error("MemberCountService unavailable");
    return memberCountService.getLatestCount(networkId);
  });
  ipcMain.handle("member:apply", async (_event, payload: ApplyMemberCountPayload) => {
    if (!memberCountService) throw new Error("MemberCountService unavailable");
    return memberCountService.apply(payload);
  });
  ipcMain.handle("costs:getMonthly", async () => {
    if (!costService) throw new Error("CostService unavailable");
    return costService.getMonthlyCosts();
  });
  ipcMain.handle("networks:get", async () => {
    if (!networksService) throw new Error("NetworksService unavailable");
    return networksService.getNetworks();
  });
  ipcMain.handle("networks:update", async (_event, payload) => {
    if (!networksService) throw new Error("NetworksService unavailable");
    return networksService.updateRow(payload.uniqueId, payload.changes);
  });
  ipcMain.handle("networks:add", async (_event, payload) => {
    if (!networksService) throw new Error("NetworksService unavailable");
    return networksService.addRow(payload.uniqueId, payload.newRow);
  });
  ipcMain.handle("networks:delete", async (_event, uniqueId: string) => {
    if (!networksService) throw new Error("NetworksService unavailable");
    return networksService.deleteRow(uniqueId);
  });
  ipcMain.handle("maps:listFiles", async (_event, mapSource: string) => {
    if (!networksService) throw new Error("NetworksService unavailable");
    return networksService.listMapFiles(mapSource);
  });
  ipcMain.handle("tables:list", async () => {
    if (!tablesService) throw new Error("TablesService unavailable");
    return tablesService.listTables();
  });
  ipcMain.handle("tables:scan", async (_event, payload) => {
    if (!tablesService) throw new Error("TablesService unavailable");
    return tablesService.scan(payload);
  });
  ipcMain.handle("tables:put", async (_event, payload) => {
    if (!tablesService) throw new Error("TablesService unavailable");
    return tablesService.putItem(payload.tableName, payload.item);
  });
  ipcMain.handle("tables:delete", async (_event, payload) => {
    if (!tablesService) throw new Error("TablesService unavailable");
    return tablesService.deleteItem(payload.tableName, payload.key);
  });
  ipcMain.handle("settings:getTablesPrefs", () => settingsStore?.getTablesPreferences() ?? null);
  ipcMain.handle("settings:setTablesPrefs", async (_event, prefs: TablePreferences) => {
    if (!settingsStore) throw new Error("SettingsStore unavailable");
    return settingsStore.setTablesPreferences(prefs ?? {});
  });
  ipcMain.handle("settings:getLastTab", () => settingsStore?.getLastTabId() ?? null);
  ipcMain.handle("settings:setLastTab", async (_event, tabId: string) => {
    if (!settingsStore) throw new Error("SettingsStore unavailable");
    return settingsStore.setLastTabId(tabId);
  });
  ipcMain.handle("settings:getSelectedNetwork", () => settingsStore?.getSelectedNetworkId() ?? null);
  ipcMain.handle("settings:setSelectedNetwork", async (_event, networkId: string | null) => {
    if (!settingsStore) throw new Error("SettingsStore unavailable");
    return settingsStore.setSelectedNetworkId(networkId ?? undefined);
  });
  ipcMain.handle("settings:getMockPreference", () => settingsStore?.getMockPreference(undefined) ?? null);
  ipcMain.handle("settings:setMockPreference", async (_event, value: boolean) => {
    if (!settingsStore) throw new Error("SettingsStore unavailable");
    return settingsStore.setMockPreference(!!value);
  });
  ipcMain.handle("content:run", async (_event, payload: ContentJobParams) => {
    if (!contentService) throw new Error("ContentService unavailable");
    await contentService.run(payload);
    return { ok: true };
  });
  ipcMain.handle("content:stop", async () => {
    if (!contentService) return { stopped: false };
    return { stopped: contentService.stop() };
  });
  ipcMain.on("content:subscribe", (_event) => {
    if (!contentService) return;
    contentService.subscribe(_event.sender);
  });
  // jobs, review, settings handlers removed

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (mockServer) {
      mockServer.close().catch((err) => console.error("Failed to close mock server", err));
    }
    app.quit();
  }
});
