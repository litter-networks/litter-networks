import { createContext } from 'react';
import type { Network, NearbyNetwork } from '@/data-sources/networks';

export interface NavData {
  filterString: string;
  network?: Network;
  displayName: string;
  facebookLink: string;
  buildPath: (path?: string) => string;
  networks: Network[];
  loading: boolean;
  nearbyNetworks: NearbyNetwork[];
}

export const NavDataContext = createContext<NavData | undefined>(undefined);
