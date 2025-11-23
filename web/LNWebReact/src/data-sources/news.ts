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

export async function fetchNewsItems(prevUniqueId?: string, signal?: AbortSignal): Promise<NewsItem[]> {
  const path = prevUniqueId ? `/news/get-press-cuttings-json/${prevUniqueId}` : '/news/get-press-cuttings-json';
  return apiRequest<NewsItem[]>({
    path,
    signal,
  });
}

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
