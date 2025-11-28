import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockUseNavData = vi.fn();

vi.mock('@/features/nav/useNavData', () => ({
  useNavData: () => mockUseNavData(),
}));

vi.mock('@/components/stats/StatsBoardImage', () => ({
  StatsBoardImage: ({ uniqueId }: { uniqueId: string }) => (
    <div data-testid="stats-board" data-uniqueid={uniqueId} />
  ),
}));

vi.mock('@/shared/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

const HomePage = async () => (await import('../HomePage')).HomePage;

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the default layout when no network is selected', async () => {
    mockUseNavData.mockReturnValue({
      network: undefined,
      buildPath: (path?: string) => `/all/${path ?? ''}`,
    });

    const Component = await HomePage();
    render(<Component />);

    const [desktopHowItWorksLink] = screen.getAllByText('How It Works');
    expect(desktopHowItWorksLink.closest('a')).toHaveAttribute(
      'href',
      '/all/knowledge/getting-started/how-it-works',
    );
    const [desktopNewsLink] = screen.getAllByText('News');
    expect(desktopNewsLink.closest('a')).toHaveAttribute('href', '/all/news');
    expect(screen.getAllByRole('link').length).toBe(6);
  });

  it('renders network-specific blocks and the stats board when a network is selected', async () => {
    const network = { uniqueId: 'net-id', shortId: 'short' };
    mockUseNavData.mockReturnValue({
      network,
      buildPath: (path?: string) => `/short/${path ?? ''}`,
    });

    const Component = await HomePage();
    render(<Component />);

    const [desktopFacebookLink] = screen.getAllByText('Join In on Facebook');
    expect(desktopFacebookLink.closest('a')).toHaveAttribute(
      'href',
      `https://www.facebook.com/groups/${network.uniqueId}`,
    );
    const [desktopStatsBoard] = screen.getAllByTestId('stats-board');
    expect(desktopStatsBoard).toHaveAttribute('data-uniqueid', network.uniqueId);
  });
});
