import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchAreaInfo } from '@/data-sources/maps';
import { loadMapsAssets } from '@/shared/mapsAssets';
import styles from './styles/map-area.module.css';

export function MapAreaPage() {
  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') ?? '';
  useEffect(() => {
    document.title = 'Join In | Choose - Litter Networks';
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setMapReady(false);
      const [areaInfo] = await Promise.all([
        fetchAreaInfo(controller.signal),
        loadMapsAssets(),
      ]);
      if (cancelled) {
        return;
      }

      if (window.createMap && mapRootRef.current) {
        try {
          mapRootRef.current.innerHTML = '';
          window.createMap(
            'areas',
            'https://cdn.litternetworks.org',
            'heatmap-lymm.json',
            areaInfo,
            false,
            {},
            mode,
          );
          setMapReady(true);
        } catch (error) {
          console.error('Could not render area map', error);
        }
      }
    }

    load().catch((error) => {
      if (controller.signal.aborted) {
        return;
      }
      console.error('Failed to initialise area map', error);
    });

    return () => {
      cancelled = true;
      controller.abort();
      mapRootRef.current?.replaceChildren();
    };
  }, [mode]);

  return (
    <div className={styles.page}>
      <div className={styles.mapSurface}>
        <div id="map" ref={mapRootRef} className={styles.mapRoot} />
        {!mapReady && <div className={styles.mapPlaceholder}>Loading map…</div>}
      </div>
    </div>
  );
}
