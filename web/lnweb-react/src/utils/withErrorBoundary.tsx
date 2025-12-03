import type { ComponentType } from 'react';
import { forwardRef } from 'react';
import { ErrorBoundary } from '@/components/error-boundary/ErrorBoundary';

export function withErrorBoundary<P>(Component: ComponentType<P>, name: string) {
  const Wrapped = forwardRef<unknown, P>(function WrappedComponent(props, ref) {
    return (
      <ErrorBoundary name={name}>
        {/* @ts-expect-error forwarding unknown ref */}
        <Component ref={ref} {...props} />
      </ErrorBoundary>
    );
  });
  Wrapped.displayName = `WithErrorBoundary(${Component.displayName ?? Component.name ?? 'Component'})`;
  return Wrapped;
}
