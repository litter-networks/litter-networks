// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BagCounter from "../../components/BagCounter/BagCounter";
import CloudfrontInvalidation from "../../components/CloudfrontInvalidation/CloudfrontInvalidation";
import MemberCounter from "../../components/MemberCounter/MemberCounter";
import DualPaneView from "../../components/DualPaneView/DualPaneView";
import { useAppSnapshot } from "../../data-sources/useAppSnapshot";
import styles from "./styles/BrowsePage.module.css";
import NetworkNavigation from "../../components/NetworkNavigation/NetworkNavigation";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";

const HOME_NETWORK_ID = "litternetworks";

const preserveSubPath = (prev: string | null, nextBase: string) => {
  const marker = "/posts/";
  if (!prev) return nextBase;
  const idx = prev.indexOf(marker);
  if (idx < 0) return nextBase;
  const tail = prev.substring(idx);
  return `${nextBase.replace(/\/$/, "")}${tail}`;
};

/**
 * Render the main Browse page for navigating networks, applying bag counts, and viewing dual-pane content.
 *
 * Manages network selection and URL preservation, per-network bag counting and stats refresh, mock-mode synchronization with main, adjacent-network prefetching, and keyboard navigation; composes NetworkNavigation, BagCounter, and DualPaneView with appropriate overrides and prefetch status handling.
 *
 * @returns The rendered Browse page React element.
 */
export default function BrowsePage() {
  const { snapshot, loading, refresh } = useAppSnapshot();
  const [selectedNetwork, setSelectedNetwork] = useState<string>();
  const [viewNetworkId, setViewNetworkId] = useState<string>();
  const [activeUrl, setActiveUrl] = useState<string>("");
  const [bagInput, setBagInput] = useState(0);
  const [totalLabel, setTotalLabel] = useState("All 0");
  const [sessionCount, setSessionCount] = useState(0);
  const [sinceLabel, setSinceLabel] = useState<string>();
  const [memberInput, setMemberInput] = useState(0);
  const [memberRegistered, setMemberRegistered] = useState<number | null>(null);
  const [memberApplying, setMemberApplying] = useState(false);
  const [memberSinceLabel, setMemberSinceLabel] = useState("--");
  const [arrowLockEnabled, setArrowLockEnabled] = useState(true);
  const [prefetchStatus, setPrefetchStatus] = useState({
    prevReady: false,
    nextReady: false,
    nextTwoReady: false
  });
  const [mockEnabled, setMockEnabled] = useState(false);
  const [mockPrefsReady, setMockPrefsReady] = useState(false);
  const [mockSyncing, setMockSyncing] = useState(false);
  const [applying, setApplying] = useState(false);

  const formatSampleTimeLabel = (value?: number | null) => {
    if (!value || !Number.isFinite(value)) {
      return "--";
    }
    return new Date(value * 1000).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  };

  const previousNetwork = useRef<string | null>(null);
  const lastBaseUrl = useRef<string | null>(null);
  const selectedNetworkRef = useRef<string | undefined>(selectedNetwork);
  const selectionPrefsReadyRef = useRef(false);

  const updateActiveUrl = useCallback(
    (networkId: string, preserveSubgroup: boolean) => {
      if (!snapshot) return;
      const network = snapshot.networks.find((n) => n.id === networkId);
      if (!network) return;
      const newBase = network.facebookGroupUrl;
      setActiveUrl((prev) => {
        if (preserveSubgroup && previousNetwork.current === networkId) {
          return preserveSubPath(prev || newBase, newBase);
        }
        return newBase;
      });
      previousNetwork.current = networkId;
      lastBaseUrl.current = newBase;
      setViewNetworkId(networkId);
    },
    [snapshot]
  );

  const handleMemberApply = useCallback(async () => {
    if (!selectedNetwork) return;
    setMemberApplying(true);
    try {
      const nextValue = Math.max(0, Math.round(memberInput));
      await window.appApi.applyMemberCount?.({
        networkId: selectedNetwork,
        memberCount: nextValue
      });
      const response = await window.appApi.getMemberCount?.(selectedNetwork);
      if (response) {
        const normalized = Math.max(0, Math.round(response.memberCount ?? 0));
        setMemberRegistered(normalized);
        setMemberInput(normalized);
        setMemberSinceLabel(formatSampleTimeLabel(response.sampleTime));
      }
    } catch (error) {
      console.error("Failed to apply member count", error);
    } finally {
      setMemberApplying(false);
    }
  }, [memberInput, selectedNetwork]);

  const handleInvalidateDistribution = useCallback(async (distributionId: string) => {
    try {
      await window.appApi.invalidateDistribution?.(distributionId);
    } catch (error) {
      console.error("Failed to invalidate CloudFront distribution", error);
    }
  }, []);


  const persistSelectedNetwork = useCallback((networkId: string | undefined) => {
    if (!selectionPrefsReadyRef.current) return;
    const promise = window.appApi.setSelectedNetworkId?.(networkId ?? null);
    promise?.catch((err) => console.error("Failed to persist selected network", err));
  }, []);

  const selectNetwork = useCallback(
    (networkId: string, preserve = false) => {
      setSelectedNetwork(networkId);
      selectedNetworkRef.current = networkId;
      updateActiveUrl(networkId, preserve);
      persistSelectedNetwork(networkId);
    },
    [updateActiveUrl, persistSelectedNetwork]
  );

  useEffect(() => {
    selectedNetworkRef.current = selectedNetwork;
  }, [selectedNetwork]);

  useEffect(() => {
    let cancelled = false;
    const loadSelection = async () => {
      let stored: string | null = null;
      try {
        stored = await window.appApi.getSelectedNetworkId?.();
        if (cancelled) return;
        if (stored) {
          setSelectedNetwork(stored);
          selectedNetworkRef.current = stored;
        }
      } catch (err) {
        console.error("Failed to load selected network", err);
      } finally {
        if (!cancelled) {
          selectionPrefsReadyRef.current = true;
          if (selectedNetworkRef.current) {
            persistSelectedNetwork(selectedNetworkRef.current);
          }
        }
      }
    };
    loadSelection();
    return () => {
      cancelled = true;
    };
  }, [persistSelectedNetwork]);

  const moveToNextNetwork = useCallback((): string | null => {
    if (!snapshot || !selectedNetwork) return null;
    const arr = snapshot.networks;
    const idx = arr.findIndex((n) => n.id === selectedNetwork);
    if (idx === -1) {
      return null;
    }
    const next = arr[(idx + 1) % arr.length];
    selectNetwork(next.id);
    return next.id;
  }, [snapshot, selectedNetwork, selectNetwork]);

  const handleApply = useCallback(
    async (advance: boolean) => {
      if (!snapshot || !selectedNetwork) return;
      const network = snapshot.networks.find((n) => n.id === selectedNetwork);
      if (!network) return;
      const districtIds = network.districtId
        ? network.districtId.split(",").map((id) => id.trim()).filter(Boolean)
        : [];
      const appliedAmount = Number(bagInput.toFixed(1));
      setApplying(true);
      let refreshTargetId = network.id;
      try {
        const applyPromise = window.appApi.applyBagCount?.({
          networkId: network.id,
          bagCount: appliedAmount,
          districtIds
        });
        setBagInput(0);
        const nowLabel = new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        });
        setSessionCount((prev) => prev + appliedAmount);
        setSinceLabel(nowLabel);
        setTotalLabel((prev) => {
          const match = prev.match(/All\s+([0-9.]+)/i);
          const current = match ? Number(match[1]) : 0;
          return `All ${(current + appliedAmount).toFixed(0)}`;
        });
      if (advance) {
        const nextId = moveToNextNetwork();
        if (nextId) {
          refreshTargetId = nextId;
        }
      }
      applyPromise
        ?.then(() => window.appApi.getBagStats?.(refreshTargetId))
          .then((stats) => {
            if (!stats) return;
            if (selectedNetworkRef.current !== refreshTargetId) return;
            setSessionCount(stats.network.session);
            setSinceLabel(stats.network.lastUpdated);
            setTotalLabel(`All ${stats.all.session.toFixed(0)}`);
          })
        .catch((error) => console.error("Failed to refresh bag stats", error));
    } catch (error) {
      console.error("Failed to apply bag count", error);
    } finally {
      setApplying(false);
    }
    },
    [snapshot, selectedNetwork, bagInput, refresh, moveToNextNetwork]
  );

  const handleMemberAdvance = useCallback(async () => {
    await handleMemberApply();
    await handleApply(true);
  }, [handleMemberApply, handleApply]);

  useEffect(() => {
    if (!snapshot) return;
    if (!selectedNetwork) {
      selectNetwork(snapshot.defaultNetworkId);
      return;
    }
    const exists = snapshot.networks.find((n) => n.id === selectedNetwork);
    if (!exists) {
      selectNetwork(snapshot.defaultNetworkId);
    } else {
      updateActiveUrl(selectedNetwork, true);
    }
  }, [snapshot, selectedNetwork, selectNetwork, updateActiveUrl]);

  useEffect(() => setBagInput(0), [selectedNetwork]);

  useEffect(() => {
    if (!snapshot) return setTotalLabel("All 0");
    const summary = snapshot.bagSummaries.find((e) => e.networkId === "all");
    setTotalLabel(`All ${(summary?.totals.session ?? 0).toFixed(0)}`);
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedNetwork || selectedNetwork === HOME_NETWORK_ID) {
      setSessionCount(0);
      setSinceLabel(undefined);
      return;
    }

    window.appApi
      .getBagStats?.(selectedNetwork)
      ?.then((stats) => {
        if (!stats || cancelled) return;
        if (selectedNetworkRef.current !== selectedNetwork) return;
        setSessionCount(stats.network.session);
        setSinceLabel(stats.network.lastUpdated);
        setTotalLabel(`All ${stats.all.session.toFixed(0)}`);
      })
      .catch((error) => console.error("Failed to fetch bag stats", error));

    return () => {
      cancelled = true;
    };
  }, [selectedNetwork]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedNetwork || selectedNetwork === HOME_NETWORK_ID) {
      setMemberRegistered(null);
      setMemberInput(0);
      setMemberSinceLabel("--");
      return;
    }

    window.appApi
      .getMemberCount?.(selectedNetwork)
      ?.then((result) => {
        if (cancelled) return;
        const normalized = Math.max(0, Math.round(result?.memberCount ?? 0));
        setMemberRegistered(normalized);
        setMemberInput(normalized);
        setMemberSinceLabel(formatSampleTimeLabel(result?.sampleTime));
      })
      .catch((error) => {
        console.error("Failed to fetch member count", error);
        if (!cancelled) {
          setMemberRegistered(null);
          setMemberSinceLabel("--");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNetwork]);

  // Load mock preference and align with the host process before syncing changes.
  useEffect(() => {
    let cancelled = false;
    const loadMockPreference = async () => {
      try {
        const status = await window.appApi.getMockStatus?.();
        const stored = await window.appApi.getMockPreference?.();
        if (cancelled) return;
        if (typeof stored === "boolean") {
          setMockEnabled(stored);
        } else if (status) {
          setMockEnabled(status.enabled);
        } else {
          setMockEnabled(false);
        }
      } catch (err) {
        console.error("Failed to load mock preference", err);
      } finally {
        if (!cancelled) {
          setMockPrefsReady(true);
        }
      }
    };
    loadMockPreference();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync mock state + preference to disk and refresh snapshot when toggled by user
  useEffect(() => {
    if (!mockPrefsReady) return;
    let cancelled = false;
    const syncPreference = async () => {
      setMockSyncing(true);
      try {
        const tasks: Promise<unknown>[] = [];
        const mockPromise = window.appApi.setMockEnabled?.(mockEnabled);
        if (mockPromise) tasks.push(mockPromise);
        const prefPromise = window.appApi.setMockPreference?.(mockEnabled);
        if (prefPromise) tasks.push(prefPromise);
        await Promise.all(tasks);
        if (!cancelled) {
          await refresh();
        }
      } catch (err) {
        console.error("Failed to sync mock preference", err);
      } finally {
        if (!cancelled) {
          setMockSyncing(false);
        }
      }
    };
    syncPreference();
    return () => {
      cancelled = true;
    };
  }, [mockEnabled, mockPrefsReady, refresh]);

  // refs used by updateActiveUrl to preserve subgroup URLs

  const lnUrl = useMemo(() => {
    const base = snapshot?.paneLayout.right.url ?? "https://litternetworks.org";
    if (!selectedNetwork || selectedNetwork === HOME_NETWORK_ID) return `${base}`;
    return `${base.replace(/\/$/, "")}/network/${selectedNetwork}`;
  }, [snapshot, selectedNetwork]);

  // Hotkeys
  useEffect(() => {
    if (!snapshot || !selectedNetwork) return;

    const off = window.appApi.onNavigateHotkey?.((p) => {
      if (!arrowLockEnabled) return;

      const arr = snapshot.networks;
      const idx = arr.findIndex((n) => n.id === selectedNetwork);
      if (idx < 0) return;

      const wrap = (i: number) => ((i % arr.length) + arr.length) % arr.length;
      const nextIdx = wrap(p.direction === "next" ? idx + 1 : idx - 1);
      const next = arr[nextIdx];

      if (next.id !== HOME_NETWORK_ID && p.ctrl) {
        setBagInput(0);
        handleApply(true).catch(() => {});
        return;
      }

      selectNetwork(next.id);
    });

    return () => off?.();
  }, [snapshot, selectedNetwork, arrowLockEnabled, selectNetwork, handleApply]);

  const prefetchEntries = useMemo(() => {
    if (!snapshot || !selectedNetwork) {
      return [];
    }

    const networks = snapshot.networks.filter((n) => n.id !== HOME_NETWORK_ID);
    if (networks.length === 0) return [];
    const currentIdx = networks.findIndex((n) => n.id === selectedNetwork);
    const wrap = (i: number) => ((i % networks.length) + networks.length) % networks.length;

    const addOnce = (arr: Array<{ networkId: string; url: string }>, network?: typeof networks[number]) => {
      if (!network) return;
      if (arr.some((item) => item.networkId === network.id)) return;
      arr.push({ networkId: network.id, url: network.facebookGroupUrl });
    };

    const out: Array<{ networkId: string; url: string }> = [];

    if (currentIdx === -1) {
      networks.slice(0, Math.min(3, networks.length)).forEach((net) => addOnce(out, net));
      return out;
    }

    addOnce(out, networks[wrap(currentIdx - 1)]);
    addOnce(out, networks[wrap(currentIdx + 1)]);
    addOnce(out, networks[wrap(currentIdx + 2)]);

    return out;
  }, [snapshot, selectedNetwork]);

  const reloadRef = useRef<() => void>(() => {});

  const mockToggle = (
    <button
      type="button"
      className={`featureToggleButton ${mockEnabled ? "featureToggleButtonActive" : ""}`}
      onClick={() => setMockEnabled((prev) => !prev)}
      disabled={mockSyncing || !mockPrefsReady}
      title={mockEnabled ? "Using local mock pages" : "Switch to local mock pages"}
    >
      Mock
    </button>
  );

  return (
    <div className={styles.pageShell}>
      <div className={styles.controlsRow}>
        <ErrorBoundary name="Network Navigation">
          <NetworkNavigation
            options={snapshot?.networks.map((n) => ({ id: n.id, label: n.displayLabel })) ?? []}
            value={selectedNetwork}
            onChange={selectNetwork}
            arrowLockEnabled={arrowLockEnabled}
            onToggleArrowLock={() =>
              setArrowLockEnabled((prev) => {
                const next = !prev;
                window.appApi.setArrowLock?.(next);
                return next;
              })
            }
            prefetchStatus={prefetchStatus}
          />
        </ErrorBoundary>

      <div className={styles.counterGroup}>
        {selectedNetwork !== HOME_NETWORK_ID && selectedNetwork ? (
          <>
            <ErrorBoundary name="Member Counter">
              <MemberCounter
                inputValue={memberInput}
                onChange={setMemberInput}
                memberCount={memberRegistered}
                sinceLabel={memberSinceLabel}
                onApply={handleMemberApply}
                onAdvance={handleMemberAdvance}
                applying={memberApplying}
              />
            </ErrorBoundary>
            <ErrorBoundary name="Bag Counter">
              <BagCounter
                inputValue={bagInput}
                onChange={setBagInput}
                sessionCount={sessionCount}
                totalLabel={totalLabel}
                sinceLabel={sinceLabel}
                onApply={handleApply}
                applying={applying}
              />
            </ErrorBoundary>
          </>
        ) : null}
        <ErrorBoundary name="Cloudfront">
          <CloudfrontInvalidation onInvalidate={handleInvalidateDistribution} />
        </ErrorBoundary>
      </div>
      </div>

      {loading || !snapshot ? (
        <div className={styles.loadingState}>Loading workspace…</div>
      ) : (
        <div className={styles.paneWrapper}>
          <ErrorBoundary name="Dual Pane View">
            <DualPaneView
              leftPane={snapshot.paneLayout.left}
              rightPane={snapshot.paneLayout.right}
              leftOverride={{
                networkId: viewNetworkId ?? selectedNetwork ?? HOME_NETWORK_ID,
                url: activeUrl || snapshot.paneLayout.left.url, // fallback to backend URL
                prefetch: prefetchEntries,
                onPrefetchStatusChange: (status) => {
                  const [prev, next, nextTwo] = prefetchEntries;
                  setPrefetchStatus({
                    prevReady: prev ? !!status[prev.networkId] : false,
                    nextReady: next ? !!status[next.networkId] : false,
                    nextTwoReady: nextTwo ? !!status[nextTwo.networkId] : false
                  });
                },
                onRegisterReload: (fn) => {
                  reloadRef.current = fn;
                },
                onReload: () => reloadRef.current?.()
              }}
              rightOverride={{ url: lnUrl }}
              prefetchStatus={prefetchStatus}
              leftExtras={mockToggle}
            />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
