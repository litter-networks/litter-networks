// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { StatsBoardImage } from '../StatsBoardImage';
import * as statsData from '@/data-sources/stats';
import * as renderStatsBoardModule from '../renderStatsBoard';

class MockImage {
  onload?: () => void;
  onerror?: (event: Event) => void;
  crossOrigin?: string;
  src = '';

  constructor() {
    setTimeout(() => {
      this.onload?.();
    }, 0);
  }
}

describe('StatsBoardImage', () => {
  let originalImage: typeof Image;

  beforeEach(() => {
    originalImage = globalThis.Image;
    globalThis.Image = MockImage as unknown as typeof Image;
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });

  it('displays a placeholder and then renders the generated data URL', async () => {
    const placeholder = '/placeholder.png';
    const bagInfo: statsData.BagsInfo = {
      bagCounts: {
        thisMonthName: '',
        thisMonth: 0,
        lastMonthName: '',
        lastMonth: 0,
        thisYearName: '',
        thisYear: 0,
        lastYearName: '',
        lastYear: 0,
        allTime: 0,
      },
      networkName: 'Example Network',
      districtName: 'Example District',
    };
    vi.spyOn(statsData, 'fetchBagsInfo').mockResolvedValue(bagInfo);

    const renderSpy = vi
      .spyOn(renderStatsBoardModule, 'renderStatsBoard')
      .mockResolvedValue('data:image/png;base64,stats');

    render(<StatsBoardImage uniqueId="test-id" placeholderSrc={placeholder} />);

    const img = screen.getByAltText('');
    expect(img).toHaveAttribute('src', placeholder);
    expect(img).toHaveAttribute('aria-busy', 'true');

    await waitFor(() => expect(renderSpy).toHaveBeenCalled());
    await waitFor(() => {
      expect(img).toHaveAttribute('src', 'data:image/png;base64,stats');
      expect(img).toHaveAttribute('aria-busy', 'false');
    });
  });
});
