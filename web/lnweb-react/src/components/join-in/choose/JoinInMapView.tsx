import { useEffect, useState, type MutableRefObject, type RefObject } from 'react';
import { fetchAreaInfo } from '@/data-sources/maps';
import { loadMapsAssets } from '@/shared/mapsAssets';
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

const resetMapContainer = (container: HTMLDivElement | null) => {
  if (!container) return;
  container.replaceChildren();
  delete (container as unknown as { _leaflet_id?: string })._leaflet_id;
};

const recreateMapContainer = (ref: React.RefObject<HTMLDivElement | null>) => {
  const node = ref.current;
  if (!node || !node.parentElement) return null;
  const clone = node.cloneNode(false) as HTMLDivElement;
  node.parentElement.replaceChild(clone, node);
  ref.current = clone;
  return clone;
};

export function JoinInMapView({ mapRef, viewMode, mapSelection, selectionFromMapRef }: Props) {
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (selectionFromMapRef.current) {
      selectionFromMapRef.current = false;
      return () => {};
    }
    if (viewMode !== 'map') {
      resetMapContainer(mapRef.current);
      setMapReady(false);
      return () => {};
    }
    if (!mapRef.current) {
      return () => {};
    }
    setMapReady(false);
    const container = recreateMapContainer(mapRef) ?? mapRef.current;
    resetMapContainer(container);
    let cancelled = false;
    const controller = new AbortController();
    const run = async () => {
      try {
        await loadMapsAssets();
        const areaInfo = await fetchAreaInfo(controller.signal);
        if (cancelled || !window.createMap || !mapRef.current) return;
        (mapRef.current as unknown as { _leaflet_id?: string })._leaflet_id = undefined;
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
      resetMapContainer(mapRef.current);
    };
  }, [mapRef, mapSelection, viewMode, selectionFromMapRef]);

  if (viewMode !== 'map') {
    return null;
  }
  return (
    <div className={styles.mapPane}>
      <div id="map" ref={mapRef} className={styles.mapRoot} />
      {!mapReady && <div className={styles.mapFrame}>Loading map…</div>}
    </div>
  );
}
