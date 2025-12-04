// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from "react";
import TabBar, { type TabItem } from "../TabBar/TabBar";
import BrowsePage from "../../pages/Browse/BrowsePage";
import CostsPage from "../../pages/Costs/CostsPage";
import NetworksPage from "../../pages/Networks/NetworksPage";
import ContentPage from "../../pages/Content/ContentPage";
import PlaceholderPage from "../../pages/Placeholder/PlaceholderPage";
import styles from "./styles/App.module.css";
import { useAppSnapshot } from "../../data-sources/useAppSnapshot";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";

const App = () => {
  const { snapshot, loading, error } = useAppSnapshot();
  const tabs: TabItem[] = snapshot?.tabs ?? [];
  const fullTabs: TabItem[] = useMemo(() => {
    if (tabs.some((tab) => tab.id === "browse")) {
      return tabs;
    }
    return [{ id: "browse", label: "Browse" }, ...tabs];
  }, [tabs]);
  const [activeTab, setActiveTab] = useState<string>(fullTabs[0]?.id ?? "browse");

  useEffect(() => {
    if (fullTabs.length > 0 && !fullTabs.find((tab) => tab.id === activeTab)) {
      setActiveTab(fullTabs[0].id);
    }
  }, [fullTabs, activeTab]);

  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(["browse"]));

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  return (
    <div className={styles.appShell}>
      <div className={styles.tabShell}>
        {loading ? (
          <div className={styles.loadingState}>Loading workspace…</div>
        ) : error ? (
          <div className={styles.loadingState}>
            <div>
              <p>Unable to load workspace.</p>
              <small>{error}</small>
            </div>
          </div>
        ) : snapshot?.metadata?.error ? (
          <div className={styles.loadingState}>
            <div>
              <p>Unable to load workspace.</p>
              <small>{snapshot.metadata.error}</small>
            </div>
          </div>
        ) : (
          <>
            <ErrorBoundary name="TabBar">
              <TabBar tabs={fullTabs} activeTab={activeTab} onSelect={setActiveTab} />
            </ErrorBoundary>
            <div className={styles.pageContainer}>
              {fullTabs.map((tab) =>
                mountedTabs.has(tab.id) ? (
                  <div
                    key={tab.id}
                    className={styles.tabPanel}
                    style={{ display: activeTab === tab.id ? "flex" : "none" }}
                  >
                    <ErrorBoundary name={`${tab.label} Page`}>
                      {tab.id === "browse" ? (
                        <BrowsePage />
                      ) : tab.id === "costs" ? (
                        <CostsPage />
                      ) : tab.id === "networks" ? (
                        <NetworksPage />
                      ) : tab.id === "content" ? (
                        <ContentPage />
                      ) : (
                        <PlaceholderPage name={tab.label} />
                      )}
                    </ErrorBoundary>
                  </div>
                ) : null
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
