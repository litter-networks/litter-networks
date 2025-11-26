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
  recentNetworks: Network[];
  favoriteNetworks: Network[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export const NavDataContext = createContext<NavData | undefined>(undefined);
