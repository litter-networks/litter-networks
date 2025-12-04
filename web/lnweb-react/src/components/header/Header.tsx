// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNavData } from '@/features/nav/useNavData';
import { NetworkSwitcher } from '@/components/network-switcher/NetworkSwitcher';
import { getSectionFromPath, type SiteSection } from '@/shared/utils/sections';
import { loadSectionHistory, writeLastSectionPath } from '@/shared/navigation/sectionHistory';
import { getHeaderColorClass, getSearchColorClass } from './header-helpers';
import styles from './styles/header.module.css';

type NavLinkConfig = {
  label: string;
  section: SiteSection;
  defaultPath: string;
};

const navLinks: NavLinkConfig[] = [
  { label: 'Welcome', section: 'welcome', defaultPath: '' },
  { label: 'Join In', section: 'join-in', defaultPath: 'join-in' },
  { label: 'News', section: 'news', defaultPath: 'news' },
  { label: 'Knowledge', section: 'knowledge', defaultPath: 'knowledge' },
];

const DEFAULT_THEME_COLOR = '#FFFFFF';
const themeColorVarMap: Record<string, string> = {
  [styles.joinInHeaderColor]: '--join-in-color-active',
  [styles.newsHeaderColor]: '--news-color',
  [styles.knowledgeHeaderColor]: '--info-color-active',
};

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
  const { buildPath, facebookLink, network, filterString } = useNavData();
  const location = useLocation();
  const sectionName = getSectionFromPath(location.pathname);
  const headerColorClass = getHeaderColorClass(sectionName);
  const searchColorClass = getSearchColorClass(sectionName);
  const returnPathState = useMemo(
    () => ({ returnPath: `${location.pathname}${location.search}${location.hash}` }),
    [location.pathname, location.search, location.hash],
  );
  const storedHistory = loadSectionHistory();
  const normalizedSectionPath = useMemo(
    () => stripFilterFromPath(location.pathname, filterString).replace(/^\/+/, ''),
    [filterString, location.pathname],
  );
  const previousPathForSection = storedHistory[sectionName];
  const sectionHistory: Partial<Record<SiteSection, string>> = {
    ...storedHistory,
    [sectionName]: normalizedSectionPath,
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !filterString) {
      return;
    }
    if (previousPathForSection === normalizedSectionPath) {
      return;
    }
    writeLastSectionPath(sectionName, normalizedSectionPath);
  }, [filterString, normalizedSectionPath, previousPathForSection, sectionName]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      return;
    }
    const cssVar = themeColorVarMap[headerColorClass] ?? '--join-in-color-active';
    const computed = getComputedStyle(document.documentElement).getPropertyValue(cssVar)?.trim();
    const color = computed || DEFAULT_THEME_COLOR;
    metaTheme.setAttribute('content', color);
  }, [headerColorClass]);

  const navItemsMarkup = navLinks.map((item) => {
    const storedTarget = sectionHistory[item.section];
    const targetSegment = storedTarget ?? item.defaultPath;
    const href = buildPath(targetSegment);
    const isActive = sectionName === item.section;
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
        <div className={styles.navbarContent}>
          <div className={styles.navbarQuote}>
            <ul className={styles.quoteList}>
              <li>“ If we each did our little bit...”</li>
            </ul>
          </div>

          <div className={styles.navbarCenter}>
            <NetworkSwitcher headerColorClass={headerColorClass} searchColorClass={searchColorClass} />
          </div>

          <div className={styles.navbarRight}>
            <ul className={styles.navList}>{navItemsMarkup}</ul>
          </div>
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
                Choose
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
                {network ? 'Local Info' : 'Reach Out'}
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
                <img
                  className={styles.facebookIconSmall}
                  src="/images/facebook-logo-small.svg"
                  alt=""
                  aria-hidden="true"
                />
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

function stripFilterFromPath(pathname: string, filterString?: string) {
  const trimmed = pathname.replace(/^\/+/, '');
  if (!filterString) {
    return trimmed;
  }
  const normalizedFilter = filterString.replace(/^\/+|\/+$/g, '');
  if (!normalizedFilter) {
    return trimmed;
  }
  const trimmedLower = trimmed.toLowerCase();
  const filterLower = normalizedFilter.toLowerCase();
  if (trimmedLower === filterLower) {
    return '';
  }
  if (trimmedLower.startsWith(`${filterLower}/`)) {
    return trimmed.substring(normalizedFilter.length + 1);
  }
  return trimmed;
}
