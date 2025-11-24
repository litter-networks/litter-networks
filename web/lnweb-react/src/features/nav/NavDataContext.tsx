import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNearbyNetworks, useNetworks, type Network } from '@/data-sources/networks';
import { NavDataContext, type NavData } from './NavDataContextBase';

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
function buildDisplayName(network: Network) {
  const baseName = network.fullName ?? network.uniqueId ?? '';
  if (!baseName) {
    return 'Litter Networks';
  }
  const fullWithSuffix = `${baseName} Litter Network`;
  return baseName.length < 18 ? fullWithSuffix : baseName;
}
