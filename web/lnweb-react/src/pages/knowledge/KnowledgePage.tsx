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
 * Normalize a route wildcard into a canonical knowledge path.
 *
 * @param wildcard - The raw route wildcard (may be empty or contain leading/trailing slashes)
 * @returns A path string that begins with `knowledge`; if `wildcard` is empty, returns `knowledge`
 */
function getKnowledgePath(wildcard: string) {
  const trimmed = wildcard.replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return 'knowledge';
  }
  return trimmed.startsWith('knowledge') ? trimmed : `knowledge/${trimmed}`;
}

/**
 * Rewrites root-relative href attributes to resolve against a provided base path.
 *
 * @param html - The HTML string to update
 * @param base - The base path to prefix to hrefs that start with `/` (e.g., `knowledge/section`)
 * @returns The HTML string with hrefs that begin with `/` rewritten to be prefixed by `base`; external URLs and already-prefixed or protocol-relative links are left unchanged
 */
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

/**
 * Sanitizes and normalizes knowledge page HTML, ensuring links and iframes are safe for rendering.
 *
 * Rewrites internal links against `linkBase`, removes or strips unsafe anchor `href`s, ensures anchors
 * have `rel="noopener noreferrer"` and `target="_blank"` when allowed, and removes iframes with unsafe sources.
 * When run in an environment without browser globals (no DOM), returns the link-rewritten HTML without performing DOM sanitization.
 *
 * @param html - The raw HTML content to sanitize; empty or undefined input yields an empty string.
 * @param linkBase - Base path used to resolve and rewrite internal links prior to sanitization.
 * @returns The sanitized and normalized HTML string, or an empty string if the input is empty or sanitization produces no content.
 */
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

/**
 * Determines whether an href value is safe to use in anchor elements.
 *
 * @param href - The href value to validate; may be `null` or an empty string
 * @returns `true` if `href` is a relative URL or uses the `http`, `https`, `mailto`, or `tel` scheme; `false` otherwise
 */
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

/**
 * Normalize an iframe `src` value by trimming whitespace and resolving protocol-relative URLs to HTTPS.
 *
 * @param src - The iframe `src` value; may be `null`, empty, or protocol-relative (e.g., `//www.youtube.com/embed/...`).
 * @returns The trimmed `src` string with `//` prefixed URLs converted to `https://`, or `null` if the input is `null` or empty.
 */
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

/**
 * Determines whether an iframe source URL is allowed for embedding.
 *
 * @param src - The iframe `src` value to validate, or `null`
 * @returns `true` if `src` resolves to an `https` URL whose hostname is in `SAFE_IFRAME_HOSTS` and whose path starts with `/embed/`, `false` otherwise.
 */
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