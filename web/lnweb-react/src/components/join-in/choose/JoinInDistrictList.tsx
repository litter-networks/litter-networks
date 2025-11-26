import type { DistrictGroup } from '@/pages/join-in/choose-types';
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
  if (viewMode !== 'list') return null;
  return (
    <div className={styles.listSurface}>
      <div className={styles.listSheet}>
        <div className={styles.listHeader}>
          Here you can choose any one of the <b>{totalNetworks}</b> Litter Networks across <b>{totalDistricts}</b> local-authority areas!
        </div>
        <div className={styles.districtList}>
          {groupedDistricts.map((group) => {
            const isOpen = expandedDistricts.has(group.id);
            const networkCount = group.networks.length;
            const networkVerb = networkCount === 1 ? 'is' : 'are';
            const networkLabel = networkCount === 1 ? 'Litter Network' : 'Litter Networks';
            return (
              <div key={group.id} className={`${styles.districtCard} ${isOpen ? styles.districtCardOpen : ''}`}>
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
                        There {networkVerb} currently <b>{networkCount}</b> {networkLabel} in {group.name}.
                      </p>
                    </li>
                    {group.networks
                      .slice()
                      .sort((a, b) => (a.fullName ?? a.uniqueId).localeCompare(b.fullName ?? b.uniqueId))
                      .map((net) => (
                        <li key={net.uniqueId}>
                          <button
                            type="button"
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
  );
}
