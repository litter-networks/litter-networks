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

export async function fetchAreaInfo(signal?: AbortSignal): Promise<AreaInfoEntry[]> {
  const data = await apiRequest<AreaInfoResponse>({
    path: '/maps/area-info',
    signal,
  });
  return data.areaInfo ?? [];
}
