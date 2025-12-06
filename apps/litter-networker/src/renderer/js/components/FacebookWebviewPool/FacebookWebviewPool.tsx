// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from "react";
import type { HTMLWebViewElement } from "../../types/webview";
import styles from "./styles/FacebookWebviewPool.module.css";

const POOL_SIZE = 4;

type Entry = {
  networkId: string;
  url: string;
};

type Slot = {
  slotId: number;
  networkId: string | null;
  // NOTE: slot.url is *only* the initial prefetch URL; active slot ignores this.
  url: string;
  loaded: boolean;
  lastUsed: number;
};

type Props = {
  active: Entry;
  neighbors?: Entry[];
  onStatusChange?: (status: Record<string, boolean>) => void;
  onRegisterReload?: (fn: () => void) => void;
};

/**
 * Render a small pool of WebView elements that keep the active entry loaded and prefetch a few neighbor entries.
 *
 * Renders up to POOL_SIZE webviews, ensures the active entry's URL is always used for the visible view, exposes a reload hook for the active view via `onRegisterReload`, and reports loaded-state changes for the active and neighbor network IDs through `onStatusChange`.
 *
 * @param active - The entry that must be shown as the active/visible network (its `url` is always used for the active webview).
 * @param neighbors - Optional list of additional entries to prefetch; duplicates by `networkId` are ignored and the list is capped at the pool size.
 * @param onStatusChange - Optional callback invoked with a map from `networkId` to `true`/`false` indicating whether that network's webview has finished loading; called only when the status signature changes.
 * @param onRegisterReload - Optional callback used to register a function that will reload the currently active webview when invoked.
 * @returns A React element containing the stacked webviews used for active display and background prefetching.
 */
export default function FacebookWebviewPool({
  active,
  neighbors = [],
  onStatusChange,
  onRegisterReload
}: Props) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: POOL_SIZE }, (_, idx) => ({
      slotId: idx,
      networkId: null,
      url: "",
      loaded: false,
      lastUsed: 0
    }))
  );

  const refs = useRef<Record<number, HTMLWebViewElement | null>>({});
  const listeners = useRef<Set<number>>(new Set());

  // ================================================================
  // Desired entries: active group first, then neighbors
  // ================================================================
  const desiredEntries = useMemo(() => {
    const items: Entry[] = [active];
    neighbors.forEach((e) => {
      if (!items.find((i) => i.networkId === e.networkId)) {
        items.push(e);
      }
    });
    return items.slice(0, POOL_SIZE);
  }, [active, neighbors]);

  // ================================================================
  // SLOT ASSIGNMENT:
  // Match by networkId. If a slot is already loaded for that network, keep its URL/loaded state.
  // ================================================================
  useEffect(() => {
    setSlots((prev) => {
      const now = Date.now();
      const next = prev.map((s) => ({ ...s }));
      const desiredIds = new Set(desiredEntries.map((d) => d.networkId));

      const findSlot = (entry: Entry): Slot => {
        let slot = next.find((s) => s.networkId === entry.networkId);
        if (slot) return slot;

        slot = next.find((s) => s.networkId === null);
        if (slot) return slot;

        const candidates = next.filter((s) => !desiredIds.has(s.networkId ?? ""));
        candidates.sort((a, b) => a.lastUsed - b.lastUsed);
        return candidates[0] ?? next[0];
      };

      let changed = false;

      desiredEntries.forEach((entry) => {
        const slot = findSlot(entry);
        const wasEmpty = slot.networkId === null;
        const sameNetwork = slot.networkId === entry.networkId;

        if (wasEmpty) {
          slot.networkId = entry.networkId;
          slot.url = entry.url;
          slot.loaded = false;
          slot.lastUsed = now;
          changed = true;
          return;
        }

        if (!sameNetwork) {
          slot.networkId = entry.networkId;
          slot.url = entry.url;
          slot.loaded = false;
          slot.lastUsed = now;
          changed = true;
          return;
        }

        // same network: keep existing URL/content, just refresh priority/lastUsed
        slot.lastUsed = now;
      });

      return changed ? next : prev;
    });
  }, [desiredEntries]);

  // ================================================================
  // did-finish-load listeners
  // ================================================================
  useEffect(() => {
    slots.forEach((slot) => {
      if (listeners.current.has(slot.slotId)) return;
      const view = refs.current[slot.slotId];
      if (!view) return;

      const handleLoad = () => {
        setSlots((prev) =>
          prev.map((s) =>
            s.slotId === slot.slotId ? { ...s, loaded: true, lastUsed: Date.now() } : s
          )
        );
      };

      view.addEventListener("did-finish-load", handleLoad as any);
      listeners.current.add(slot.slotId);
    });
  }, [slots]);

  // ================================================================
  // RELOAD HOOK (active slot only)
  // ================================================================
  useEffect(() => {
    if (!onRegisterReload) return;

    const fn = () => {
      const slot = slots.find((s) => s.networkId === active.networkId);
      if (!slot) return;
      refs.current[slot.slotId]?.reload?.();
    };

    onRegisterReload(fn);
  }, [slots, active, onRegisterReload]);

  // ================================================================
  // STATUS CALLBACK
  // ================================================================
  const statusSig = useRef("");
  useEffect(() => {
    if (!onStatusChange) return;

    const status: Record<string, boolean> = {};

    neighbors.forEach((entry) => {
      status[entry.networkId] = slots.some(
        (slot) => slot.networkId === entry.networkId && slot.loaded
      );
    });

    const sig = Object.entries({ ...status, [active.networkId]: slots.some((s) => s.networkId === active.networkId && s.loaded) })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join("|");

    if (sig !== statusSig.current) {
      statusSig.current = sig;
      onStatusChange(status);
    }
  }, [slots, neighbors, active, onStatusChange]);

  // ================================================================
  // RENDER — CRITICAL PART:
  // Active slot uses **active.url** always (deep navigation).
  // Other slots use their "initial prefetch" url.
  // ================================================================
  return (
    <div className={styles.poolContainer}>
      <div className={styles.webviewStack}>
        {slots.map((slot) => {
          const isActive = slot.networkId === active.networkId;
          const src = isActive ? active.url ?? slot.url : slot.url;

          return (
            <webview
              key={slot.slotId}
              ref={(n) => (refs.current[slot.slotId] = n)}
              allowpopups={true}
              src={src}
              data-network-id={slot.networkId ?? ""}
              className={isActive ? styles.activeWebview : styles.hiddenWebview}
            />
          );
        })}
      </div>
    </div>
  );
}
