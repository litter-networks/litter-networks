// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

export type NetworkInfo = {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
  region: string;
  displayLabel: string;
  facebookGroupUrl: string;
};

export type BagSummary = {
  networkId: string;
  totals: {
    all: number;
    session: number;
    lastUpdated?: string;
  };
};

export type PaneDescriptor = {
  id: string;
  title: string;
  url: string;
};

export type PaneLayout = {
  left: PaneDescriptor;
  right: PaneDescriptor;
};

export type AppSnapshot = {
  networks: NetworkInfo[];
  bagSummaries: BagSummary[];
  defaultNetworkId: string;
  paneLayout: PaneLayout;
  tabs: Array<{
    id: string;
    label: string;
  }>;
  metadata: {
    profile: string;
    region: string;
    error?: string;
  };
};
