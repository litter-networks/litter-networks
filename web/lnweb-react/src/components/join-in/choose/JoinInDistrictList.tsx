import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { DistrictGroup } from '@/pages/join-in/choose-types';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import type { ViewMode } from '@/pages/join-in/components/ChooserWidget';
import styles from '@/pages/join-in/styles/join-in-choose.module.css';

type Props = {
  viewMode: ViewMode;
  groupedDistricts: DistrictGroup[];
  expandedDistricts: Set<string>;
  toggleDistrict: (id: string) => void;
  handleListSelect: (netId: string) => void;
  selectedNetworkId: string | null;
  totalNetworks: number;
  totalDistricts: number;
};

const WIDTH_STORAGE_KEY = 'ln.choose.listWidth';
const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 640;
const DESKTOP_BREAKPOINT = 1100;
const clampWidth = (value: number) => {
  if (Number.isNaN(value)) return DEFAULT_PANEL_WIDTH;
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, value));
};

export function JoinInDistrictList({
  viewMode,
  groupedDistricts,
  expandedDistricts,
  toggleDistrict,
  handleListSelect,
  selectedNetworkId,
  totalNetworks,
  totalDistricts,
}: Props) {
  const previousViewModeRef = useRef<ViewMode>(viewMode);
  const isDesktop = useMediaQuery(`(min-width: ${DESKTOP_BREAKPOINT}px)`, false);
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_PANEL_WIDTH;
    }
    const stored = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_PANEL_WIDTH;
    }
    return clampWidth(Number.parseInt(stored, 10));
  });
  const resizingStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const persistWidth = useCallback(
    (width: number) => {
      const trimmed = clampWidth(width);
      setPanelWidth(trimmed);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(WIDTH_STORAGE_KEY, trimmed.toString());
      }
    },
    [setPanelWidth],
  );

  useEffect(() => {
    const pointerMove = (event: PointerEvent) => {
      if (!resizingStateRef.current || !isDesktop) {
        return;
      }
      const delta = event.clientX - resizingStateRef.current.startX;
      const proposed = resizingStateRef.current.startWidth + delta;
      persistWidth(proposed);
    };
    const pointerUp = () => {
      resizingStateRef.current = null;
    };
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    return () => {
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
    };
  }, [isDesktop, persistWidth]);

  const handleResizerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDesktop) return;
      event.preventDefault();
      resizingStateRef.current = {
        startX: event.clientX,
        startWidth: panelWidth,
      };
    },
    [isDesktop, panelWidth],
  );

  useEffect(() => {
    const switchedToList = viewMode === 'list' && previousViewModeRef.current !== 'list';
    previousViewModeRef.current = viewMode;
    if (!switchedToList || !selectedNetworkId) return;

    const selectedButton = document.querySelector<HTMLElement>(`[data-net-id="${selectedNetworkId}"]`);
    if (selectedButton) {
      selectedButton.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    }
  }, [viewMode, selectedNetworkId]);

  const isListVisible = isDesktop || viewMode === 'list';

  return (
    <div
      className={`${styles.listSurface} ${styles.viewPane} ${
        isListVisible ? styles.viewPaneActive : styles.viewPaneHiddenRight
      }`}
      style={
        isDesktop
          ? { width: panelWidth, flex: `0 0 ${panelWidth}px`, maxWidth: '640px' }
          : undefined
      }
    >
      {isDesktop && <div className={styles.resizer} onPointerDown={handleResizerPointerDown} />}
      <div className={styles.listScroll} data-joinin-list-scroll>
        <div className={styles.listSheet}>
          <div className={styles.listHeader}>
            Here you can choose from any of the <b>{totalNetworks}</b> Litter Networks<br></br>across <b>{totalDistricts}</b> local-authority areas!
          </div>
          <div className={styles.districtList}>
            {groupedDistricts.map((group) => {
              const isOpen = expandedDistricts.has(group.id);
              const networkCount = group.networks.length;
              const networkVerb = networkCount === 1 ? 'is' : 'are';
              const networkLabel = networkCount === 1 ? 'Litter Network' : 'Litter Networks';
              return (
                <div
                  key={group.id}
                  data-district-id={group.id}
                  className={`${styles.districtCard} ${isOpen ? styles.districtCardOpen : ''}`}
                >
                  <button
                    type="button"
                    className={styles.districtToggle}
                    onClick={() => toggleDistrict(group.id)}
                    aria-expanded={isOpen}
                  >
                    <span className={styles.districtName}>{group.name}</span>
                    <span className={styles.districtMeta}>
                      <span className={styles.districtCount}>{group.networks.length}</span>
                      <img
                        src="/images/dropdown-icon.png"
                        alt=""
                        aria-hidden="true"
                        className={`${styles.districtDropdownIcon} ${
                          isOpen ? styles.districtDropdownIconOpen : ''
                        }`}
                      />
                    </span>
                  </button>
                  {isOpen && (
                    <ul className={styles.networkList}>
                      <li className={styles.districtIntro}>
                        <p>
                          There {networkVerb} <b>{networkCount}</b> {networkLabel} in {group.name}.
                        </p>
                      </li>
                      {group.networks
                        .slice()
                        .sort((a, b) => (a.fullName ?? a.uniqueId).localeCompare(b.fullName ?? b.uniqueId))
                        .map((net) => (
                          <li key={net.uniqueId}>
                            <button
                              type="button"
                              data-net-id={net.uniqueId}
                              className={`${styles.networkButton} ${
                                selectedNetworkId === net.uniqueId ? styles.networkButtonActive : ''
                              }`}
                              onClick={() => handleListSelect(net.uniqueId)}
                            >
                              <span className={styles.networkName}>{net.fullName ?? net.uniqueId}</span>
                              <span
                                className={`${styles.networkStatusRegion} ${
                                  net.uniqueId === selectedNetworkId ? styles.networkStatusSelected : ''
                                }`}
                                aria-hidden="true"
                              >
                                {net.uniqueId === selectedNetworkId ? '✓' : ''}
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
