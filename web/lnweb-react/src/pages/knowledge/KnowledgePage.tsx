import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchKnowledgeChildPages, fetchKnowledgePage, type KnowledgeChildPage } from '@/data-sources/knowledge';
import { usePageTitle } from '@/shared/usePageTitle';
import { KnowledgeContents } from './components/KnowledgeContents';
import DOMPurify from 'dompurify';
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

function getKnowledgePath(wildcard: string) {
  const trimmed = wildcard.replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return 'knowledge';
  }
  return trimmed.startsWith('knowledge') ? trimmed : `knowledge/${trimmed}`;
}

function updateInternalLinks(html: string, base: string) {
  return html.replace(/href="(\/[^"]*)"/g, (match, url) => {
    if (!url.startsWith('/') || url.startsWith(base) || url.startsWith('//') || /^https?:\/\//.test(url)) {
      return match;
    }
    const normalized = `${base}${url}`.replace(/\/+/g, '/');
    return `href="${normalized}"`;
  });
}

const SAFE_IFRAME_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com']);

const SANITIZE_CONFIG: import('dompurify').Config = {
  ALLOWED_TAGS: [
    'a',
    'b',
    'blockquote',
    'br',
    'caption',
    'code',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'i',
    'img',
    'iframe',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'span',
    'small',
    'sub',
    'sup',
    'summary',
    'details',
    'u',
    'ul',
    'table',
    'tbody',
    'td',
    'th',
    'tr',
    'dl',
    'dt',
    'dd',
  ],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'title',
    'class',
    'id',
    'src',
    'alt',
    'style',
    'width',
    'height',
    'role',
    'aria-label',
    'allow',
    'allowfullscreen',
    'frameborder',
  ],
  FORBID_TAGS: ['script'],
  ALLOW_DATA_ATTR: false,
  RETURN_TRUSTED_TYPE: false,
};

function renderHtmlBlock(html: string | undefined, linkBase: string, index: number) {
  const safeHtml = sanitizeKnowledgeHtml(html, linkBase);
  if (!safeHtml) {
    return (
      <div key={`html-${index}`} className={styles.blockFallback}>
        <p>Content unavailable.</p>
      </div>
    );
  }

  return (
    <div
      key={`html-${index}`}
      className={styles.htmlBlock}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

function sanitizeKnowledgeHtml(html: string | undefined, linkBase: string) {
  if (!html) {
    return '';
  }

  const updatedLinks = updateInternalLinks(html, linkBase);
  // This project renders exclusively on the client (no SSR). The DOMPurify instance requires
  // real browser globals, so when the guard triggers (e.g. unit tests or tooling that evaluates
  // modules without a DOM) we skip sanitisation only because the HTML will never be injected in
  // that environment. If SSR support is added, replace this early return with a server-side DOM
  // implementation such as jsdom so the content remains sanitised.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return updatedLinks;
  }

  const sanitizedRaw = DOMPurify.sanitize(updatedLinks, SANITIZE_CONFIG);
  const sanitized = typeof sanitizedRaw === 'string' ? sanitizedRaw : '';
  if (!sanitized.trim()) {
    return '';
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = sanitized;
  wrapper.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!isSafeHref(href)) {
      anchor.removeAttribute('href');
      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
      return;
    }
    const normalized = href!.trim();
    anchor.setAttribute('href', normalized);
    if (!anchor.hasAttribute('rel')) {
      anchor.setAttribute('rel', 'noopener noreferrer');
    }
    if (!anchor.hasAttribute('target')) {
      anchor.setAttribute('target', '_blank');
    }
  });
  wrapper.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    const src = iframe.getAttribute('src');
    const normalizedSrc = normalizeIframeSrc(src);
    if (!normalizedSrc || !isSafeIframeSrc(normalizedSrc)) {
      iframe.remove();
      return;
    }
    iframe.setAttribute('src', normalizedSrc);
  });

  return wrapper.innerHTML;
}

function isSafeHref(href: string | null) {
  if (!href) {
    return false;
  }
  const trimmed = href.trim();
  if (!trimmed) {
    return false;
  }
  const normalized = trimmed.toLowerCase();
  if (normalized.startsWith('javascript:') || normalized.startsWith('data:')) {
    return false;
  }
  const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1];
    return ['http', 'https', 'mailto', 'tel'].includes(scheme);
  }
  return true;
}

function normalizeIframeSrc(src: string | null) {
  if (!src) {
    return null;
  }
  const trimmed = src.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  return trimmed;
}

function isSafeIframeSrc(src: string | null) {
  if (!src) {
    return false;
  }
  try {
    const url = new URL(src, window.location.origin);
    if (url.protocol !== 'https:') {
      return false;
    }
    if (!SAFE_IFRAME_HOSTS.has(url.hostname) || !url.pathname.startsWith('/embed/')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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

function toTitleCase(value: string) {
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
