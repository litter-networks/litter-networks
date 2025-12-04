// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { Link, useLocation } from 'react-router-dom';
import { useNavData } from '@/features/nav/useNavData';
import { getSectionFromPath } from '@/shared/utils/sections';
import styles from './styles/footer.module.css';

/**
 * Render the site footer with Privacy and Terms links and styling that reflects the active section.
 *
 * @returns The footer element containing Privacy and Terms links, a divider, and the current year copyright
 */
export function Footer() {
  const { buildPath } = useNavData();
  const location = useLocation();
  const section = getSectionFromPath(location.pathname);
  const footerColorClass = getFooterColorClass(section);
  const year = new Date().getFullYear();

  return (
    <footer className={`${styles.footer} ${footerColorClass}`}>
      <div className={styles.container}>
        <Link to={buildPath('knowledge/our-organisation/documents/privacy')}>Privacy</Link>
        <span className={styles.divider}>|</span>
        <Link to={buildPath('knowledge/our-organisation/documents/terms')}>Terms</Link>
        <span className={styles.divider}>|</span>
        <span>© {year} Litter Networks</span>
      </div>
    </footer>
  );
}

/**
 * Selects the footer CSS class corresponding to the given site section.
 *
 * @param section - The site section (for example: `'news'`, `'knowledge'`, or other section identifiers)
 * @returns The CSS module class name for the footer: `styles.newsFooter` for `'news'`, `styles.knowledgeFooter` for `'knowledge'`, otherwise `styles.joinInFooter`
 */
function getFooterColorClass(section: ReturnType<typeof getSectionFromPath>) {
  switch (section) {
    case 'news':
      return styles.newsFooter;
    case 'knowledge':
      return styles.knowledgeFooter;
    default:
      return styles.joinInFooter;
  }
}
