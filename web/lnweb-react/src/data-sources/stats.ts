import { apiRequest } from '@/lib/httpClient';

export interface BagCounts {
  thisMonthName: string;
  thisMonth: number | string;
  lastMonthName: string;
  lastMonth: number | string;
  thisYearName: string;
  thisYear: number | string;
  lastYearName: string;
  lastYear: number | string;
  allTime: number | string;
  gbsc?: number | string;
  statsCreatedTime?: string;
  mostRecentPost?: string;
}

export interface BagsInfo {
  networkName?: string;
  districtName?: string;
  isDistrict?: boolean;
  isAll?: boolean;
  bagCounts: BagCounts;
}

export interface StatsSummary {
  memberCountNetwork: number | null;
  numNetworksInDistrict: number;
  memberCountDistrict: number;
  districtName?: string;
  numNetworksInAll: number;
  memberCountAll: number;
}

/**
 * Fetches bag statistics and related metadata for a given network or district identifier.
 *
 * @param uniqueId - Unique identifier of the network or district to retrieve bag information for
 * @param signal - Optional AbortSignal to cancel the request
 * @returns The bag counts and optional network/district metadata as a `BagsInfo` object
 */
export async function fetchBagsInfo(uniqueId: string, signal?: AbortSignal): Promise<BagsInfo> {
  const data = await apiRequest<BagsInfo>({
    path: `/stats/get-bags-info/${uniqueId}`,
    signal,
  });
  return data;
}

/**
 * Fetches the aggregated statistics summary for a specific entity or for all entities.
 *
 * @param uniqueId - Optional unique identifier of a network or district. If omitted or set to `'all'`, the overall summary is returned.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns StatsSummary containing member and network counts across network, district, and overall scopes.
 */
export async function fetchStatsSummary(uniqueId?: string, signal?: AbortSignal): Promise<StatsSummary> {
  const path = uniqueId && uniqueId !== 'all' ? `/stats/summary/${uniqueId}` : '/stats/summary';
  return apiRequest<StatsSummary>({ path, signal });
}