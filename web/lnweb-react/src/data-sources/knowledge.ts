import { apiRequest } from '@/lib/httpClient';

export interface KnowledgeChildPage {
  pageTitle: string;
  pageDescription: string;
  pageUrl: string;
  childPages?: KnowledgeChildPage[];
}

export interface KnowledgeChildPagesResponse {
  childPages: KnowledgeChildPage[];
}

export interface KnowledgePageResponse {
  bodyContent: string;
  metadata: {
    title: string;
    description: string;
  };
}

/**
 * Fetches child knowledge pages for the given knowledge path.
 *
 * @param path - The knowledge page path to query (used as the `path` query parameter)
 * @returns An array of child knowledge page objects; an empty array if none are returned
 */
export async function fetchKnowledgeChildPages(path: string, signal?: AbortSignal): Promise<KnowledgeChildPage[]> {
  const search = new URLSearchParams({ path }).toString();
  const data = await apiRequest<KnowledgeChildPagesResponse>({
    path: `/knowledge/child-pages?${search}`,
    signal,
  });
  return data.childPages ?? [];
}

/**
 * Fetches a knowledge page by path from the knowledge API.
 *
 * @param path - The knowledge page path or slug to request
 * @param signal - Optional AbortSignal to cancel the request
 * @returns The page payload containing `bodyContent` and `metadata` with `title` and `description`
 */
export async function fetchKnowledgePage(path: string, signal?: AbortSignal): Promise<KnowledgePageResponse> {
  const search = new URLSearchParams({ path }).toString();
  return apiRequest<KnowledgePageResponse>({
    path: `/knowledge/page?${search}`,
    signal,
  });
}