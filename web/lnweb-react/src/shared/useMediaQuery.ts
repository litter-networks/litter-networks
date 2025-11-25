import { useEffect, useState } from 'react';

/**
 * Simple hook that matches a media query while providing an SSR-safe default.
 *
 * @param query - Media query string
 * @param defaultMatches - value to return when window isn't available (SSR)
 * @returns Whether the query currently matches
 */
export function useMediaQuery(query: string, defaultMatches = false): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return defaultMatches;
    }
    if (typeof window.matchMedia !== 'function') {
      return defaultMatches;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQueryList = window.matchMedia(query);
    const updateMatches = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQueryList.addEventListener('change', updateMatches);
    return () => mediaQueryList.removeEventListener('change', updateMatches);
  }, [query]);

  return matches;
}
