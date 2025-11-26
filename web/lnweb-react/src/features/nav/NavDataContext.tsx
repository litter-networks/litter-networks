import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNearbyNetworks, useNetworks, type Network, type NearbyNetwork } from '@/data-sources/networks';
import { NavDataContext, type NavData } from './NavDataContextBase';

type NetworkUsage = {
  visits: number;
  lastVisited: number;
};

const USAGE_STORAGE_KEY = 'ln.network-usage';
const FAVORITES_STORAGE_KEY = 'ln.network-favorites';
const MAX_TRACKED_NETWORKS = 200;

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
  const [usageByNetwork, setUsageByNetwork] = useState<Record<string, NetworkUsage>>({});
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

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
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(USAGE_STORAGE_KEY) ?? '{}');
      if (parsed && typeof parsed === 'object') {
        setUsageByNetwork(parsed);
      }
    } catch {
      setUsageByNetwork({});
    }

    try {
      const favRaw = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]');
      if (Array.isArray(favRaw)) {
        setFavoriteIds(new Set(favRaw.filter((id) => typeof id === 'string')));
      }
    } catch {
      setFavoriteIds(new Set());
    }
  }, []);

  useEffect(() => {
    if (!selectedNetwork?.uniqueId || typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const now = Date.now();
    setUsageByNetwork((prev) => {
      const next = {
        ...prev,
        [selectedNetwork.uniqueId]: {
          visits: (prev[selectedNetwork.uniqueId]?.visits ?? 0) + 1,
          lastVisited: now,
        },
      };
      const entries = Object.entries(next)
        .sort((a, b) => b[1].lastVisited - a[1].lastVisited)
        .slice(0, MAX_TRACKED_NETWORKS);
      const trimmed: Record<string, NetworkUsage> = {};
      entries.forEach(([id, value]) => {
        trimmed[id] = value;
      });
      window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(trimmed));
      return trimmed;
    });
  }, [selectedNetwork?.uniqueId]);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => favoriteIds.has(id), [favoriteIds]);

  const { recentNetworks, favoriteNetworks } = useMemo(
    () => deriveUsageLists(usageByNetwork, favoriteIds, networks),
    [usageByNetwork, favoriteIds, networks],
  );

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
    recentNetworks,
    favoriteNetworks,
    toggleFavorite,
    isFavorite,
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

function deriveUsageLists(
  usage: Record<string, NetworkUsage>,
  favoriteIds: Set<string>,
  networks: Network[],
) {
  if (!networks.length) {
    return { recentNetworks: [], favoriteNetworks: [] };
  }

  const byId = new Map(networks.map((network) => [network.uniqueId, network]));
  const entries = Object.entries(usage)
    .map(([id, stats]) => ({ id, ...stats }))
    .filter((item) => byId.has(item.id));

  const recentNetworks = entries
    .filter((entry) => !favoriteIds.has(entry.id))
    .sort((a, b) => b.lastVisited - a.lastVisited)
    .slice(0, 5)
    .map((item) => byId.get(item.id)!)
    .filter(Boolean);

  const favoriteNetworks = Array.from(favoriteIds)
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      const nameA = (a?.fullName ?? a?.uniqueId ?? '').toLowerCase();
      const nameB = (b?.fullName ?? b?.uniqueId ?? '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

  return { recentNetworks, favoriteNetworks };
}
