// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

export type StatsStylePreference = 'formal' | 'casual';

export const STATS_STYLE_STORAGE_KEY = 'ln.stats.style';
export const STATS_STYLE_CHANGE_EVENT = 'ln:stats-style-change';
export const DEFAULT_STATS_STYLE: StatsStylePreference = 'casual';

export function getStoredStatsStyle(): StatsStylePreference {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_STATS_STYLE;
  }
  const value = window.localStorage.getItem(STATS_STYLE_STORAGE_KEY);
  return value === 'formal' ? 'formal' : 'casual';
}

export function setStoredStatsStyle(style: StatsStylePreference) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  window.localStorage.setItem(STATS_STYLE_STORAGE_KEY, style);
  window.dispatchEvent(new CustomEvent<StatsStylePreference>(STATS_STYLE_CHANGE_EVENT, { detail: style }));
}
