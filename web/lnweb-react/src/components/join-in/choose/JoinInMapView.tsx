import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { fetchAreaInfo } from '@/data-sources/maps';
import { loadMapsAssets } from '@/shared/maps/mapsAssets';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import type { ViewMode } from '@/pages/join-in/components/ChooserWidget';
import styles from '@/pages/join-in/styles/join-in-choose.module.css';

type MapSelection = {
  districtId: string;
  networkId: string;
};

type Props = {
  mapRef: RefObject<HTMLDivElement | null>;
  viewMode: ViewMode;
  mapSelection: MapSelection;
  selectionFromMapRef: MutableRefObject<boolean>;
};

export function JoinInMapView({ mapRef, viewMode, mapSelection, selectionFromMapRef }: Props) {
  const [mapReady, setMapReady] = useState(false);
  const initialisedRef = useRef(false);
  const initialSelectionRef = useRef<MapSelection>(mapSelection);
  const isDesktop = useMediaQuery('(min-width: 1100px)', false);

  // Keep the initial selection up to date before the map initializes.
  useEffect(() => {
    if (!initialisedRef.current) {
      initialSelectionRef.current = mapSelection;
    }
  }, [mapSelection]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function init() {
      if (initialisedRef.current) {
        return;
      }
      if (!mapRef.current) {
        return;
      }
      setMapReady(false);
      try {
        const [areaInfo] = await Promise.all([fetchAreaInfo(controller.signal), loadMapsAssets()]);
        if (cancelled || !window.createMap || !mapRef.current) return;
        mapRef.current.innerHTML = '';
        window.createMap(
          'areas',
          'https://cdn.litternetworks.org',
          'heatmap-lymm.json',
          areaInfo,
          true,
          initialSelectionRef.current,
          '',
        );
        initialisedRef.current = true;
        setMapReady(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Could not render map', error);
        }
      }
    }

    init().catch((error) => {
      if (!controller.signal.aborted) {
        console.error('Failed to initialise join-in map', error);
      }
    });

    const rootElement = mapRef.current;

    return () => {
      cancelled = true;
      controller.abort();
      rootElement?.replaceChildren();
      initialisedRef.current = false;
    };
  }, [mapRef]);

  useEffect(() => {
    if (!initialisedRef.current) {
      return;
    }
    if (selectionFromMapRef.current) {
      selectionFromMapRef.current = false;
      return;
    }
    if (!window.updateMapSelection) {
      return;
    }
    try {
      window.updateMapSelection(mapSelection);
    } catch (error) {
      console.error('Failed to update map selection', error);
    }
  }, [mapSelection, selectionFromMapRef]);

  const shouldShow = isDesktop || viewMode === 'map';

  return (
    <div
      className={`${styles.mapPane} ${styles.viewPane} ${
        shouldShow ? styles.viewPaneActive : styles.viewPaneHiddenLeft
      }`}
    >
      <div id="map" ref={mapRef} className={styles.mapRoot} />
      {shouldShow && !mapReady && <div className={styles.mapFrame}>Loading map…</div>}
    </div>
  );
}
