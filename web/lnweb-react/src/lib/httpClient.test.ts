// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, HttpError } from './httpClient';

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed json on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'ok' }),
      }),
    );

    const result = await apiRequest<{ message: string }>({ path: '/health' });
    expect(result.message).toBe('ok');
  });

  it('throws HttpError on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'boom' }),
      }),
    );

    await expect(apiRequest({ path: '/oops' })).rejects.toBeInstanceOf(HttpError);
  });
});
