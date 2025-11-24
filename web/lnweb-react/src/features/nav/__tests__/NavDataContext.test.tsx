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
  });

  it('provides context derived from the selected network and fetches nearby networks', async () => {
    const { NavDataProvider, useNavData } = await import('../NavDataContext');

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
    expect(mockFetchNearbyNetworks).toHaveBeenCalledWith(network.uniqueId, expect.any(AbortSignal));
    expect(mockNavigate).not.toHaveBeenCalled();
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
    const { useNavData } = await import('../NavDataContext');
    expect(() => renderHook(() => useNavData())).toThrow(
      'useNavData must be used within NavDataProvider',
    );
  });
});
