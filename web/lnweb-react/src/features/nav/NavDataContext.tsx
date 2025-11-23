import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNearbyNetworks, useNetworks, type Network, type NearbyNetwork } from '@/data-sources/networks';

interface NavData {
  filterString: string;
  network?: Network;
  displayName: string;
  facebookLink: string;
  buildPath: (path?: string) => string;
  networks: Network[];
  loading: boolean;
  nearbyNetworks: NearbyNetwork[];
}

const NavDataContext = createContext<NavData | undefined>(undefined);

interface ProviderProps {
  filterStringParam?: string;
  children: ReactNode;
}

/**
 * Provides navigation-related data and utilities to descendant components via NavDataContext.
 *
 * Resolves the selected network from `filterStringParam`, redirects to `/all` for missing or invalid filters,
 * fetches nearby networks for the selected network, and exposes derived values (displayName, facebookLink),
 * a `buildPath` helper, and the current networks/loading state.
 *
 * @param filterStringParam - Optional network identifier (uniqueId or shortId) used to select the active network; when absent the provider will navigate to the "all" view.
 * @returns The React context provider element that supplies NavData to its children.
 */
export function NavDataProvider({ filterStringParam, children }: ProviderProps) {
  const { networks, loading } = useNetworks();
  const navigate = useNavigate();
  const [nearbyNetworks, setNearbyNetworks] = useState<NearbyNetwork[]>([]);

  useEffect(() => {
    if (!filterStringParam) {
      navigate('/all', { replace: true });
    }
  }, [filterStringParam, navigate]);

  const normalizedParam = (filterStringParam ?? 'all').toLowerCase();
  const selectedNetwork = useMemo(() => {
    if (!networks.length) {
      return undefined;
    }

    return networks.find((network) => {
      const uniqueMatch = network.uniqueId?.toLowerCase() === normalizedParam;
      const shortMatch = network.shortId?.toLowerCase() === normalizedParam;
      return uniqueMatch || shortMatch;
    });
  }, [networks, normalizedParam]);

  useEffect(() => {
    if (!loading && filterStringParam && normalizedParam !== 'all' && !selectedNetwork) {
      navigate('/all', { replace: true });
    }
  }, [loading, normalizedParam, filterStringParam, selectedNetwork, navigate]);

  const resolvedFilter = selectedNetwork
    ? filterStringParam ?? selectedNetwork.uniqueId
    : 'all';

  const displayName = selectedNetwork
    ? buildDisplayName(selectedNetwork)
    : 'Litter Networks';

  const facebookLink = selectedNetwork
    ? `https://www.facebook.com/groups/${selectedNetwork.uniqueId}`
    : 'https://www.facebook.com/litternetworks';

  const buildPath = (path?: string) => {
    const trimmed = path ? path.replace(/^\/+/g, '') : '';
    const base = `/${resolvedFilter}`.replace(/\/+$/g, '');
    if (!trimmed) {
      return base || '/';
    }
    return `${base}/${trimmed}`.replace(/\/+/g, '/');
  };

  useEffect(() => {
    const selectedId = selectedNetwork?.uniqueId;
    let cancelled = false;
    const controller = new AbortController();

    async function loadNearby() {
      if (!selectedId) {
        setNearbyNetworks([]);
        return;
      }
      try {
        const data = await fetchNearbyNetworks(selectedId, controller.signal);
        if (!cancelled) {
          setNearbyNetworks(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch nearby networks', error);
          setNearbyNetworks([]);
        }
      }
    }

    loadNearby();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedNetwork?.uniqueId]);

  const value: NavData = {
    filterString: resolvedFilter,
    network: selectedNetwork,
    displayName,
    facebookLink,
    buildPath,
    networks,
    loading,
    nearbyNetworks,
  };

  return <NavDataContext.Provider value={value}>{children}</NavDataContext.Provider>;
}

/**
 * Accesses the current navigation data from NavDataProvider.
 *
 * @returns The NavData context value containing navigation state and helpers.
 * @throws Error if called outside of a NavDataProvider.
 */
export function useNavData() {
  const context = useContext(NavDataContext);
  if (!context) {
    throw new Error('useNavData must be used within NavDataProvider');
  }
  return context;
}

/**
 * Computes a human-readable display name for a network used in navigation headers.
 *
 * @param network - The network object to derive the display name from.
 * @returns The resolved display name: `'Litter Networks'` if neither `fullName` nor `uniqueId` exist; otherwise the available name, with `' Litter Network'` appended when that base name is shorter than 18 characters.
 */
function buildDisplayName(network: Network) {
  const baseName = network.fullName ?? network.uniqueId ?? '';
  if (!baseName) {
    return 'Litter Networks';
  }
  const fullWithSuffix = `${baseName} Litter Network`;
  return baseName.length < 18 ? fullWithSuffix : baseName;
}