import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavData } from '@/features/nav/useNavData';
import { fetchAreaInfo } from '@/data-sources/maps';
import { loadMapsAssets } from '@/shared/mapsAssets';
import { usePageTitle } from '@/shared/usePageTitle';
import styles from './styles/join-in-choose.module.css';

interface LayerClickMessage {
  type: 'layerClick';
  data: {
    areaFullName?: string;
    areaId?: string;
    networkFullName?: string;
    networkId?: string;
  };
}

/**
 * Render the Join In | Choose page with an interactive map and network selection toolbar.
 *
 * The component loads area information and map assets, initializes an embedded map,
 * and updates the displayed Area and Network when the map posts `layerClick` messages
 * from the same origin. Users can cancel to return to the previous or a safe fallback
 * path, or choose a highlighted network to navigate into that network (or redirect to
 * a resolved return URL if provided in navigation state/referrer).
 *
 * @returns The React element for the Join In | Choose page.
 */
export function JoinInChoosePage() {
  const { network } = useNavData();
  const navigate = useNavigate();
  const location = useLocation();
  usePageTitle('Join In | Choose');

  const [areaName, setAreaName] = useState('-');
  const [networkName, setNetworkName] = useState('-');
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);

  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      const [areaInfo] = await Promise.all([fetchAreaInfo(controller.signal), loadMapsAssets()]);
      if (cancelled) {
        return;
      }

      if (window.createMap && mapRootRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const selection: any = {
          districtId: network?.districtId ?? '',
          networkId: network?.uniqueId ?? '',
        };

        try {
          mapRootRef.current.innerHTML = '';
          window.createMap(
            'areas',
            'https://cdn.litternetworks.org',
            'heatmap-lymm.json',
            areaInfo,
            true,
            selection,
            '',
          );
          setMapReady(true);
        } catch (error) {
          console.error('Could not render map', error);
        }
      }
    }

    load().catch((error) => {
      if (controller.signal.aborted) {
        return;
      }
      console.error('Failed to initialise join-in map', error);
    });
    const rootElement = mapRootRef.current;
    return () => {
      cancelled = true;
      controller.abort();
      rootElement?.replaceChildren();
    };
  }, [network?.districtId, network?.uniqueId]);

  useEffect(() => {
    const handler = (event: MessageEvent<LayerClickMessage>) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (event.data?.type !== 'layerClick') {
        return;
      }
      const info = event.data.data;
      setAreaName(info.areaFullName || info.areaId || '-');
      if (info.networkId) {
        setNetworkName(info.networkFullName || info.networkId);
        setSelectedNetworkId(info.networkId);
      } else {
        setNetworkName('-');
        setSelectedNetworkId(null);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleCancel = () => {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
      navigate(-1);
    } else {
      const segments = location.pathname.split('/').filter(Boolean);
      const fallback = segments.length ? `/${segments[0]}` : '/';
      navigate(fallback);
    }
  };

  const handleChoose = () => {
    if (!selectedNetworkId) {
      return;
    }

    const returnUrl = resolveReturnUrl(location.state);
    if (returnUrl) {
      const destinationPath = buildDestinationPath(returnUrl.pathname, selectedNetworkId);
      window.location.href = `${window.location.origin}${destinationPath}${returnUrl.search}${returnUrl.hash}`;
      return;
    }

    navigate(`/${selectedNetworkId}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.mapContainerShell} data-map-container>
        <div className={styles.titleBar}>
          <div className={styles.infoPill}>
            <h1 className={styles.title}>
              Join In | <b>Choose</b>
            </h1>
          </div>
        </div>

        <div className={styles.mapSurface}>
          <div id="map" ref={mapRootRef} className={styles.mapRoot} />
          {!mapReady && <div className={styles.mapFrame}>Loading map…</div>}
        </div>

        <div className={styles.toolbar}>
          <button type="button" className={styles.button} onClick={handleCancel}>
            Cancel
          </button>
          <div className={styles.infoPill}>
            <div>
              <b>Area:</b> {areaName}
            </div>
            <div>
              <b>Network:</b> {networkName}
            </div>
          </div>
          <button
            type="button"
            className={styles.button}
            onClick={handleChoose}
            disabled={!selectedNetworkId}
          >
            Choose
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Determine a safe local return URL from navigation state or the document referrer.
 *
 * Attempts to read a `returnPath` string from the provided `state` and normalize it to a same-origin URL.
 * If that is not present or invalid, falls back to normalizing `document.referrer`. Returns `null` if no
 * suitable local URL can be resolved.
 *
 * @param state - Navigation state object that may contain a `returnPath` string
 * @returns A `URL` object for a validated same-origin return location, or `null` if none is available
 */
function resolveReturnUrl(state: unknown): URL | null {
  const statePath = extractReturnPath(state);
  if (statePath) {
    const urlFromState = normalizeLocalUrl(statePath);
    if (urlFromState) {
      return urlFromState;
    }
  }

  if (typeof document !== 'undefined' && document.referrer) {
    const referrerUrl = normalizeLocalUrl(document.referrer);
    if (referrerUrl) {
      return referrerUrl;
    }
  }

  return null;
}

/**
 * Extracts a `returnPath` string from a navigation state object.
 *
 * @param state - Object that may contain a `returnPath` property
 * @returns The `returnPath` string if present, otherwise `undefined`
 */
function extractReturnPath(state: unknown): string | undefined {
  if (!state || typeof state !== 'object') {
    return undefined;
  }
  const candidate = (state as { returnPath?: unknown }).returnPath;
  return typeof candidate === 'string' ? candidate : undefined;
}

/**
 * Validate and normalize a URL string to a same-origin URL that does not point to the join-in choose route.
 *
 * @param target - The URL string to normalize; may be relative or absolute.
 * @returns A `URL` object when `target` resolves to the current origin and its pathname does not include `/join-in/choose`, or `null` otherwise.
 */
function normalizeLocalUrl(target?: string | null) {
  if (typeof window === 'undefined' || !target) {
    return null;
  }
  try {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) {
      return null;
    }
    if (url.pathname.includes('/join-in/choose')) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Injects the provided `networkId` as the first path segment of `pathname`.
 *
 * @param pathname - The original pathname (may include leading or trailing slashes)
 * @param networkId - The network identifier to place as the first segment
 * @returns The normalized pathname starting with `/` where the first segment is `networkId`; remaining segments from `pathname` are preserved
 */
function buildDestinationPath(pathname: string, networkId: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length) {
    segments[0] = networkId;
  } else {
    segments.push(networkId);
  }
  return `/${segments.join('/')}`;
}
