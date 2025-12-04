// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NetworkSwitcher } from '../NetworkSwitcher';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Link: ({ children, ...rest }: { children: ReactNode }) => (
      <button type="button" {...rest}>
        {children}
      </button>
    ),
  };
});

vi.mock('@/features/nav/useNavData', () => ({
  useNavData: () => ({
    buildPath: (suffix: string) => `/${suffix ?? ''}`.replace(/\/+/g, '/'),
    displayName: 'Test Network',
  }),
}));

vi.mock('../NetworkSwitcherMenu', () => ({
  NetworkSwitcherMenu: ({ open }: { open: boolean }) => (
    <div data-testid="network-menu">{open ? 'open' : 'closed'}</div>
  ),
}));

describe('NetworkSwitcher', () => {
  const renderSwitcher = () =>
    render(
      <MemoryRouter>
        <NetworkSwitcher headerColorClass="header-color" searchColorClass="search-color" />
      </MemoryRouter>,
    );

  it('toggles open state on hover only for mouse pointers', () => {
    renderSwitcher();
    const shell = screen.getByRole('button', { name: /test network/i }).closest('div');
    const menu = screen.getByTestId('network-menu');
    expect(menu).toHaveTextContent('closed');

    fireEvent.pointerEnter(shell!, { pointerType: 'mouse' });
    expect(menu).toHaveTextContent('open');

    fireEvent.pointerLeave(shell!, { pointerType: 'mouse' });
    expect(menu).toHaveTextContent('closed');

    fireEvent.pointerEnter(shell!, { pointerType: 'touch' });
    expect(menu).toHaveTextContent('closed');
  });

  it('opens and closes when the trigger link is tapped/clicked', async () => {
    renderSwitcher();
    const trigger = screen.getByRole('button', { name: /test network/i });
    const menu = screen.getByTestId('network-menu');

    fireEvent.pointerEnter(trigger.closest('div')!, { pointerType: 'touch' });
    expect(menu).toHaveTextContent('closed');

    fireEvent.click(trigger);
    await waitFor(() => expect(menu).toHaveTextContent('open'));

    fireEvent.click(trigger);
    await waitFor(() => expect(menu).toHaveTextContent('closed'));
  });
});
