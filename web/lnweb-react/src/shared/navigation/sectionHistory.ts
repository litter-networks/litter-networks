// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import type { SiteSection } from '@/shared/utils/sections';

const STORAGE_PREFIX = 'ln.section.lastPath.';
const trackedSections: SiteSection[] = ['welcome', 'join-in', 'news', 'knowledge'];

function getStorageKey(section: SiteSection) {
  return `${STORAGE_PREFIX}${section}`;
}

export function readLastSectionPath(section: SiteSection): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage.getItem(getStorageKey(section));
}

export function writeLastSectionPath(section: SiteSection, relativePath: string) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(getStorageKey(section), relativePath);
}

export function loadSectionHistory(): Partial<Record<SiteSection, string>> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  const result: Partial<Record<SiteSection, string>> = {};
  trackedSections.forEach((section) => {
    const stored = window.localStorage.getItem(getStorageKey(section));
    if (stored !== null) {
      result[section] = stored;
    }
  });
  return result;
}
