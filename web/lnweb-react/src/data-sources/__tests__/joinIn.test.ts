import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as httpClient from '@/lib/httpClient';
import { fetchDistrictLocalInfo } from '../joinIn';

describe('join-in data source', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when no primary district id can be derived', async () => {
    await expect(fetchDistrictLocalInfo('')).resolves.toBeNull();
  });

  it('fetches district info for the primary district id and encodes the path', async () => {
    const data = { uniqueId: 'primary', disposeEmail: 'test' };
    const apiSpy = vi
      .spyOn(httpClient, 'apiRequest')
      .mockResolvedValueOnce(data as any);

    const result = await fetchDistrictLocalInfo('primary,secondary');
    expect(result).toEqual(data);
    expect(apiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/join-in/districts/primary/local-info',
      }),
    );
  });

  it('logs and swallows errors from the API call', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(httpClient, 'apiRequest').mockRejectedValueOnce(new Error('boom'));

    await expect(fetchDistrictLocalInfo('primary')).resolves.toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load district local info'),
      expect.any(Error),
    );
  });
});
