import { describe, expect, it, vi } from 'vitest';
import {
  getKnowledgePath,
  updateInternalLinks,
  sanitizeKnowledgeHtml,
  isSafeHref,
  normalizeIframeSrc,
} from '../KnowledgePage';

vi.mock('dompurify', () => ({
  default: {
    sanitize: (input: string) => input,
  },
}));

describe('KnowledgePage helpers', () => {
  it('builds normalized knowledge paths', () => {
    expect(getKnowledgePath('')).toBe('knowledge');
    expect(getKnowledgePath('knowledge/section')).toBe('knowledge/section');
    expect(getKnowledgePath('section')).toBe('knowledge/section');
    expect(getKnowledgePath('/section/')).toBe('knowledge/section');
  });

  it('rewrites internal links but leaves external ones alone', () => {
    const html = '<a href="/foo">internal</a><a href="https://example.com">external</a>';
    const result = updateInternalLinks(html, '/all');
    expect(result).toContain('href="/all/foo"');
    expect(result).toContain('href="https://example.com"');
  });

  it('sanitizes html to enforce safe hrefs and iframe sources', () => {
    const html =
      '<a href="/link">Link</a><a href="javascript:alert(1)">bad</a><iframe src="//www.youtube.com/embed/foo"></iframe>';
    const sanitized = sanitizeKnowledgeHtml(html, '/base');
    expect(sanitized).toContain('href="/base/link"');
    expect(sanitized).toContain('target="_blank"');
    expect(sanitized).toContain('rel="noopener noreferrer"');
    expect(sanitized).toContain('src="https://www.youtube.com/embed/foo"');
    expect(sanitized).not.toContain('javascript:alert');
  });

  it('recognizes safe and unsafe hrefs', () => {
    expect(isSafeHref('/foo')).toBe(true);
    expect(isSafeHref('https://example.com')).toBe(true);
    expect(isSafeHref('mailto:test@example.com')).toBe(true);
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('data:image/png;base64,abc')).toBe(false);
  });

  it('normalizes iframe sources to https when needed', () => {
    expect(normalizeIframeSrc('//www.youtube.com/embed')).toBe('https://www.youtube.com/embed');
    expect(normalizeIframeSrc('https://example.com')).toBe('https://example.com');
    expect(normalizeIframeSrc(null)).toBeNull();
    expect(normalizeIframeSrc('')).toBeNull();
  });
});
