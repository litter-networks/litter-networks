// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockFetchNewsItems = vi.fn();

vi.mock('@/data-sources/news', () => ({
  fetchNewsItems: (...args: unknown[]) => mockFetchNewsItems(...args),
  formatNewsDate: (date: string) => `formatted-${date}`,
}));

vi.mock('@/shared/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

const NewsPage = async () => (await import('../NewsPage')).NewsPage;

describe('NewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders news rows after fetching data', async () => {
    const items = [
      {
        uniqueId: '1',
        sourceUrl: 'https://example.com/article-1',
        title: 'First Story',
        description: 'First desc',
        siteName: 'Example',
        articleDate: '2024-01-01',
        imageUrl: '/image-1.jpg',
      },
    ];
    mockFetchNewsItems.mockResolvedValueOnce(items);

    const Component = await NewsPage();
    render(<Component />);

    await waitFor(() => expect(screen.getAllByText('First Story').length).toBeGreaterThan(0));
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', items[0].sourceUrl);
    expect(screen.getAllByAltText('First Story').length).toBeGreaterThan(0);
  });

  it('shows an error message when the fetch fails', async () => {
    mockFetchNewsItems.mockRejectedValueOnce(new Error('boom'));

    const Component = await NewsPage();
    render(<Component />);

    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });
});
