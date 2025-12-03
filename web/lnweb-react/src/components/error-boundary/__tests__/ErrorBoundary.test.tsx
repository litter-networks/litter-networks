import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const Boom = () => {
  throw new Error('boom');
};

describe('ErrorBoundary', () => {
  it('renders fallback when child throws', () => {
    render(
      <ErrorBoundary name="Widget">
        <Boom />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Widget failed to load.');
    expect(alert.textContent).toContain('boom');
  });

  it('renders children if no error', () => {
    render(
      <ErrorBoundary name="Widget">
        <div>ok</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeTruthy();
  });
});
