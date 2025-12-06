// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { apiRequest } from '@/lib/httpClient';
import { getPrimaryDistrictId } from '@/shared/utils/districtIds';

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

/**
 * Retrieve local district information from the Join In API for a given district identifier.
 *
 * @param districtId - The input district identifier from which the primary district id will be derived
 * @param signal - Optional AbortSignal to cancel the HTTP request
 * @returns The `DistrictLocalInfo` for the primary district, or `null` if a primary district id cannot be determined or the request fails
 */
export async function fetchDistrictLocalInfo(districtId: string, signal?: AbortSignal): Promise<DistrictLocalInfo | null> {
  const primaryDistrictId = getPrimaryDistrictId(districtId);
  if (!primaryDistrictId) {
    return null;
  }
  try {
    return await apiRequest<DistrictLocalInfo>({
      path: `/join-in/districts/${encodeURIComponent(primaryDistrictId)}/local-info`,
      signal,
    });
  } catch (error) {
    console.error(`Failed to load district local info for ${primaryDistrictId}`, error);
    return null;
  }
}
