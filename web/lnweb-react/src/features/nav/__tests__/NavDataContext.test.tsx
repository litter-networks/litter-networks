import { renderHook, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

const mockNavigate = vi.fn();
const mockUseNetworks = vi.fn();
const mockFetchNearbyNetworks = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/data-sources/networks', () => ({
  useNetworks: () => mockUseNetworks(),
  fetchNearbyNetworks: mockFetchNearbyNetworks,
}));

describe('NavDataProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('provides context derived from the selected network and fetches nearby networks', async () => {
    const { NavDataProvider } = await import('../NavDataContext');
    const { useNavData } = await import('../useNavData');

    const network = {
      uniqueId: 'test-net',
      shortId: 'short',
      fullName: 'Test Network',
    };
    mockUseNetworks.mockReturnValue({ networks: [network], loading: false });
    const nearby = [{ uniqueId: 'nearby', fullName: 'Nearby Network' }];
    mockFetchNearbyNetworks.mockResolvedValue(nearby);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <NavDataProvider filterStringParam="short">{children}</NavDataProvider>
    );

    const { result } = renderHook(() => useNavData(), { wrapper });

    await waitFor(() => {
      expect(result.current.nearbyNetworks).toEqual(nearby);
    });

    expect(result.current.filterString).toBe('short');
    expect(result.current.network).toEqual(network);
    expect(result.current.loading).toBe(false);
    expect(result.current.displayName).toBe('Test Network Litter Network');
    expect(result.current.facebookLink).toBe(`https://www.facebook.com/groups/${network.uniqueId}`);
    expect(result.current.buildPath('join-in')).toBe('/short/join-in');
    expect(result.current.recentNetworks).toEqual([network]);
    expect(result.current.favoriteNetworks).toEqual([]);
    expect(result.current.isFavorite(network.uniqueId)).toBe(false);
    expect(mockFetchNearbyNetworks).toHaveBeenCalledWith(network.uniqueId, expect.any(AbortSignal));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('excludes favourites from recent list', async () => {
    const { NavDataProvider } = await import('../NavDataContext');
    const { useNavData } = await import('../useNavData');

    const networkA = { uniqueId: 'net-a', shortId: 'a', fullName: 'Network A' };
    const networkB = { uniqueId: 'net-b', shortId: 'b', fullName: 'Network B' };
    mockUseNetworks.mockReturnValue({ networks: [networkA, networkB], loading: false });
    mockFetchNearbyNetworks.mockResolvedValue([]);

    window.localStorage.setItem(
      'ln.network-usage',
      JSON.stringify({
        [networkA.uniqueId]: { visits: 10, lastVisited: 1 },
        [networkB.uniqueId]: { visits: 2, lastVisited: 2 },
      }),
    );
    window.localStorage.setItem('ln.network-favorites', JSON.stringify([networkA.uniqueId]));

    const wrapper = ({ children }: { children: ReactNode }) => (
      <NavDataProvider filterStringParam={networkB.uniqueId}>{children}</NavDataProvider>
    );

    const { result } = renderHook(() => useNavData(), { wrapper });

    await waitFor(() => {
      expect(result.current.favoriteNetworks.map((n) => n?.uniqueId)).toEqual(['net-a']);
    });

    expect(result.current.recentNetworks.map((n) => n.uniqueId)).toEqual(['net-b']);
  });

  it('redirects to /all when filterStringParam is missing', async () => {
    mockUseNetworks.mockReturnValue({ networks: [], loading: false });

    const { NavDataProvider } = await import('../NavDataContext');

    render(
      <NavDataProvider>
        <div />
      </NavDataProvider>,
    );

    expect(mockNavigate).toHaveBeenCalledWith('/all', { replace: true });
  });
});

describe('useNavData', () => {
  it('throws when used outside NavDataProvider', async () => {
    const { useNavData } = await import('../useNavData');
    expect(() => renderHook(() => useNavData())).toThrow(
      'useNavData must be used within NavDataProvider',
    );
  });
});
