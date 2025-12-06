// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

export type SiteSection = 'welcome' | 'join-in' | 'news' | 'knowledge';

/**
 * Determine which site section corresponds to a URL pathname.
 *
 * @param pathname - The URL pathname to inspect (for example, "/news/article/123")
 * @returns `'join-in'` if `pathname` contains `/join-in`, `'news'` if it contains `/news`, `'knowledge'` if it contains `/knowledge`, otherwise `'welcome'`
 */
export function getSectionFromPath(pathname: string): SiteSection {
  if (pathname.includes('/join-in')) {
    return 'join-in';
  }
  if (pathname.includes('/news')) {
    return 'news';
  }
  if (pathname.includes('/knowledge')) {
    return 'knowledge';
  }
  return 'welcome';
}
