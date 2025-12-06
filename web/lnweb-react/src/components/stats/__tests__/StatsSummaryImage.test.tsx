// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { StatsSummaryImage } from '../StatsSummaryImage';
import { loadHtml2Canvas } from '@/shared/utils/loadHtml2Canvas';

vi.mock('@/shared/utils/loadHtml2Canvas', () => ({
  loadHtml2Canvas: vi.fn(),
}));

const summaryData = {
  memberCountNetwork: 1,
  numNetworksInDistrict: 1,
  memberCountDistrict: 5,
  numNetworksInAll: 2,
  memberCountAll: 10,
};

describe('StatsSummaryImage', () => {
  let originalPixelRatio: number | undefined;

  beforeEach(() => {
    const loadHtml2CanvasMock = vi.mocked(loadHtml2Canvas);
    loadHtml2CanvasMock.mockResolvedValue(undefined);
    window.html2canvas = vi.fn(() =>
      Promise.resolve({
        toDataURL: () => 'data:image/png;base64,summary',
      } as unknown as HTMLCanvasElement),
    );
    originalPixelRatio = window.devicePixelRatio;
    window.devicePixelRatio = 2;
  });

  afterEach(() => {
    window.html2canvas = undefined;
    window.devicePixelRatio = originalPixelRatio ?? window.devicePixelRatio;
    vi.restoreAllMocks();
  });

  it('shows a placeholder until the html2canvas bitmap is ready', async () => {
    render(
      <StatsSummaryImage
        summary={summaryData}
        networkName="Test Network"
        districtName="Test District"
        className="summary-class"
      />,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,summary');
    expect(window.html2canvas).toHaveBeenCalled();
  });
});
