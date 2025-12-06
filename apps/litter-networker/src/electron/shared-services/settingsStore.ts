// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { promises as fs } from "fs";
import path from "node:path";
import type { TablePreferences } from "../../shared/tables";

type StoredWindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  displayId?: number;
};

type SettingsSchema = {
  splitRatio?: number;
  bagMode?: "mock" | "stage" | "prod";
  windowMaximized?: boolean;
  windowBounds?: StoredWindowBounds;
  lastTabId?: string;
  tablesPreferences?: TablePreferences;
  selectedNetworkId?: string;
  mockPreference?: boolean;
};

export class SettingsStore {
  private filePath: string;
  private data: SettingsSchema = {};

  constructor(private directory: string, filename = "settings.json") {
    this.filePath = path.join(directory, filename);
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      this.data = JSON.parse(raw) as SettingsSchema;
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        console.error("Failed to load settings", error);
      }
      this.data = {};
    }
  }

  private async save() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  getSplitRatio(defaultValue: number) {
    return this.data.splitRatio ?? defaultValue;
  }

  async setSplitRatio(value: number) {
    this.data.splitRatio = value;
    await this.save();
  }

  getBagMode(defaultValue: "mock" | "stage" | "prod") {
    return this.data.bagMode ?? defaultValue;
  }

  async setBagMode(mode: "mock" | "stage" | "prod") {
    this.data.bagMode = mode;
    await this.save();
  }

  isWindowMaximized(defaultValue = false) {
    return this.data.windowMaximized ?? defaultValue;
  }

  async setWindowMaximized(value: boolean) {
    this.data.windowMaximized = value;
    await this.save();
  }

  getLastTabId() {
    return this.data.lastTabId;
  }

  async setLastTabId(tabId: string) {
    this.data.lastTabId = tabId;
    await this.save();
  }

  getTablesPreferences(): TablePreferences | undefined {
    return this.data.tablesPreferences;
  }

  async setTablesPreferences(preferences: TablePreferences) {
    this.data.tablesPreferences = preferences;
    await this.save();
  }

  getSelectedNetworkId() {
    return this.data.selectedNetworkId;
  }

  async setSelectedNetworkId(value: string | undefined) {
    this.data.selectedNetworkId = value;
    await this.save();
  }

  getWindowBounds(): StoredWindowBounds | undefined {
    return this.data.windowBounds;
  }

  async setWindowBounds(bounds: StoredWindowBounds) {
    this.data.windowBounds = bounds;
    await this.save();
  }

  getMockPreference(defaultValue?: boolean): boolean | undefined {
    if (this.data.mockPreference === undefined) {
      return defaultValue;
    }
    return this.data.mockPreference;
  }

  async setMockPreference(value: boolean) {
    this.data.mockPreference = value;
    await this.save();
  }
}
