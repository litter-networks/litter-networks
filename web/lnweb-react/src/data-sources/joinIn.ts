import { apiRequest } from '@/lib/httpClient';

export interface DistrictLocalInfo {
  uniqueId: string;
  disposeEmail?: string;
  disposeSmallInBins?: string;
  councilBagsDescription?: string;
  councilTakesKBTBags?: string;
  flyTipReportUrl?: string;
  localScrapMetalUrls?: Array<{ name: string; url: string }>;
  localRecyclingUrl?: string;
  [key: string]: unknown;
}

/**
 * Fetches local information for a district from the Join In API.
 *
 * @param districtId - The district identifier to include in the API path
 * @param signal - Optional AbortSignal to cancel the request
 * @returns The district's local information, or `null` if `districtId` is falsy or the request fails
 */
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