// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavData } from '@/features/nav/useNavData';
import { usePageTitle } from '@/shared/hooks/usePageTitle';
import { fetchDistrictsCsv, type DistrictCsvRow } from '@/data-sources/districts';
import { scheduleStateUpdate } from '@/shared/utils/scheduleStateUpdate';
import { ChooserWidget, type ViewMode } from './components/ChooserWidget';
import { JoinInMapView } from '@/components/join-in/choose/JoinInMapView';
import { JoinInDistrictList } from '@/components/join-in/choose/JoinInDistrictList';
import styles from './styles/join-in-choose.module.css';
import type { DistrictGroup } from './choose-types';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

const VIEW_MODE_STORAGE_KEY = 'ln.choose.viewMode';
const UNKNOWN_DISTRICT_KEY = 'unknown';
const CHOOSE_PLACEHOLDER = '- please choose -';

interface LayerClickMessage {
  type: 'layerClick';
  data: {
    areaFullName?: string;
    areaId?: string;
    networkFullName?: string;
    networkId?: string;
  };
}

type ScrollTarget =
  | { type: 'district'; id: string }
  | { type: 'network'; id: string; districtId?: string };

export function JoinInChoosePage() {
  const { network, networks } = useNavData();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1100px)', false);
  usePageTitle('Join In | Choose');

  const [areaName, setAreaName] = useState(CHOOSE_PLACEHOLDER);
  const [networkName, setNetworkName] = useState(CHOOSE_PLACEHOLDER);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set());
  const [districtMeta, setDistrictMeta] = useState<Record<string, DistrictCsvRow>>({});
  const mapRootRef = useRef<HTMLDivElement>(null);
  const selectionFromMapRef = useRef(false);
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null);
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
    scheduleStateUpdate(() => setSelectedNetworkId(network.uniqueId));
    scheduleStateUpdate(() => setNetworkName(network.fullName ?? network.uniqueId));
    const primaryDistId = network.districtId?.split(',')[0].trim();
    scheduleStateUpdate(() => setAreaName(getDistrictLabel(primaryDistId, network.districtFullName)));
    if (network.districtId) {
      scheduleStateUpdate(() =>
        setExpandedDistricts((prev) => {
          const next = new Set(prev);
          next.add(network.districtId as string);
          return next;
        }),
      );
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
      scheduleStateUpdate(() => setAreaName(info.areaFullName || info.areaId || CHOOSE_PLACEHOLDER));
      const { networkFullName, networkId } = info;
      if (typeof networkId === 'string' && networkId.length > 0) {
        const resolvedName = networkFullName ?? networkId;
        scheduleStateUpdate(() => setNetworkName(resolvedName));
        scheduleStateUpdate(() => setSelectedNetworkId(networkId));
      } else {
        scheduleStateUpdate(() => setNetworkName(CHOOSE_PLACEHOLDER));
        scheduleStateUpdate(() => setSelectedNetworkId(null));
      }
      const scrollCandidate: ScrollTarget | null =
        typeof networkId === 'string' && networkId.length
          ? { type: 'network', id: networkId, districtId: info.areaId }
          : typeof info.areaId === 'string' && info.areaId.length
          ? { type: 'district', id: info.areaId }
          : null;
      if (scrollCandidate) {
        setScrollTarget(scrollCandidate);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);
  useEffect(() => {
    if (!scrollTarget) {
      return;
    }
    if (!(isDesktop || viewMode === 'list')) {
      return;
    }
    if (scrollTarget.type === 'network' && scrollTarget.districtId && !expandedDistricts.has(scrollTarget.districtId)) {
      return;
    }

    if (typeof document === 'undefined') {
      return;
    }

    const selector =
      scrollTarget.type === 'network'
        ? `[data-net-id="${scrollTarget.id}"]`
        : `[data-district-id="${scrollTarget.id}"]`;
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
      return;
    }

    const scrollContainer = document.querySelector<HTMLElement>('[data-joinin-list-scroll]');
    const margin = 64;
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const isFullyVisible =
        elementRect.top >= containerRect.top + margin &&
        elementRect.bottom <= containerRect.bottom;
      if (!isFullyVisible) {
        const targetTop =
          scrollContainer.scrollTop + (elementRect.top - containerRect.top) - margin;
        scrollContainer.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth',
        });
      }
    } else {
      element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    }

    scheduleStateUpdate(() => setScrollTarget(null));
  }, [scrollTarget, viewMode, isDesktop, expandedDistricts]);
  useEffect(() => {
    if (!selectedNetworkId) return;
    const matched = networks.find((n) => n.uniqueId === selectedNetworkId);
    if (matched?.districtId) {
      scheduleStateUpdate(() =>
        setExpandedDistricts((prev) => {
          const next = new Set(prev);
          matched.districtId
            ?.split(',')
            .map((id) => id.trim())
            .filter(Boolean)
            .forEach((id) => next.add(id));
          return next;
        }),
      );
      if (areaName === CHOOSE_PLACEHOLDER) {
        const primaryId = matched.districtId.split(',').map((id) => id.trim()).filter(Boolean)[0];
        const districtName = getDistrictLabel(primaryId, matched.districtFullName);
        if (districtName) {
          scheduleStateUpdate(() => setAreaName(districtName));
        }
      }
      if (networkName === CHOOSE_PLACEHOLDER && (matched.fullName || matched.uniqueId)) {
        scheduleStateUpdate(() => setNetworkName(matched.fullName ?? matched.uniqueId));
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
          <div className={styles.splitLayout}>
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
            <JoinInMapView
              mapRef={mapRootRef}
              viewMode={viewMode}
              mapSelection={mapSelection}
              selectionFromMapRef={selectionFromMapRef}
            />
          </div>
        </div>

        <ChooserWidget
          title="Join In | Choose"
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
