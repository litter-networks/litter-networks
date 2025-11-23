export type SiteSection = 'welcome' | 'join-in' | 'news' | 'knowledge';

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
