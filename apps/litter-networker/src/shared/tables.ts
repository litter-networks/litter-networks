// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

export type TableKey = Record<string, unknown>;

export type TableItem = {
  values: Record<string, string>;
  raw: Record<string, unknown>;
  key: TableKey;
};

export type TableScanRequest = {
  tableName: string;
  limit?: number;
  nextToken?: string | null;
};

export type TableScanResult = {
  tableName: string;
  headers: string[];
  primaryKeyAttributes: string[];
  items: TableItem[];
  count: number;
  scannedCount: number;
  nextToken?: string | null;
};

export type TableSortConfig = {
  column: string | null;
  direction: "asc" | "desc";
};

export type TablePreferences = {
  table?: string;
  filter?: string;
  sort?: TableSortConfig | null;
};
