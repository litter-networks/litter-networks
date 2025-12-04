// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

export {};

declare global {
  interface Window {
    createMap?: (
      mode: string,
      mapsSourceDomain: string,
      routesGeoJSONUrl: string,
      areaInfo: unknown,
      showNetworks: boolean,
      currentSelection: { districtId?: string; networkId?: string },
      modeIn?: string,
    ) => void;
    updateMapSelection?: (selection: { districtId?: string; networkId?: string }) => void;
    fetchGeoJSON?: (url: string) => Promise<unknown>;
  }
}
