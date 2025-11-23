import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { HTMLWebViewElement } from "../../types/webview";
import styles from "./styles/DualPaneView.module.css";
import FacebookWebviewPool from "../FacebookWebviewPool/FacebookWebviewPool";

type PaneConfig = {
  id: string;
  title: string;
  url: string;
};

type Props = {
  leftPane: PaneConfig;
  rightPane: PaneConfig;
  leftOverride?: {
    networkId: string;
    url: string;
    prefetch?: Array<{ networkId: string; url: string }>;
    onPrefetchStatusChange?: (status: Record<string, boolean>) => void;
    onRegisterReload?: (fn: () => void) => void;
    onReload?: () => void;
  };
  rightOverride?: { url: string };
  prefetchStatus?: { prevReady?: boolean; nextReady?: boolean };
  leftExtras?: React.ReactNode;
};

const DEFAULT_SPLIT_RATIO = 0.75;
const MIN_LEFT_RATIO = 0.45;
const MAX_LEFT_RATIO = 0.9;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Renders a resizable two-pane layout with a draggable vertical split and optional per-pane overrides.
 *
 * @param leftPane - Configuration for the left pane (id, title, url).
 * @param rightPane - Configuration for the right pane (id, title, url).
 * @param leftOverride - If provided, replaces the left pane's webview with a FacebookWebviewPool and supplies override `url`, `networkId`, optional `prefetch` neighbors, and reload/status hooks.
 * @param rightOverride - If provided, overrides the right pane's displayed `url`.
 * @param prefetchStatus - Optional object describing prefetch readiness used to adjust split-handle styling.
 * @param leftExtras - Optional React nodes rendered as toolbar extras in the left pane.
 * @returns The rendered dual-pane React element with a draggable split handle and persisted split ratio.
 */
export default function DualPaneView({
  leftPane,
  rightPane,
  leftOverride,
  rightOverride,
  prefetchStatus,
  leftExtras
}: Props) {
  const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT_RATIO);
  const [isDragging, setIsDragging] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const splitHandleRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const latestRatio = useRef(splitRatio);

  useEffect(() => {
    latestRatio.current = splitRatio;
  }, [splitRatio]);

  useEffect(() => {
    let mounted = true;
    window.appApi
      .getSplitRatio()
      .then((ratio) => {
        if (mounted) {
          setSplitRatio(clamp(ratio, MIN_LEFT_RATIO, MAX_LEFT_RATIO));
        }
      })
      .catch(console.error);
    return () => {
      mounted = false;
    };
  }, []);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
    if (splitHandleRef.current && pointerIdRef.current !== null) {
      try {
        splitHandleRef.current.releasePointerCapture(pointerIdRef.current);
      } catch {}
      pointerIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (ev: PointerEvent) => {
      const grid = gridRef.current;
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(clamp(ratio, MIN_LEFT_RATIO, MAX_LEFT_RATIO));
    };

    const onUp = () => stopDragging();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging, stopDragging]);

  const handlePointerDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    ev.preventDefault();
    splitHandleRef.current = ev.currentTarget;
    pointerIdRef.current = ev.pointerId;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    setIsDragging(true);
  };

  const handlePointerUp = () => {
    if (isDragging) {
      stopDragging();
      window.appApi.setSplitRatio(latestRatio.current).catch(console.error);
    }
  };

  const rightPaneRatio = useMemo(() => Math.max(0.2, 1 - splitRatio), [splitRatio]);

  const leftContent = leftOverride ? (
    <Panel
      pane={leftPane}
      urlOverride={leftOverride.url}
      body={
        <FacebookWebviewPool
          active={{ networkId: leftOverride.networkId, url: leftOverride.url }}
          neighbors={leftOverride.prefetch}
          onStatusChange={leftOverride.onPrefetchStatusChange}
          onRegisterReload={leftOverride.onRegisterReload}
        />
      }
      onReload={leftOverride.onReload}
      toolbarExtras={leftExtras}
    />
  ) : (
    <Panel pane={leftPane} toolbarExtras={leftExtras} />
  );

  const splitHandleClass = [
    styles.splitHandle,
    prefetchStatus?.nextReady ? styles.splitHandleReady : "",
    isDragging ? styles.splitHandleDragging : ""
  ].join(" ");

  return (
    <div
      className={styles.paneGrid}
      ref={gridRef}
      style={{
        gridTemplateColumns: `minmax(0, ${splitRatio}fr) 4px minmax(0, ${rightPaneRatio}fr)`
      }}
    >
      {leftContent}
      <div
        className={splitHandleClass}
        ref={splitHandleRef}
        role="separator"
        aria-orientation="vertical"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <span />
      </div>

      <Panel pane={rightPane} urlOverride={rightOverride?.url} />
    </div>
  );
}

// --------------------------------------------------------------------
// Subcomponent — Panel
/**
 * Render a pane containing a toolbar (reload button, URL display, optional extras) and content.
 *
 * The toolbar shows `urlOverride` if provided; otherwise it shows `pane.url`. Clicking the reload
 * button calls `onReload` when supplied; if `onReload` is not provided, the component attempts to
 * call `reload()` on the internal webview element.
 *
 * @param pane - Pane configuration (id, title, url) used as the default content and URL.
 * @param urlOverride - Optional URL to display and load instead of `pane.url`.
 * @param body - Optional custom React node to render as the pane's content; when omitted a webview pointing to the effective URL is rendered.
 * @param onReload - Optional callback invoked when the reload button is clicked; if omitted the webview's `reload()` method is used when available.
 * @param className - Optional additional class name(s) applied to the pane container.
 * @param toolbarExtras - Optional React node(s) rendered in the toolbar alongside the URL field and reload button.
 * @returns The rendered pane section element.
 */

function Panel({
  pane,
  urlOverride,
  body,
  onReload,
  className,
  toolbarExtras
}: {
  pane: PaneConfig;
  urlOverride?: string;
  body?: React.ReactNode;
  onReload?: () => void;
  className?: string;
  toolbarExtras?: React.ReactNode;
}) {
  const webviewRef = useRef<HTMLWebViewElement | null>(null);

  const handleReload = () => {
    if (onReload) return onReload();
    const wv = webviewRef.current;
    if (wv?.reload) wv.reload();
  };

  return (
    <section className={`${styles.paneCard} ${className ?? ""}`}>
      <div className={styles.paneToolbar}>
        <button
          type="button"
          className={styles.ghostButton}
          onClick={handleReload}
          title="Reload panel"
        >
          ⟳
        </button>
        <div className={styles.paneUrlField}>
          <input readOnly value={urlOverride ?? pane.url} />
        </div>
        {toolbarExtras}
      </div>

      <div className={styles.paneContent}>
        {body ?? (
          <webview
            ref={webviewRef}
            allowpopups={true}
            src={urlOverride ?? pane.url}
            className={styles.webviewFrame}
          />
        )}
      </div>
    </section>
  );
}