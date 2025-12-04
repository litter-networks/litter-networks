// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavData } from '@/features/nav/useNavData';
import { NetworkSwitcherMenu } from './NetworkSwitcherMenu';
import styles from './styles/networkSwitcher.module.css';

type Props = {
  headerColorClass: string;
  searchColorClass: string;
};

/**
 * Trigger + dropdown wrapper for selecting networks, searching, and managing favourites.
 */
export function NetworkSwitcher({ headerColorClass, searchColorClass }: Props) {
  const { displayName } = useNavData();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!triggerRef.current || triggerRef.current.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const triggerClassName = useMemo(
    () => `${styles.networkSwitcher} ${open ? styles.networkSwitcherOpen : ''}`.trim(),
    [open],
  );

  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      root.classList.add('filter-menu-open');
    } else {
      root.classList.remove('filter-menu-open');
    }
    return () => {
      root.classList.remove('filter-menu-open');
    };
  }, [open]);

  return (
    <div
      className={triggerClassName}
      tabIndex={0}
      ref={triggerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.networkSwitcherLink}
        onClick={() => setOpen((state: boolean) => !state)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <img className={styles.networkSwitcherLogo} src="/brand/logo-only.svg" alt="Litter Networks logo" />
        <span className={styles.networkSwitcherTitle}>{displayName}</span>
        <img
          className={`${styles.networkSwitcherChevron} ${open ? styles.networkSwitcherChevronOpen : ''}`}
          src="/images/dropdown-icon.png"
          alt=""
          aria-hidden="true"
        />
      </button>
      <NetworkSwitcherMenu
        open={open}
        onRequestClose={() => setOpen(false)}
        headerColorClass={headerColorClass}
        searchColorClass={searchColorClass}
      />
    </div>
  );
}
