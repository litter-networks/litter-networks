// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import os from "node:os";
import path from "node:path";
import { SettingsStore } from "../settingsStore";

const SETTINGS_FILENAME = "settings.json";

describe("SettingsStore persistence", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ln-settings-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createStore = async () => {
    const store = new SettingsStore(tempDir, SETTINGS_FILENAME);
    await store.load();
    return store;
  };

  it("remembers maximized window state, last tab and table preferences between sessions", async () => {
    const store = await createStore();
    expect(store.isWindowMaximized(false)).toBe(false);
    expect(store.getLastTabId()).toBeUndefined();
    expect(store.getTablesPreferences()).toBeUndefined();

    await store.setWindowMaximized(true);
    await store.setLastTabId("tables");
    await store.setTablesPreferences({
      table: "LN-NetworksInfo",
      filter: "spring clean",
      sort: { column: "fullName", direction: "desc" }
    });

    expect(store.isWindowMaximized(false)).toBe(true);
    expect(store.getLastTabId()).toBe("tables");
    expect(store.getTablesPreferences()).toEqual({
      table: "LN-NetworksInfo",
      filter: "spring clean",
      sort: { column: "fullName", direction: "desc" }
    });

    const reloaded = await createStore();
    expect(reloaded.isWindowMaximized(false)).toBe(true);
    expect(reloaded.getLastTabId()).toBe("tables");
    expect(reloaded.getTablesPreferences()).toEqual({
      table: "LN-NetworksInfo",
      filter: "spring clean",
      sort: { column: "fullName", direction: "desc" }
    });
  });

  it("persists selected network and mock preference alongside window bounds", async () => {
    const store = await createStore();
    await store.setSelectedNetworkId("net-123");
    await store.setMockPreference(true);
    await store.setWindowBounds({ x: 10, y: 20, width: 800, height: 600, displayId: 7 });

    const reloaded = await createStore();
    expect(reloaded.getSelectedNetworkId()).toBe("net-123");
    expect(reloaded.getMockPreference()).toBe(true);
    expect(reloaded.getWindowBounds()).toEqual({ x: 10, y: 20, width: 800, height: 600, displayId: 7 });
  });
});
