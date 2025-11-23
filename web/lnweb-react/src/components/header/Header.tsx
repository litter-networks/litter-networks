import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNavData } from '@/features/nav/NavDataContext';
import { getSectionFromPath } from '@/shared/sections';
import styles from './styles/header.module.css';

const navLinks = [
  { label: 'Welcome', path: '' },
  { label: 'Join In', path: 'join-in' },
  { label: 'News', path: 'news' },
  { label: 'Knowledge', path: 'knowledge' },
];

export function Header() {
  const { buildPath, facebookLink } = useNavData();
  const location = useLocation();
  const sectionName = getSectionFromPath(location.pathname);
  const headerColorClass = getHeaderColorClass(sectionName);
  const searchColorClass = getSearchColorClass(sectionName);
  const returnPathState = useMemo(
    () => ({ returnPath: `${location.pathname}${location.search}${location.hash}` }),
    [location.pathname, location.search, location.hash],
  );

  const navItemsMarkup = navLinks.map((item) => {
    const href = buildPath(item.path);
    const isActive = sectionName === getSectionFromPath(href);
    return (
      <li key={item.label} className={styles.navListItem}>
        <Link to={href} className={`${styles.navItemLink} ${isActive ? styles.navItemCurrent : ''}`}>
          {item.label}
        </Link>
      </li>
    );
  });

  return (
    <header className={styles.header}>
      <nav className={`${styles.navbar} ${headerColorClass}`}>
        <div className={styles.navbarQuote}>
          <ul className={styles.quoteList}>
            <li>“ If we each did our little bit...”</li>
          </ul>
        </div>

        <div className={styles.navbarCenter}>
          <FilterMenuTrigger headerColorClass={headerColorClass} searchColorClass={searchColorClass} />
        </div>

        <div className={styles.navbarRight}>
          <ul className={styles.navList}>{navItemsMarkup}</ul>
        </div>
      </nav>

      {sectionName === 'join-in' && (
        <div className={styles.joinInSubMenu} id="question-options">
          <ul className={styles.joinInSubMenuList}>
            <li>
              <Link
                to={buildPath('join-in/choose')}
                state={returnPathState}
                className={`${styles.navItemLink} ${
                  location.pathname.includes('/join-in/choose') ? styles.navItemCurrent : ''
                }`}
              >
                Map
              </Link>
            </li>
            <li>
              <Link
                to={buildPath('join-in/stats')}
                className={`${styles.navItemLink} ${
                  location.pathname.includes('/join-in/stats') ? styles.navItemCurrent : ''
                }`}
              >
                Stats
              </Link>
            </li>
            <li>
              <Link
                to={buildPath('join-in')}
                className={`${styles.navItemLink} ${
                  location.pathname.endsWith('/join-in') ? styles.navItemCurrent : ''
                }`}
              >
                Reach Out
              </Link>
            </li>
            <li>
              <Link
                to={buildPath('join-in/resources')}
                className={`${styles.navItemLink} ${
                  location.pathname.includes('/join-in/resources') ? styles.navItemCurrent : ''
                }`}
              >
                Resources
              </Link>
            </li>
            <li>
              <a
                href={facebookLink}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnSubMenuJoinIn}
              >
                <img
                  className={styles.externalLinkIcon}
                  src="https://cdn.litternetworks.org/images/icon-external-link.svg"
                  alt="External Link Icon"
                />
                <img
                  className={styles.facebookIcon}
                  src="https://cdn.litternetworks.org/images/facebook-logo.svg"
                  alt="Facebook"
                />
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

function FilterMenuTrigger({
  headerColorClass,
  searchColorClass,
}: {
  headerColorClass: string;
  searchColorClass: string;
}) {
  const { buildPath, displayName } = useNavData();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!triggerRef.current || triggerRef.current.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const brandClassName = `${styles.navbarBrand} ${open ? styles.navbarBrandOpen : ''}`.trim();

  return (
    <div
      className={brandClassName}
      tabIndex={0}
      ref={triggerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link className={styles.navbarBrandLink} to={buildPath('')}>
        <img className={styles.navbarBrandLogo} src="/brand/logo-only.svg" alt="Litter Networks logo" />
        <ul className={styles.brandList}>
          <li>{displayName}</li>
        </ul>
        <img
          className={`${styles.dropdownArrow} ${open ? styles.dropdownArrowOpen : ''}`}
          src="/images/dropdown-icon.png"
          alt="Toggle menu"
          onClick={(event) => {
            event.preventDefault();
            setOpen((state) => !state);
          }}
        />
      </Link>
      <FilterMenu
        open={open}
        onRequestClose={() => setOpen(false)}
        headerColorClass={headerColorClass}
        searchColorClass={searchColorClass}
      />
    </div>
  );
}

function FilterMenu({
  open,
  onRequestClose,
  headerColorClass,
  searchColorClass,
}: {
  open: boolean;
  onRequestClose: () => void;
  headerColorClass: string;
  searchColorClass: string;
}) {
  const { networks, network, buildPath, nearbyNetworks } = useNavData();
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
      setSearchTerm('');
    }
  }, [open]);

  const generalLinks: Array<{ label: string; to: string; preserveReturnPath?: boolean }> = [
    { label: 'Litter Networks', to: '/all' },
    { label: 'CHOOSE YOUR NETWORK', to: buildPath('join-in/choose'), preserveReturnPath: true },
  ];

  const hasResults = trimmedTerm.length > 0 && filteredNetworks.length > 0;

  return (
    <ul className={`${styles.filterMenu} ${open ? styles.filterMenuOpen : ''} ${headerColorClass}`}>
      <li className={styles.filterSearch}>
        <input
          type="text"
          className={`${styles.filterSearchInput} ${searchColorClass}`}
          placeholder="Search networks..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </li>
      <li>
        <span className={`${styles.menuLabel} ${!hasResults ? styles.hidden : ''}`}>search results:</span>
      </li>
      {filteredNetworks.map((item) => (
        <li key={item.uniqueId}>
          <Link to={buildNetworkSwitchPath(item.uniqueId)} className={styles.menuItemLink} onClick={onRequestClose}>
            <img className={styles.navbarBrandLogo} src="/brand/logo-only.svg" alt="Litter Networks logo" />
            {item.fullName ?? item.uniqueId}
          </Link>
        </li>
      ))}
      {network && nearbyNetworks.length > 0 && (
        <>
          <li>
            <span className={styles.menuLabel}>nearby:</span>
          </li>
          {nearbyNetworks.map((nearby) => (
            <li key={`${network.uniqueId}-${nearby.uniqueId}`}>
              <Link
                to={buildNetworkSwitchPath(nearby.uniqueId)}
                className={styles.menuItemLink}
                onClick={onRequestClose}
              >
                <img className={styles.navbarBrandLogo} src="/brand/logo-only.svg" alt="Litter Networks logo" />
                {nearby.fullName ?? nearby.uniqueId}
                {nearby.roundedDistance != null ? ` (${nearby.roundedDistance} miles)` : ''}
              </Link>
            </li>
          ))}
        </>
      )}
      <li>
        <span className={styles.menuLabel}>general:</span>
      </li>
      {generalLinks.map((link) => (
        <li key={link.label}>
          <Link
            to={link.to}
            state={link.preserveReturnPath ? returnPathState : undefined}
            className={styles.menuItemLink}
            onClick={onRequestClose}
          >
            <img className={styles.navbarBrandLogo} src="/brand/logo-only.svg" alt="Litter Networks logo" />
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function getHeaderColorClass(section: ReturnType<typeof getSectionFromPath>) {
  switch (section) {
    case 'news':
      return styles.newsHeaderColor;
    case 'knowledge':
      return styles.knowledgeHeaderColor;
    default:
      return styles.joinInHeaderColor;
  }
}

function getSearchColorClass(section: ReturnType<typeof getSectionFromPath>) {
  switch (section) {
    case 'news':
      return styles.newsHeaderSearchColor;
    case 'knowledge':
      return styles.knowledgeHeaderSearchColor;
    default:
      return styles.joinInHeaderSearchColor;
  }
}

function getPathSuffix(pathname: string) {
  if (!pathname) {
    return '';
  }
  const suffix = pathname.replace(/^\/[^/]+/, '');
  return suffix === '/' ? '' : suffix;
}
