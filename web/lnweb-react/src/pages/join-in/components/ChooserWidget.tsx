// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import styles from './styles/chooser-widget.module.css';

export type ViewMode = 'map' | 'list';

type Props = {
  title: string;
  areaName: string;
  networkName: string;
  onCancel: () => void;
  onChoose: () => void;
  chooseDisabled?: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
};

/**
 * Renders the overlaid Join In chooser controls: title badge, cancel/choose buttons,
 * selected area/network details, and a view-mode toggle (map vs list).
 */
export function ChooserWidget({
  areaName,
  networkName,
  onCancel,
  onChoose,
  chooseDisabled,
  viewMode,
  onViewModeChange,
}: Props) {
  return (
    <div className={styles.overlayShell}>
      <div className={styles.overlayControls}>
        <button type="button" className={styles.actionButton} onClick={onCancel}>
          Cancel
        </button>

        <div className={styles.centerStack}>
          <div className={styles.detailsCard}>
            <div>
              <b>Area:</b> {areaName}
            </div>
            <div>
              <b>Network:</b> {networkName}
            </div>
          </div>
          <div
            className={`${styles.viewSwitch} ${
              viewMode === 'list' ? styles.viewSwitchList : styles.viewSwitchMap
            }`}
            role="group"
            aria-label="Select view mode"
          >
            <span className={styles.viewSwitchThumb} aria-hidden="true" />
            <button
              type="button"
              className={`${styles.viewSwitchOption} ${viewMode === 'map' ? styles.viewSwitchOptionActive : ''}`}
              aria-pressed={viewMode === 'map'}
              onClick={() => onViewModeChange('map')}
            >
              Map
            </button>
            <button
              type="button"
              className={`${styles.viewSwitchOption} ${viewMode === 'list' ? styles.viewSwitchOptionActive : ''}`}
              aria-pressed={viewMode === 'list'}
              onClick={() => onViewModeChange('list')}
            >
              List
            </button>
          </div>
        </div>

        <button type="button" className={styles.actionButton} onClick={onChoose} disabled={chooseDisabled}>
          Choose
        </button>
      </div>
    </div>
  );
}
