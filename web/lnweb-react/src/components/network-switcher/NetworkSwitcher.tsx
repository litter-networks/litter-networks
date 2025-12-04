// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
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
  const { buildPath, displayName } = useNavData();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  const handlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') {
      setOpen(true);
    }
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') {
      setOpen(false);
    }
  };

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

  return (
    <div
      className={triggerClassName}
      tabIndex={0}
      ref={triggerRef}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <Link
        className={styles.networkSwitcherLink}
        to={buildPath('')}
        onClick={(event) => {
          event.preventDefault();
          setOpen((state: boolean) => !state);
        }}
        role="button"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <img className={styles.networkSwitcherLogo} src="/brand/logo-only.svg" alt="Litter Networks logo" />
        <span className={styles.networkSwitcherTitle}>{displayName}</span>
        <img
          className={`${styles.networkSwitcherChevron} ${open ? styles.networkSwitcherChevronOpen : ''}`}
          src="/images/dropdown-icon.png"
          alt="Toggle network menu"
        />
      </Link>
      <NetworkSwitcherMenu
        open={open}
        onRequestClose={() => setOpen(false)}
        headerColorClass={headerColorClass}
        searchColorClass={searchColorClass}
      />
    </div>
  );
}
