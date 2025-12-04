// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { Link } from 'react-router-dom';
import type { KnowledgeChildPage } from '@/data-sources/knowledge';
import styles from '../styles/knowledge.module.css';

interface KnowledgeContentsProps {
  sections: KnowledgeChildPage[];
  filterString: string;
  loading: boolean;
}

/**
 * Render a list of knowledge sections and their child pages as navigable links.
 *
 * @param sections - Sections to render; each section may include `pageTitle`, optional `pageDescription`, `pageUrl`, and an optional `childPages` array with the same fields.
 * @param filterString - Segment inserted into generated link paths to scope the destination (used when building each item's URL).
 * @param loading - If `true`, render a loading notice instead of the sections.
 * @returns A React element containing the rendered knowledge contents, a loading notice when `loading` is `true`, or `null` when `sections` is empty.
 */
export function KnowledgeContents({ sections, filterString, loading }: KnowledgeContentsProps) {
  if (loading) {
    return (
      <div className={styles.loadingNotice}>
        <div className={styles.spinner} />
        <p>Loading contents…</p>
      </div>
    );
  }

  if (!sections.length) {
    return null;
  }

  return (
    <div className={styles.contentsWrapper}>
      {sections.map((section) => {
        const hasChildren = Boolean(section.childPages?.length);
        const target = buildKnowledgeLink(filterString, section.pageUrl);
        return (
          <div className={styles.contentsMajorEntry} key={section.pageUrl}>
            <Link className={styles.knowledgeLink} to={target}>
              <div className={`${styles.majorEntryHeader} ${!hasChildren ? styles.majorEntryHeaderNoChild : ''}`}>
                <div className={styles.majorEntryBlock}>
                  <div className={styles.majorEntryTitle}>{section.pageTitle}</div>
                  {section.pageDescription && (
                    <div className={styles.majorEntryDescription}>{section.pageDescription}</div>
                  )}
                </div>
              </div>
            </Link>
            {hasChildren && (
              <div className={styles.contentsMinorContainer}>
                {section.childPages!.map((child) => (
                  <Link
                    className={styles.knowledgeLink}
                    key={child.pageUrl}
                    to={buildKnowledgeLink(filterString, child.pageUrl)}
                  >
                    <div className={styles.contentsMinorEntry}>
                      <div className={styles.minorEntryHeader}>
                        <span>{child.pageTitle}</span>
                      </div>
                      <p>{child.pageDescription}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Build a normalized route path for a knowledge page using the given filter segment.
 *
 * @param filterString - Path segment representing the active filter or category
 * @param pageUrl - Page path or URL for the target page; a leading slash will be ignored
 * @returns A normalized path string in the form `/{filter}/{page}` with consecutive slashes collapsed
 */
function buildKnowledgeLink(filterString: string, pageUrl: string) {
  const normalized = pageUrl.startsWith('/') ? pageUrl.slice(1) : pageUrl;
  return `/${filterString}/${normalized}`.replace(/\/+/g, '/');
}
