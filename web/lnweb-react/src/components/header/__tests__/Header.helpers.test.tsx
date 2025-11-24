import { describe, expect, it } from 'vitest';
import styles from '../styles/header.module.css';
import { getHeaderColorClass, getPathSuffix, getSearchColorClass } from '../header-helpers';

describe('Header helper functions', () => {
  it('returns the expected header color classes', () => {
    expect(getHeaderColorClass('news')).toBe(styles.newsHeaderColor);
    expect(getHeaderColorClass('knowledge')).toBe(styles.knowledgeHeaderColor);
    expect(getHeaderColorClass('join-in')).toBe(styles.joinInHeaderColor);
  });

  it('returns the expected search color classes', () => {
    expect(getSearchColorClass('news')).toBe(styles.newsHeaderSearchColor);
    expect(getSearchColorClass('knowledge')).toBe(styles.knowledgeHeaderSearchColor);
    expect(getSearchColorClass('join-in')).toBe(styles.joinInHeaderSearchColor);
  });

  it('computes the path suffix correctly', () => {
    expect(getPathSuffix('/')).toBe('');
    expect(getPathSuffix('/join-in')).toBe('');
    expect(getPathSuffix('/join-in/stats')).toBe('/stats');
    expect(getPathSuffix('/news')).toBe('');
    expect(getPathSuffix('/news/article')).toBe('/article');
  });
});
