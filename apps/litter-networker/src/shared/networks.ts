export type NetworkRow = Record<string, string>;

export type NetworksResponse = {
  headers: string[];
  rows: NetworkRow[];
};
