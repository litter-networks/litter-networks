// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { apiRequest } from '@/lib/httpClient';

export interface NewsItem {
  uniqueId: string;
  siteName: string;
  articleDate: string;
  imageUrl: string;
  title: string;
  description: string;
  sourceUrl: string;
}

/**
 * Fetches news items from the server, optionally starting after the specified item.
 *
 * @param prevUniqueId - If provided, requests items after this `uniqueId` to support pagination.
 * @returns An array of NewsItem objects retrieved from the API.
 */
export async function fetchNewsItems(prevUniqueId?: string, signal?: AbortSignal): Promise<NewsItem[]> {
  const path = prevUniqueId ? `/news/get-press-cuttings-json/${prevUniqueId}` : '/news/get-press-cuttings-json';
  return apiRequest<NewsItem[]>({
    path,
    signal,
  });
}

/**
 * Format a date string as "day<suffix> Month year" (e.g., "5th January 2024").
 *
 * @param dateString - A date string parseable by the JavaScript Date constructor.
 * @returns The formatted date in the form `day<suffix> Month year`, or the original `dateString` if it cannot be parsed.
 */
export function formatNewsDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  const day = date.getDate();
  const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
  const year = date.getFullYear();

  const suffix = (() => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  })();

  return `${day}${suffix} ${month} ${year}`;
}
