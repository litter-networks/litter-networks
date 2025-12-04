// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import NetworkSelector from "../NetworkSelector/NetworkSelector";
import styles from "./styles/NetworkNavigation.module.css";

type Option = { id: string; label: string };
type PrefetchStatus = { prevReady?: boolean; nextReady?: boolean; nextTwoReady?: boolean };

type Props = {
  options: Option[];
  value?: string;
  onChange: (id: string) => void;
  arrowLockEnabled: boolean;
  onToggleArrowLock: () => void;
  prefetchStatus: PrefetchStatus;
};

/**
 * Render navigation UI for selecting a network, toggling arrow-lock, and showing prefetch readiness.
 *
 * @param options - Array of selectable network options (each with `id` and `label`).
 * @param value - Currently selected option id, or `undefined` when none is selected.
 * @param onChange - Called with the selected option id when the selection changes.
 * @param arrowLockEnabled - When `true`, the arrow-lock toggle is shown in its active state.
 * @param onToggleArrowLock - Callback invoked when the arrow-lock toggle is clicked.
 * @param prefetchStatus - Readiness flags for adjacent prefetched networks:
 *   - `prevReady`: previous network is prefetched and ready
 *   - `nextReady`: next network is prefetched and ready
 *   - `nextTwoReady`: second-next network is prefetched and ready
 *
 * @returns The NetworkNavigation React element.
 */
export default function NetworkNavigation({
  options,
  value,
  onChange,
  arrowLockEnabled,
  onToggleArrowLock,
  prefetchStatus
}: Props) {
  return (
    <div className={styles.navShell}>
      <div className={styles.selector}>
        <NetworkSelector options={options} value={value} onChange={onChange} />
      </div>
      <button
        type="button"
        className={`featureToggleButton ${arrowLockEnabled ? "featureToggleButtonActive" : ""}`}
        onClick={onToggleArrowLock}
      >◄ | ►</button>
      <div className={styles.prefetch}>
        <span className={styles.label}>Prev</span>
        <span className={`${styles.dot} ${prefetchStatus.prevReady ? styles.dotReady : ""}`} />
        <span className={styles.label}>Next</span>
        <div className={styles.nextDots}>
          <span className={`${styles.dot} ${prefetchStatus.nextReady ? styles.dotReady : ""}`} />
          <span className={`${styles.dot} ${prefetchStatus.nextTwoReady ? styles.dotReady : ""}`} />
        </div>
      </div>
    </div>
  );
}
