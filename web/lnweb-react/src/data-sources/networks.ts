// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

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

/**
 * Provides a reactive list of networks along with loading and error state.
 *
 * Fetches the networks resource when mounted and exposes `networks`, `loading`,
 * and `error`. Avoids updating state after unmount (cancels in-flight requests).
 *
 * @returns An object with `networks` — the fetched array of Network, `loading` — `true` while the fetch is in progress, and `error` — any error encountered or `null`
 */
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

/**
 * Fetches nearby networks for a given network identifier.
 *
 * @param networkId - The unique identifier of the network to query
 * @param signal - Optional AbortSignal to cancel the request
 * @returns An array of nearby networks; returns an empty array if none are found or if the server responds with 404
 */
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
