// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

export type NetworkRow = Record<string, string>;

export type NetworksResponse = {
  headers: string[];
  rows: NetworkRow[];
};
