// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { apiRequest } from '@/lib/httpClient';

export interface AreaNetworkInfo {
  uniqueId: string;
  fullName: string;
  mapSource?: string | null;
  mapFile?: string | null;
}

export interface AreaInfoEntry {
  uniqueId: string;
  fullName: string;
  mapName: string;
  mapStyle: string;
  networks: AreaNetworkInfo[];
}

interface AreaInfoResponse {
  areaInfo: AreaInfoEntry[];
}

/**
 * Fetches area information used for maps.
 *
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns An array of `AreaInfoEntry` objects; an empty array if the response contains no `areaInfo`.
 */
export async function fetchAreaInfo(signal?: AbortSignal): Promise<AreaInfoEntry[]> {
  const data = await apiRequest<AreaInfoResponse>({
    path: '/maps/area-info',
    signal,
  });
  return data.areaInfo ?? [];
}
