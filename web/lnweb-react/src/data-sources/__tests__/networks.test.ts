import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as httpClient from '@/lib/httpClient';
import { fetchNearbyNetworks, useNetworks } from '../networks';

describe('networks data source', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads networks and exposes loading state through the hook', async () => {
    const apiSpy = vi
      .spyOn(httpClient, 'apiRequest')
      .mockResolvedValueOnce([{ uniqueId: 'test-net' }]);

    const { result } = renderHook(() => useNetworks());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.networks).toEqual([{ uniqueId: 'test-net' }]);
    expect(apiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/info/networks',
      }),
    );
  });

  it('returns nearby networks and handles 404 gracefully', async () => {
    const nearby = [{ uniqueId: 'nearby-net' }];
    const apiSpy = vi
      .spyOn(httpClient, 'apiRequest')
      .mockResolvedValueOnce(nearby)
      .mockRejectedValueOnce(new httpClient.HttpError('not found', 404, {}));

    const signal = new AbortController().signal;
    await expect(fetchNearbyNetworks('selected', signal)).resolves.toEqual(nearby);
    expect(apiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/info/networks/selected/nearby',
        signal,
      }),
    );

    await expect(fetchNearbyNetworks('selected', signal)).resolves.toEqual([]);
  });
});
