// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { usePageTitle } from '@/shared/hooks/usePageTitle';
import styles from './styles/join-in.module.css';

interface JoinInPlaceholderPageProps {
  title: string;
  description: string;
}

/**
 * Render a placeholder page, set the document title, and display a heading with a description.
 *
 * @param title - The page title to set and display as the main heading.
 * @param description - The descriptive text rendered below the heading.
 * @returns A JSX element containing the styled placeholder page with an h1 and paragraph.
 */
export function JoinInPlaceholderPage({ title, description }: JoinInPlaceholderPageProps) {
  usePageTitle(title);
  return (
    <div className={styles.placeholderPage}>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
