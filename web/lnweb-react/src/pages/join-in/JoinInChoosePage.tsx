import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavData } from '@/features/nav/useNavData';
import { fetchAreaInfo } from '@/data-sources/maps';
import { loadMapsAssets } from '@/shared/mapsAssets';
import { usePageTitle } from '@/shared/usePageTitle';
import { fetchDistrictsCsv, type DistrictCsvRow } from '@/data-sources/districts';
import { ChooserWidget, type ViewMode } from './components/ChooserWidget';
import { JoinInMapView } from '@/components/join-in/choose/JoinInMapView';
import { JoinInDistrictList } from '@/components/join-in/choose/JoinInDistrictList';
import styles from './styles/join-in-choose.module.css';
import type { DistrictGroup } from './choose-types';

const VIEW_MODE_STORAGE_KEY = 'ln.choose.viewMode';
const UNKNOWN_DISTRICT_KEY = 'unknown';

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
const resetMapContainer = (container: HTMLDivElement | null) => {
  if (!container) return;
  container.replaceChildren();
  delete (container as unknown as { _leaflet_id?: string })._leaflet_id;
};

const recreateMapContainer = (ref: React.RefObject<HTMLDivElement>) => {
  const node = ref.current;
  if (!node || !node.parentElement) return null;
  const clone = node.cloneNode(false) as HTMLDivElement;
  node.parentElement.replaceChild(clone, node);
  ref.current = clone;
  return clone;
};

export function JoinInChoosePage() {
  const { network, networks } = useNavData();
  const navigate = useNavigate();
  const location = useLocation();
  usePageTitle('Join In | Choose');

  const [areaName, setAreaName] = useState('-');
  const [networkName, setNetworkName] = useState('-');
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set());
  const [districtMeta, setDistrictMeta] = useState<Record<string, DistrictCsvRow>>({});
  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const selectionFromMapRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'map';
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === 'list' || stored === 'map' ? stored : 'map';
  });

  const getDistrictLabel = useCallback(
    (id?: string, fallback?: string) => {
      if (!id) return fallback ?? 'Other districts';
      return districtMeta[id]?.fullName ?? districtMeta[id]?.uniqueId ?? fallback ?? id ?? 'Other districts';
    },
    [districtMeta],
  );

  const groupedDistricts = useMemo(() => {
    const groups: Record<
      string,
      DistrictGroup
    > = {};
    networks.forEach((net) => {
      const ids =
        net.districtId
          ?.split(',')
          .map((id) => id.trim())
          .filter(Boolean) ?? [];
      const useIds = ids.length ? ids : [UNKNOWN_DISTRICT_KEY];
      const councilName = (net as Record<string, unknown>)?.councilName as string | undefined;
      const councilUrl = (net as Record<string, unknown>)?.councilUrl as string | undefined;
      useIds.forEach((id) => {
        const name = getDistrictLabel(id);
        if (!groups[id]) {
          groups[id] = {
            id,
            name,
            networks: [],
            councilUrl: districtMeta[id]?.councilUrl || councilUrl,
            councilName: districtMeta[id]?.councilName || councilName,
          };
        }
        groups[id].networks.push(net);
        if (!groups[id].councilUrl && (districtMeta[id]?.councilUrl || councilUrl)) {
          groups[id].councilUrl = districtMeta[id]?.councilUrl || councilUrl;
        }
        if (!groups[id].councilName && (districtMeta[id]?.councilName || councilName)) {
          groups[id].councilName = districtMeta[id]?.councilName || councilName;
        }
      });
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [districtMeta, getDistrictLabel, networks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!network?.uniqueId) return;
    setSelectedNetworkId(network.uniqueId);
    setNetworkName(network.fullName ?? network.uniqueId);
    const primaryDistId = network.districtId?.split(',')[0].trim();
    setAreaName(getDistrictLabel(primaryDistId, network.districtFullName));
    if (network.districtId) {
      setExpandedDistricts((prev) => {
        const next = new Set(prev);
        next.add(network.districtId as string);
        return next;
      });
    }
  }, [network?.uniqueId, network?.fullName, network?.districtFullName, network?.districtId, getDistrictLabel]);

  const selectedNetwork = useMemo(() => {
    if (selectedNetworkId) {
      return networks.find((n) => n.uniqueId === selectedNetworkId) ?? null;
    }
    return network ?? null;
  }, [network, networks, selectedNetworkId]);

  const mapSelection = useMemo(() => {
    const primaryDistrict =
      selectedNetwork?.districtId?.split(',').map((id) => id.trim()).find(Boolean) ?? network?.districtId ?? '';
    return {
      districtId: primaryDistrict ?? '',
      networkId: selectedNetwork?.uniqueId ?? network?.uniqueId ?? '',
    };
  }, [network?.districtId, network?.uniqueId, selectedNetwork]);
  const mapSelectionKey = `${mapSelection.districtId ?? ''}|${mapSelection.networkId ?? ''}`;

  useEffect(() => {
    if (selectionFromMapRef.current) {
      selectionFromMapRef.current = false;
      return () => {};
    }
    if (viewMode !== 'map') {
      resetMapContainer(mapRootRef.current);
      setMapReady(false);
      return () => {};
    }
    if (!mapRootRef.current) {
      return () => {};
    }
    setMapReady(false);
    const container = recreateMapContainer(mapRootRef) ?? mapRootRef.current;
    resetMapContainer(container);
    let cancelled = false;
    const controller = new AbortController();
    const run = async () => {
      try {
        await loadMapsAssets();
        const areaInfo = await fetchAreaInfo(controller.signal);
        if (cancelled || !window.createMap || !mapRootRef.current) return;
        window.createMap(
          'areas',
          'https://cdn.litternetworks.org',
          'heatmap-lymm.json',
          areaInfo,
          true,
          mapSelection,
          '',
        );
        setMapReady(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Could not render map', error);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
      controller.abort();
      resetMapContainer(mapRootRef.current);
    };
  }, [mapSelectionKey, viewMode]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDistrictsCsv(controller.signal)
      .then((rows) => {
        const meta: Record<string, DistrictCsvRow> = {};
        rows.forEach((row) => {
          if (!row.uniqueId) return;
          meta[row.uniqueId] = row;
        });
        setDistrictMeta(meta);
      })
      .catch(() => {
        setDistrictMeta({});
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent<LayerClickMessage>) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (event.data?.type !== 'layerClick') {
        return;
      }
      const info = event.data.data;
      selectionFromMapRef.current = true;
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
  useEffect(() => {
    if (!selectedNetworkId) return;
    const matched = networks.find((n) => n.uniqueId === selectedNetworkId);
    if (matched?.districtId) {
      setExpandedDistricts((prev) => {
        const next = new Set(prev);
        matched.districtId
          ?.split(',')
          .map((id) => id.trim())
          .filter(Boolean)
          .forEach((id) => next.add(id));
        return next;
      });
      if (areaName === '-') {
        const primaryId = matched.districtId.split(',').map((id) => id.trim()).filter(Boolean)[0];
        const districtName = getDistrictLabel(primaryId, matched.districtFullName);
        if (districtName) {
          setAreaName(districtName);
        }
      }
      if (networkName === '-' && (matched.fullName || matched.uniqueId)) {
        setNetworkName(matched.fullName ?? matched.uniqueId);
      }
    }
  }, [areaName, getDistrictLabel, networkName, networks, selectedNetworkId]);

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

  const toggleDistrict = (id: string) => {
    setExpandedDistricts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleListSelect = (netId: string) => {
    selectionFromMapRef.current = false;
    const net = networks.find((n) => n.uniqueId === netId);
    if (!net) return;
    setSelectedNetworkId(net.uniqueId);
    setNetworkName(net.fullName ?? net.uniqueId);
    const ids =
      net.districtId
        ?.split(',')
        .map((id) => id.trim())
        .filter(Boolean) ?? [];
    const primaryId = ids[0] ?? UNKNOWN_DISTRICT_KEY;
    const districtLabel = getDistrictLabel(primaryId, net.districtFullName);
    setAreaName(districtLabel ?? areaName);
    ids.forEach((id) => {
      if (!id) return;
      setExpandedDistricts((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    });
  };

  const totalDistricts = groupedDistricts.length;
  const totalNetworks = networks.length;

  return (
    <div className={styles.page}>
      <div className={styles.mapContainerShell} data-map-container>
        <div className={styles.mapSurface}>
          <JoinInMapView mapRef={mapRootRef} mapReady={mapReady} viewMode={viewMode} />
          <JoinInDistrictList
            viewMode={viewMode}
            groupedDistricts={groupedDistricts}
            expandedDistricts={expandedDistricts}
            toggleDistrict={toggleDistrict}
            handleListSelect={handleListSelect}
            selectedNetworkId={selectedNetworkId}
            totalNetworks={totalNetworks}
            totalDistricts={totalDistricts}
          />
        </div>

        <ChooserWidget
          areaName={areaName}
          networkName={networkName}
          onCancel={handleCancel}
          onChoose={handleChoose}
          chooseDisabled={!selectedNetworkId}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
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
