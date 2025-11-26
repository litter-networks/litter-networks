import type { RefObject } from 'react';
import type { ViewMode } from '@/pages/join-in/components/ChooserWidget';
import styles from '@/pages/join-in/styles/join-in-choose.module.css';

type Props = {
  mapRef: RefObject<HTMLDivElement>;
  mapReady: boolean;
  viewMode: ViewMode;
};

export function JoinInMapView({ mapRef, mapReady, viewMode }: Props) {
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
