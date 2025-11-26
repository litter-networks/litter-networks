import { useEffect, useState } from 'react';

/**
 * Simple hook that matches a media query while providing an SSR-safe default.
 *
 * @param query - Media query string
 * @param defaultMatches - value to return when window isn't available (SSR)
 * @returns Whether the query currently matches
 */
export function useMediaQuery(query: string, defaultMatches = false): boolean {
  const [matches, setMatches] = useState(defaultMatches);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQueryList = window.matchMedia(query);
    // Update to current match once we're on the client even though the hook initialized with defaultMatches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(mediaQueryList.matches);

    const updateMatches = (event: MediaQueryListEvent) => setMatches(event.matches);
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', updateMatches);
      return () => mediaQueryList.removeEventListener('change', updateMatches);
    }

    if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(updateMatches);
      return () => mediaQueryList.removeListener(updateMatches);
    }

    return undefined;
  }, [query]);

  return matches;
}
