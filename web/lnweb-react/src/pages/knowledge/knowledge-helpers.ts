// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import DOMPurify from 'dompurify';

const SAFE_IFRAME_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com']);

const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ["iframe"],
  ALLOWED_TAGS: [
    'a',
    'b',
    'i',
    'em',
    'strong',
    'p',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'img',
    'iframe',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'figure',
    'figcaption',
    'br',
    'hr',
    'table',
    'thead',
    'tbody',
    'tr',
    'td',
    'th',
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

export function getKnowledgePath(wildcard: string) {
  const trimmed = wildcard.replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return 'knowledge';
  }
  return trimmed.startsWith('knowledge') ? trimmed : `knowledge/${trimmed}`;
}

export function getKnowledgeCssPath(path: string) {
  const normalized = getKnowledgePath(path);
  const slug = normalized.replace(/\//g, '-');
  return `https://cdn.litternetworks.org/docs/styles/${slug}.css`;
}

export function updateInternalLinks(html: string, base: string) {
  const baseTrimmed = base.replace(/\/+$/, '');
  return html.replace(/href="([^"]*)"/g, (match, url) => {
    if (url.startsWith(baseTrimmed) || url.startsWith('//') || /^https?:\/\//.test(url)) {
      return match;
    }
    const pathWithoutLeadingSlash = url.replace(/^\/+/, '');
    if (pathWithoutLeadingSlash.includes(':')) {
      return match;
    }
    const normalized = `${baseTrimmed}/${pathWithoutLeadingSlash}`;
    return `href="${normalized}"`;
  });
}

export function sanitizeKnowledgeHtml(html: string | undefined, linkBase: string) {
  if (!html) {
    return '';
  }

  const updatedLinks = updateInternalLinks(html, linkBase);
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

export function isSafeHref(href: string | null) {
  if (!href) {
    return false;
  }
  const trimmed = href.trim();
  if (!trimmed) {
    return false;
  }
  if (/javascript:/i.test(trimmed)) {
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

export function normalizeIframeSrc(src: string | null) {
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

export function isSafeIframeSrc(src: string | null) {
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
