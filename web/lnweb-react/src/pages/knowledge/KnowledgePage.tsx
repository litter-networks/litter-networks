// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchKnowledgeChildPages, fetchKnowledgePage, type KnowledgeChildPage } from '@/data-sources/knowledge';
import { usePageTitle } from '@/shared/hooks/usePageTitle';
import { KnowledgeContents } from './components/KnowledgeContents';
import { getKnowledgePath, sanitizeKnowledgeHtml, updateInternalLinks, getKnowledgeCssPath } from './knowledge-helpers';
import styles from './styles/knowledge.module.css';

const CONTENT_PLACEHOLDER = '{{knowledge-base-contents}}';

interface HtmlBlock {
  type: 'html' | 'contents';
  html?: string;
}

interface Metadata {
  title: string;
  description: string;
}

interface Breadcrumb {
  title: string;
  url?: string;
}

/**
 * Render the knowledge article page with breadcrumbs, title/description, sanitized HTML content blocks, and optional contents sections.
 *
 * The component loads the requested knowledge page and, when applicable, its child sections; it manages loading and error states and updates the document title from the page metadata.
 *
 * @returns A JSX element representing the knowledge page
 */
export function KnowledgePage() {
  const params = useParams<{ filterString?: string; '*': string }>();
  const filterString = params.filterString ?? 'all';
  const wildcard = params['*'] ?? '';
  const knowledgePath = getKnowledgePath(wildcard);

  const [blocks, setBlocks] = useState<HtmlBlock[]>([]);
  const [childSections, setChildSections] = useState<KnowledgeChildPage[]>([]);
  const [metadata, setMetadata] = useState<Metadata>({ title: 'Knowledge', description: '' });
  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingContents, setLoadingContents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePageTitle(metadata.title || 'Knowledge');

  const breadcrumbs = useMemo(() => buildBreadcrumbs(filterString, knowledgePath), [filterString, knowledgePath]);

  useEffect(() => {
    const cssPath = getKnowledgeCssPath(knowledgePath);
    let linkEl: HTMLLinkElement | null = null;

    if (cssPath) {
      linkEl = document.createElement('link');
      linkEl.rel = 'stylesheet';
      linkEl.href = cssPath;
      linkEl.dataset.source = 'knowledge-css';
      document.head.appendChild(linkEl);
    }

    return () => {
      if (linkEl?.parentNode) {
        linkEl.parentNode.removeChild(linkEl);
      }
    };
  }, [knowledgePath]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoadingPage(true);
      setError(null);
      setBlocks([]);
      setChildSections([]);
      try {
        const pageData = await fetchKnowledgePage(knowledgePath, controller.signal);
        if (cancelled) {
          return;
        }

        const processedHtml = updateInternalLinks(pageData.bodyContent, `/${filterString}`);
        const segments = processedHtml.split(CONTENT_PLACEHOLDER);

        const computedBlocks: HtmlBlock[] = [];
        segments.forEach((segment, index) => {
          if (segment.trim()) {
            computedBlocks.push({ type: 'html', html: segment });
          }
          if (index < segments.length - 1) {
            computedBlocks.push({ type: 'contents' });
          }
        });

        setBlocks(computedBlocks.length ? computedBlocks : [{ type: 'html', html: processedHtml }]);
        setMetadata(pageData.metadata);
        setLoadingPage(false);

        if (segments.length > 1) {
          setLoadingContents(true);
          try {
            const sections = await fetchKnowledgeChildPages(knowledgePath, controller.signal);
            if (!cancelled) {
              setChildSections(sections);
            }
          } catch (childError) {
            if (!controller.signal.aborted && !cancelled) {
              console.error('Failed to load knowledge contents', childError);
            }
          } finally {
            if (!cancelled) {
              setLoadingContents(false);
            }
          }
        }
      } catch (err) {
        if (!controller.signal.aborted && !cancelled) {
          console.error('Failed to load knowledge page', err);
          setError('Unable to load this knowledge article right now.');
          setLoadingPage(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [knowledgePath, filterString]);

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState}>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.knowledgeMain}>
        <div className={styles.knowledgeHierarchy}>
          {breadcrumbs.map((crumb, index) =>
            crumb.url ? (
              <span key={crumb.url}>
                <Link to={crumb.url}>{crumb.title}</Link>
                {index < breadcrumbs.length - 1 ? ' | ' : ''}
              </span>
            ) : (
              <b key={crumb.title}>{crumb.title}</b>
            ),
          )}
        </div>

        <h1 className={styles.knowledgeTitle}>{metadata.title}</h1>
        {metadata.description && <p className={styles.knowledgeSubtitle}>{metadata.description}</p>}

        {loadingPage && !blocks.length ? (
          <div className={styles.loadingNotice}>
            <div className={styles.spinner} />
            <p>Loading knowledge content…</p>
          </div>
        ) : (
          blocks.map((block, index) =>
            block.type === 'html' ? (
              renderHtmlBlock(block.html, `/${filterString}`, index)
            ) : (
              <KnowledgeContents
                key={`contents-${index}`}
                sections={childSections}
                filterString={filterString}
                loading={loadingContents}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

/**
 * Render a sanitized HTML block or a fallback when content is unavailable.
 *
 * @param html - Raw HTML content to render; may be undefined.
 * @param linkBase - Base path used to rewrite internal links prior to sanitization.
 * @param index - Zero-based index used to generate a stable element key.
 * @returns A React element containing the sanitized HTML or a fallback message when sanitization yields no safe content.
 */
function renderHtmlBlock(html: string | undefined, linkBase: string, index: number) {
  const safeHtml = sanitizeKnowledgeHtml(html, linkBase);
  if (!safeHtml) {
    return null;
  }

  return (
    <div
      key={`html-${index}`}
      className={styles.htmlBlock}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

/**
 * Create breadcrumb entries from a knowledge path, producing a title for each segment and a URL for all but the last.
 *
 * @param filterString - Route prefix to use when constructing breadcrumb URLs (e.g., a filter or base route segment)
 * @param knowledgePath - Slash-separated knowledge path (may include leading/trailing slashes) whose segments become breadcrumb items
 * @returns An array of Breadcrumb objects; each has a `title`, and all except the final breadcrumb include a `url`
 */
function buildBreadcrumbs(filterString: string, knowledgePath: string): Breadcrumb[] {
  const segments = knowledgePath.split('/').filter(Boolean);
  const crumbs: Breadcrumb[] = [];
  segments.forEach((segment, index) => {
    const url =
      index === segments.length - 1
        ? undefined
        : `/${filterString}/${segments.slice(0, index + 1).join('/')}`.replace(/\/+/g, '/');
    const title =
      index === 0 ? 'Knowledge' : segment.toLowerCase() === 'faqs' ? 'FAQs' : toTitleCase(segment);
    crumbs.push({ title, url });
  });
  return crumbs;
}

/**
 * Convert a hyphen-separated string to Title Case and join segments with spaces.
 *
 * @param value - The input string with hyphen-separated words (e.g., "node-js-faqs")
 * @returns The input transformed to Title Case with spaces between words (e.g., "Node Js Faqs")
 */
function toTitleCase(value: string) {
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
