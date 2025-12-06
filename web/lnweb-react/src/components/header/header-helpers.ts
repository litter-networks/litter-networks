// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { getSectionFromPath } from '@/shared/utils/sections';
import styles from './styles/header.module.css';

type Section = ReturnType<typeof getSectionFromPath>;

export function getHeaderColorClass(section: Section) {
  switch (section) {
    case 'news':
      return styles.newsHeaderColor;
    case 'knowledge':
      return styles.knowledgeHeaderColor;
    default:
      return styles.joinInHeaderColor;
  }
}

export function getSearchColorClass(section: Section) {
  switch (section) {
    case 'news':
      return styles.newsHeaderSearchColor;
    case 'knowledge':
      return styles.knowledgeHeaderSearchColor;
    default:
      return styles.joinInHeaderSearchColor;
  }
}

export function getPathSuffix(pathname: string) {
  if (!pathname) {
    return '';
  }
  const suffix = pathname.replace(/^\/[^/]+/, '');
  return suffix === '/' ? '' : suffix;
}
