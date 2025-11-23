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

export async function fetchBagsInfo(uniqueId: string, signal?: AbortSignal): Promise<BagsInfo> {
  const data = await apiRequest<BagsInfo>({
    path: `/stats/get-bags-info/${uniqueId}`,
    signal,
  });
  return data;
}

export async function fetchStatsSummary(uniqueId?: string, signal?: AbortSignal): Promise<StatsSummary> {
  const path = uniqueId && uniqueId !== 'all' ? `/stats/summary/${uniqueId}` : '/stats/summary';
  return apiRequest<StatsSummary>({ path, signal });
}
