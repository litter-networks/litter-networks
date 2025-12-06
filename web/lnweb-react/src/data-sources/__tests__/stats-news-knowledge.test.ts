// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as httpClient from '@/lib/httpClient';
import { fetchNewsItems } from '../news';
import { fetchKnowledgeChildPages, fetchKnowledgePage } from '../knowledge';
import { fetchBagsInfo, fetchStatsSummary } from '../stats';

describe('news, knowledge, and stats data sources', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the news path with optional cursor param and forwards signals', async () => {
    const spy = vi.spyOn(httpClient, 'apiRequest').mockResolvedValueOnce([]);

    await expect(fetchNewsItems()).resolves.toEqual([]);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/news/get-press-cuttings-json' }),
    );

    const signal = new AbortController().signal;
    spy.mockResolvedValueOnce([]);
    await fetchNewsItems('cursor-123', signal);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/news/get-press-cuttings-json/cursor-123',
        signal,
      }),
    );
  });

  it('builds knowledge endpoints with query parameters', async () => {
    const childSpy = vi
      .spyOn(httpClient, 'apiRequest')
      .mockResolvedValueOnce({ childPages: [] });
    await fetchKnowledgeChildPages('path/with space');
    expect(childSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/knowledge/child-pages?path=path%2Fwith+space' }),
    );

    const pageSpy = vi.spyOn(httpClient, 'apiRequest').mockResolvedValueOnce({
      bodyContent: 'html',
      metadata: { title: 'title', description: 'desc' },
    });
    const signal = new AbortController().signal;
    await fetchKnowledgePage('somepath', signal);
    expect(pageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/knowledge/page?path=somepath',
        signal,
      }),
    );
  });

  it('constructs stats paths based on identifier trick', async () => {
    const bagSpy = vi
      .spyOn(httpClient, 'apiRequest')
      .mockResolvedValueOnce({ bagCounts: {}, memberCountNetwork: 0 });
    await fetchBagsInfo('network-id');
    expect(bagSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/stats/get-bags-info/network-id' }),
    );

    const summarySpy = vi.spyOn(httpClient, 'apiRequest');
    summarySpy.mockResolvedValueOnce({ memberCountAll: 1 });
    await fetchStatsSummary();
    expect(summarySpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/stats/summary' }),
    );

    summarySpy.mockResolvedValueOnce({ memberCountAll: 1 });
    await fetchStatsSummary('all');
    expect(summarySpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/stats/summary' }),
    );

    summarySpy.mockResolvedValueOnce({ memberCountAll: 1 });
    await fetchStatsSummary('network-id');
    expect(summarySpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/stats/summary/network-id' }),
    );
  });
});
