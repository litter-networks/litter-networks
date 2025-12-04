// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { promises as fs } from "fs";
import path from "node:path";

type SettingsSchema = {
  splitRatio?: number;
  bagMode?: "mock" | "stage" | "prod";
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
}
