import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNavData } from '@/features/nav/useNavData';
import { getPathSuffix } from '@/components/header/header-helpers';
import styles from './styles/networkSwitcher.module.css';

type Props = {
  open: boolean;
  onRequestClose: () => void;
  headerColorClass: string;
  searchColorClass: string;
};

/**
 * Dropdown menu for network search, favourites, recents, nearby, and general links.
 */
export function NetworkSwitcherMenu({ open, onRequestClose, headerColorClass, searchColorClass }: Props) {
  const {
    networks,
    network,
    buildPath,
    nearbyNetworks,
    recentNetworks,
    favoriteNetworks,
    toggleFavorite,
    isFavorite,
  } = useNavData();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const trimmedTerm = searchTerm.trim().toLowerCase();
  const returnPathState = useMemo(
    () => ({ returnPath: `${location.pathname}${location.search}${location.hash}` }),
    [location.pathname, location.search, location.hash],
  );
  const pathSuffix = getPathSuffix(location.pathname);
  const buildNetworkSwitchPath = useCallback(
    (targetId: string) => {
      if (pathSuffix) {
        return `/${targetId}${pathSuffix}`.replace(/\/+/g, '/');
      }
      return `/${targetId}`;
    },
    [pathSuffix],
  );

  const filteredNetworks = useMemo(() => {
    if (!trimmedTerm) {
      return [];
    }

    const hasThree = trimmedTerm.length >= 3;

    return networks.filter((item) => {
      const fullName = (item.fullName ?? item.uniqueId ?? '').toLowerCase();
      if (!fullName) {
        return false;
      }
      if (hasThree) {
        return fullName.includes(trimmedTerm);
      }
      return fullName.length <= 3 && fullName === trimmedTerm;
    });
  }, [networks, trimmedTerm]);

  useEffect(() => {
    if (!open) {
      return;
    }
    return () => {
      setSearchTerm('');
    };
  }, [open]);

  const generalLinks: Array<{ label: string; to: string; preserveReturnPath?: boolean }> = [
    { label: 'Litter Networks', to: '/all' },
    { label: 'CHOOSE YOUR NETWORK', to: buildPath('join-in/choose'), preserveReturnPath: true },
  ];

  const hasResults = trimmedTerm.length > 0 && filteredNetworks.length > 0;

  const renderNetworkItem = (item: { uniqueId: string; fullName?: string }, keyPrefix?: string) => (
    <li key={`${keyPrefix ?? 'net'}-${item.uniqueId}`} className={styles.networkSwitcherItem}>
      <Link
        to={buildNetworkSwitchPath(item.uniqueId)}
        className={styles.networkSwitcherItemLink}
        onClick={onRequestClose}
      >
        <img className={styles.networkSwitcherLogo} src="/brand/logo-only.svg" alt="Litter Networks logo" />
        <span className={styles.networkSwitcherItemText}>{item.fullName ?? item.uniqueId}</span>
      </Link>
      <button
        type="button"
        className={`${styles.networkSwitcherFavButton} ${
          isFavorite(item.uniqueId) ? styles.networkSwitcherFavButtonActive : ''
        }`}
        aria-label={isFavorite(item.uniqueId) ? 'Remove from favourites' : 'Add to favourites'}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleFavorite(item.uniqueId);
        }}
      >
        {isFavorite(item.uniqueId) ? '★' : '☆'}
      </button>
    </li>
  );

  return (
    <ul
      className={`${styles.networkSwitcherMenu} ${
        open ? styles.networkSwitcherMenuOpen : ''
      } ${headerColorClass}`}
    >
      <li className={styles.networkSwitcherSearch}>
        <input
          type="text"
          className={`${styles.networkSwitcherSearchInput} ${searchColorClass}`}
          placeholder="Search networks..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </li>
      <li>
        <span
          className={`${styles.networkSwitcherSectionLabel} ${!hasResults ? styles.networkSwitcherHidden : ''}`}
        >
          search results:
        </span>
      </li>
      {filteredNetworks.map((item) => renderNetworkItem(item, 'search'))}
      {favoriteNetworks.length > 0 && (
        <>
          <li>
            <span className={styles.networkSwitcherSectionLabel}>favourites:</span>
          </li>
          {favoriteNetworks.map((item) => renderNetworkItem(item, 'fav'))}
        </>
      )}
      {recentNetworks.length > 0 && (
        <>
          <li>
            <span className={styles.networkSwitcherSectionLabel}>recent:</span>
          </li>
          {recentNetworks.map((item) => renderNetworkItem(item, 'recent'))}
        </>
      )}
      {network && nearbyNetworks.length > 0 && (
        <>
          <li>
            <span className={styles.networkSwitcherSectionLabel}>nearby:</span>
          </li>
          {nearbyNetworks.map((nearby) =>
            renderNetworkItem({ uniqueId: nearby.uniqueId, fullName: nearby.fullName }, 'nearby'),
          )}
        </>
      )}
      <li>
        <span className={styles.networkSwitcherSectionLabel}>general:</span>
      </li>
      {generalLinks.map((link) => (
        <li key={link.label} className={styles.networkSwitcherItem}>
          <Link
            to={link.to}
            state={link.preserveReturnPath ? returnPathState : undefined}
            className={styles.networkSwitcherItemLink}
            onClick={onRequestClose}
          >
            <img className={styles.networkSwitcherLogo} src="/brand/logo-only.svg" alt="Litter Networks logo" />
            <span className={styles.networkSwitcherItemText}>{link.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
