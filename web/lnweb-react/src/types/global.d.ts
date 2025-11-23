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
  }
}
