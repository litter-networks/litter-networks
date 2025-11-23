import { useEffect, useState } from 'react';
import { apiRequest, HttpError } from '@/lib/httpClient';

export interface Network {
  uniqueId: string;
  shortId?: string;
  fullName?: string;
  districtId?: string;
  districtFullName?: string;
  [key: string]: unknown;
}

export interface NearbyNetwork {
  uniqueId: string;
  fullName?: string;
  distance_miles?: number;
  roundedDistance?: string;
  elementClass?: string;
}

interface UseNetworksResult {
  networks: Network[];
  loading: boolean;
  error: unknown;
}

export function useNetworks(): UseNetworksResult {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const data = await apiRequest<Network[]>({ path: '/info/networks', signal: controller.signal });
        if (!cancelled) {
          setNetworks(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { networks, loading, error };
}

export async function fetchNearbyNetworks(networkId: string, signal?: AbortSignal): Promise<NearbyNetwork[]> {
  try {
    const data = await apiRequest<NearbyNetwork[]>({
      path: `/info/networks/${networkId}/nearby`,
      signal,
    });
    return data ?? [];
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return [];
    }
    throw error;
  }
}
