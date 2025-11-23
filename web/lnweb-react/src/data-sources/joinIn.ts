import { apiRequest } from '@/lib/httpClient';

export interface DistrictLocalInfo {
  uniqueId: string;
  disposeEmail?: string;
  disposeSmallInBins?: string;
  councilBagsDescription?: string;
  councilTakesKBTBags?: string;
  flyTipReportUrl?: string;
  localScrapMetalUrls?: Array<{ name: string; url: string }> | string | null;
  localRecyclingUrl?: string;
  [key: string]: unknown;
}

export async function fetchDistrictLocalInfo(districtId: string, signal?: AbortSignal): Promise<DistrictLocalInfo | null> {
  if (!districtId) {
    return null;
  }
  try {
    return await apiRequest<DistrictLocalInfo>({
      path: `/join-in/districts/${encodeURIComponent(districtId)}/local-info`,
      signal,
    });
  } catch (error) {
    console.error(`Failed to load district local info for ${districtId}`, error);
    return null;
  }
}
