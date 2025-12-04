// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchAreaInfo } from '@/data-sources/maps';
import { loadMapsAssets } from '@/shared/maps/mapsAssets';
import styles from './styles/map-area.module.css';

/**
 * Renders the "Choose - Litter Networks" map page that initializes and displays an interactive areas map.
 *
 * Initializes the map based on the optional `mode` URL query parameter, manages loading and error state, and shows a loading placeholder or an error message until the map is ready.
 *
 * @returns The JSX element containing the map container and its loading/error UI.
 */
export function MapAreaPage() {
  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
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
      setMapError(null);
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
          setMapError('Sorry, the map could not be loaded right now.');
        }
      }
    }

    load().catch((error) => {
      if (controller.signal.aborted) {
        return;
      }
      console.error('Failed to initialise area map', error);
      setMapError('Sorry, the map could not be loaded right now.');
    });

    const rootElement = mapRootRef.current;
    return () => {
      cancelled = true;
      controller.abort();
      rootElement?.replaceChildren();
    };
  }, [mode]);

  return (
    <div className={styles.page} data-area-map>
      <div className={styles.mapSurface}>
        <div id="map" ref={mapRootRef} className={styles.mapRoot} />
        {!mapReady && (
          <div className={mapError ? styles.mapError : styles.mapPlaceholder}>
            {mapError ?? 'Loading map…'}
          </div>
        )}
      </div>
    </div>
  );
}
