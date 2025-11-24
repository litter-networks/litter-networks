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

/**
 * Renders the site header with section-aware styling, brand/filter menu trigger, and primary navigation.
 *
 * Renders a navigation bar whose colors adapt to the current section, a central FilterMenuTrigger for network
 * selection and search, and the main nav links. When the current section is "join-in", renders an additional
 * join-in submenu with Map, Stats, Reach Out, Resources, and an external Facebook link.
 *
 * @returns The header JSX element containing the navbar, brand/filter trigger, navigation links, and conditional join-in submenu.
 */
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

/**
 * Renders the header brand trigger that toggles and contains the FilterMenu.
 *
 * The trigger opens the FilterMenu on hover, toggles it via the dropdown arrow, and closes it when clicking outside.
 *
 * @param headerColorClass - CSS class applied to the menu for header color styling
 * @param searchColorClass - CSS class applied to the menu search input for search color styling
 * @returns The brand trigger element with the embedded FilterMenu
 */
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

/**
 * Render the filter dropdown used to search and switch between networks.
 *
 * Displays a search input, matching network results, nearby networks for the current network, and general links
 * (one of which preserves the current location to return to after navigation).
 *
 * @param open - Whether the menu is visible
 * @param onRequestClose - Callback invoked to request the menu be closed (e.g., when a link is clicked)
 * @param headerColorClass - CSS class applied to the menu that controls header-related coloring
 * @param searchColorClass - CSS class applied to the search input that controls search-related coloring
 * @returns The filter menu JSX element containing search results, nearby networks, and general navigation links
 */
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

/**
 * Selects the header color CSS class for a given site section.
 *
 * @param section - Site section identifier (for example `'news'`, `'knowledge'`, or other section names)
 * @returns The CSS module class name to apply to the header: `newsHeaderColor` for `'news'`, `knowledgeHeaderColor` for `'knowledge'`, and `joinInHeaderColor` for all other values
 */
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

/**
 * Selects the CSS class used for the header's search color based on the current section.
 *
 * @param section - Current section identifier returned by `getSectionFromPath` (e.g., `'news'`, `'knowledge'`, `'join-in'`).
 * @returns The CSS module class for the search color: `styles.newsHeaderSearchColor` for `'news'`, `styles.knowledgeHeaderSearchColor` for `'knowledge'`, and `styles.joinInHeaderSearchColor` otherwise.
 */
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

/**
 * Extracts the path portion after the first path segment.
 *
 * @param pathname - The full URL pathname (for example, "/network/item" or "/join-in").
 * @returns The suffix of `pathname` starting at the second segment (including the leading slash), or an empty string if `pathname` is empty or has no suffix.
 */
function getPathSuffix(pathname: string) {
  if (!pathname) {
    return '';
  }
  const suffix = pathname.replace(/^\/[^/]+/, '');
  return suffix === '/' ? '' : suffix;
}

export { getHeaderColorClass, getSearchColorClass, getPathSuffix };
