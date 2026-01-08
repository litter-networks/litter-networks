// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchKnowledgeChildPages, fetchKnowledgePage, type KnowledgeChildPage } from '@/data-sources/knowledge';
import { usePageTitle } from '@/shared/hooks/usePageTitle';
import { KnowledgeContents } from './components/KnowledgeContents';
import { getKnowledgePath, sanitizeKnowledgeHtml, updateInternalLinks, getKnowledgeCssPath } from './knowledge-helpers';
import styles from './styles/knowledge.module.css';

const CONTENT_PLACEHOLDER = '{{knowledge-base-contents}}';

interface HtmlBlock {
  type: 'html' | 'contents' | 'link-block';
  html?: string;
  linkBlock?: LinkBlock;
}

interface LinkBlock {
  href: string;
  title: string;
  body?: string;
  image?: string;
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
        const computedBlocks = parseKnowledgeBlocks(processedHtml);
        setBlocks(computedBlocks);
        setMetadata(pageData.metadata);
        setLoadingPage(false);

        if (computedBlocks.some((block) => block.type === 'contents')) {
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
          blocks.map((block, index) => {
            if (block.type === 'html') {
              return renderHtmlBlock(block.html, `/${filterString}`, index);
            }
            if (block.type === 'contents') {
              return (
                <KnowledgeContents
                  key={`contents-${index}`}
                  sections={childSections}
                  filterString={filterString}
                  loading={loadingContents}
                />
              );
            }
            return renderLinkBlock(block.linkBlock, filterString, index);
          })
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

function renderLinkBlock(linkBlock: LinkBlock | undefined, filterString: string, index: number) {
  if (!linkBlock) {
    return null;
  }
  const { href, title, body, image } = linkBlock;
  const resolvedHref = resolveLinkHref(href, filterString);
  const isExternal = /^https?:\/\//i.test(resolvedHref);
  const style = getLinkBlockStyle(href, isExternal, filterString);

  const header = (
    <div className={`${styles.majorEntryHeader} ${styles.majorEntryHeaderNoChild}`}>
      <div className={styles.majorEntryTitle}>
        <span>{title}</span>
        {isExternal && (
          <img src="/icons/icon-external-link.svg" className={styles.externalLinkIcon} alt="External link" />
        )}
      </div>
      {body && <div className={styles.majorEntryDescription}>{body}</div>}
    </div>
  );

  return (
    <div className={styles.contentsWrapper} style={style} key={`link-block-${index}`}>
      <div className={styles.contentsMajorEntry}>
        {isExternal ? (
          <a className={styles.knowledgeLink} href={resolvedHref} target="_blank" rel="noopener noreferrer">
            {header}
          </a>
        ) : (
          <Link className={styles.knowledgeLink} to={resolvedHref}>
            {header}
          </Link>
        )}
        {image && (
          <div className={styles.linkBlockBody}>
            <img src={image} alt="" className={styles.linkBlockImage} loading="lazy" />
          </div>
        )}
      </div>
    </div>
  );
}

function getLinkBlockStyle(href: string, isExternal: boolean, filterString: string): CSSProperties | undefined {
  if (isExternal) {
    return {
      '--info-color': 'var(--join-in-color)',
      '--info-color-active': 'var(--join-in-color-active)',
      '--info-color-hover': 'var(--join-in-color-hover)',
    } as CSSProperties;
  }

  const normalizedHref = normalizeInternalHref(href, filterString);
  if (normalizedHref.includes('/join-in')) {
    return {
      '--info-color': 'var(--join-in-color)',
      '--info-color-active': 'var(--join-in-color-active)',
      '--info-color-hover': 'var(--join-in-color-hover)',
    } as CSSProperties;
  }
  if (normalizedHref.includes('/news')) {
    return {
      '--info-color': 'var(--news-color)',
      '--info-color-active': 'var(--news-color-active)',
      '--info-color-hover': 'var(--news-color-hover)',
    } as CSSProperties;
  }

  return undefined;
}

function resolveLinkHref(href: string, filterString: string): string {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }
  const normalized = href.replace(/^\/+/, '');
  if (normalized.startsWith(`${filterString}/`)) {
    return `/${normalized}`.replace(/\/+/g, '/');
  }
  return `/${filterString}/${normalized}`.replace(/\/+/g, '/');
}

function normalizeInternalHref(href: string, filterString: string): string {
  const normalized = href.replace(/^\/+/, '');
  if (normalized.startsWith(`${filterString}/`)) {
    return `/${normalized.slice(filterString.length + 1)}`.toLowerCase();
  }
  return `/${normalized}`.toLowerCase();
}

function parseKnowledgeBlocks(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = [];
  const tokenRegex = /{{knowledge-base-contents}}|{{link-block\s+([^}]*)}}/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(html)) !== null) {
    const segment = html.slice(lastIndex, match.index);
    if (segment.trim()) {
      blocks.push({ type: 'html', html: segment });
    }

    if (match[0].toLowerCase().startsWith(CONTENT_PLACEHOLDER)) {
      blocks.push({ type: 'contents' });
    } else {
      const rawAttributes = decodeHtmlEntities(match[1] ?? '');
      const linkBlock = parseLinkBlockAttributes(rawAttributes);
      if (linkBlock) {
        blocks.push({ type: 'link-block', linkBlock });
      }
    }

    lastIndex = tokenRegex.lastIndex;
  }

  const tail = html.slice(lastIndex);
  if (tail.trim()) {
    blocks.push({ type: 'html', html: tail });
  }

  if (!blocks.length) {
    return [{ type: 'html', html }];
  }

  return blocks;
}

function parseLinkBlockAttributes(raw: string): LinkBlock | undefined {
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(raw)) !== null) {
    attrs[match[1].toLowerCase()] = match[2];
  }

  const href = attrs.href || attrs.url;
  const title = attrs.title || attrs.label;
  if (!href || !title) {
    return undefined;
  }

  return {
    href,
    title,
    body: attrs.body || attrs.text || attrs.description,
    image: attrs.image,
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
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
