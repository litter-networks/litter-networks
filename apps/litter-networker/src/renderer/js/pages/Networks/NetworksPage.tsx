// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import type { NetworksResponse } from "@shared/networks";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useNetworksData } from "../../data-sources/useNetworksData";
import styles from "./styles/NetworksPage.module.css";

type RowStatus = "idle" | "processing" | "success" | "error";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getDetailHtml = (row: NetworksResponse["rows"][number]) => {
  const rawName = row.fullName ?? row.uniqueId ?? "";
  const name = escapeHtml(rawName);
  const safeUniqueId = escapeHtml(row.uniqueId ?? "");
  return [
    [
      "<strong>Welcome!</strong> You can find out more about this network, and browse other nearby networks, here:",
      `https://litternetworks.org/network/${safeUniqueId}`,
      "Please also carefully read our <strong>SAFETY ADVICE</strong> before taking part in any Litter Network activities:",
      "https://litternetworks.org/knowledge/safetyadvice"
    ],
    [
      `Welcome to "<span class="${styles.highlight}">${name} Litter Network</span>" - your community-run resource for reporting and volunteering to clean up litter problems in our amazing area!`,
      `Spotted a litter problem? Simply post on the "${name} Litter Network" Facebook group with as much info as you can - ideally including a description of the problem and where to find it, perhaps photos, and a map / what3words location.`,
      `Cleaned up some litter? Simply comment on the post it was reported on, or if your own ad-hoc route (perhaps your daily exercise route?), then please do let us know via a new post (again on the "${name} Litter Network" group) the route / area you've cleaned so others know it may not need doing again for a while (or that it may need checking again soon!)`,
      "If you are interested in taking part, we recommend you have at least a picker/grabber, hi-vis, strong gloves, and bin bags - safety first every time. For entry-level kit, Home Bargains and B&M Bargains are always worth a look, as is Amazon online (other suppliers are available - these are just a few handy examples). For pro-quality kit, check out industry-standard HH Environmental online. We at times have free kit available also, so it is well worth asking!",
      `For more information about us, including important Safety Advice, please browse to our web page: https://litternetworks.org/network/${safeUniqueId}`,
      "Happy Picking!"
    ]
  ].map((paragraphs) =>
    paragraphs
      .map((paragraph) =>
        paragraph.includes("https://")
          ? `<p><a href="${paragraph}" target="_blank" rel="noreferrer">${paragraph}</a></p>`
          : `<p>${paragraph}</p>`
      )
      .join("")
  );
};

const getDetailBlocks = (row: NetworksResponse["rows"][number]) =>
  getDetailHtml(row).map((html) => ({ html }));

const CDN_BASE = "https://cdn.litternetworks.org/maps";

const leafletScriptUrl = "https://cdn.litternetworks.org/3rd-party/leaflet/leaflet.js";
const leafletCssUrl = "https://cdn.litternetworks.org/3rd-party/leaflet/leaflet.css";

let leafletPromise: Promise<void> | null = null;

const ensureLeaflet = () => {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).L) return Promise.resolve();
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<void>((resolve, reject) => {
    const cssId = "ln-leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = leafletCssUrl;
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = leafletScriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Leaflet"));
    document.body.appendChild(script);
  });

  return leafletPromise;
};

type MapPreviewProps = {
  mapSource?: string | null;
  mapFile?: string | null;
  uniqueId?: string | null;
};

function buildMapUrl({ mapSource, mapFile, uniqueId }: MapPreviewProps) {
  const source = (mapSource ?? "custom").trim();
  const fileName = (() => {
    if (!mapFile || mapFile === "-") {
      return uniqueId ? `${uniqueId}.json` : null;
    }
    return mapFile.trim();
  })();
  if (!source || !fileName) return null;
  return `${CDN_BASE}/${source}/${fileName}`;
}

function MapPreview({ mapSource, mapFile, uniqueId }: MapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const mapUrl = buildMapUrl({ mapSource, mapFile, uniqueId });
    let cancelled = false;

    const setup = async () => {
      if (!mapUrl || !containerRef.current) {
        return;
      }
      setStatus("loading");
      try {
        await ensureLeaflet();
        if (cancelled || !containerRef.current) return;
        const response = await fetch(mapUrl);
        if (!response.ok) throw new Error(`Failed to fetch map ${response.status}`);
        const geojson = await response.json();
        if (cancelled || !containerRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L: any = (window as typeof window & { L?: any }).L;
        if (!L) throw new Error("Leaflet unavailable");

        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: false
        });
        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19
        }).addTo(map);

        const layer = L.geoJSON(geojson);
        layer.addTo(map);
        if (layer.getBounds().isValid()) {
          map.fitBounds(layer.getBounds(), { padding: [12, 12] });
        }
        setStatus("idle");
      } catch (error) {
        console.error("Map preview failed", error);
        setStatus("error");
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapFile, mapSource, uniqueId]);

  const mapUrl = buildMapUrl({ mapSource, mapFile, uniqueId });
  if (!mapUrl) return null;

  return (
    <div className={styles.mapPreview}>
      <div className={styles.mapPreviewHeader}>Map preview</div>
      <div className={styles.mapPreviewFrame} ref={containerRef}>
        {status === "loading" && <div className={styles.mapPreviewOverlay}>Loading…</div>}
        {status === "error" && (
          <div className={styles.mapPreviewOverlay} data-state="error">
            Could not load map.
          </div>
        )}
        <div className={styles.mapAttribution}>© OpenStreetMap contributors · Leaflet</div>
      </div>
      <div className={styles.mapPreviewMeta}>
        <span>{mapSource ?? "custom"}</span>
        <span title={mapUrl}>{mapUrl.replace(CDN_BASE + "/", "")}</span>
      </div>
    </div>
  );
}

/**
 * Render the Networks page: an inline-editable table UI for viewing and managing network records.
 *
 * Presents a filterable list of network rows with per-row inline editing, per-row commit status indicators, an add-new-row form, delete actions, and expandable detail panels that render HTML blocks. Data is sourced from the networks data hook and mutations are performed via the host API; the component refreshes its data after successful changes.
 *
 * @returns The React element containing the networks table, controls, and detail drawers.
 */
export default function NetworksPage() {
  const { data, loading, error, refresh } = useNetworksData();
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [modified, setModified] = useState<Record<string, Record<string, string>>>({});
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [addingStatus, setAddingStatus] = useState<RowStatus>("idle");
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [isResizing, setIsResizing] = useState(false);
  const resizingRef = useRef<{ header: string; startX: number; startWidth: number } | null>(null);

  const headers = data?.headers ?? [];
  const rows = data?.rows ?? [];
  const visibleRows = useMemo(() => {
    if (!filter) return rows;
    const needle = filter.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((value) => value.toLowerCase().includes(needle))
    );
  }, [filter, rows]);

  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      headers.forEach((header) => {
        if (!next[header]) {
          next[header] = 180;
        }
      });
      return next;
    });
  }, [headers]);

  const mapFileOptionsBySource = useMemo(() => {
    const lookup: Record<string, string[]> = {};
    rows.forEach((row) => {
      const source = (row.mapSource ?? "custom").trim() || "custom";
      const file =
        row.mapFile && row.mapFile !== "-" ? row.mapFile.trim() : row.uniqueId ? `${row.uniqueId}.json` : null;
      if (!file) return;
      if (!lookup[source]) lookup[source] = [];
      if (!lookup[source].includes(file)) lookup[source].push(file);
    });
    Object.values(lookup).forEach((list) => list.sort());
    return lookup;
  }, [rows]);

  const [mapFileOptions, setMapFileOptions] = useState<Record<string, string[]>>({});
  const loadingMapSources = useRef<Set<string>>(new Set());

  const ensureMapFiles = useCallback(
    async (mapSource: string) => {
      const source = (mapSource ?? "custom").trim() || "custom";
      if (mapFileOptions[source] || loadingMapSources.current.has(source)) return;
      loadingMapSources.current.add(source);
      try {
        const files = await window.appApi.listMapFiles(source);
        if (Array.isArray(files)) {
          setMapFileOptions((prev) => ({ ...prev, [source]: files }));
        }
      } catch (error) {
        console.error("Failed to load map files", error);
      } finally {
        loadingMapSources.current.delete(source);
      }
    },
    [mapFileOptions]
  );

  const mapSources = useMemo(() => {
    const sources = new Set<string>();
    rows.forEach((row) => sources.add((row.mapSource ?? "custom").trim() || "custom"));
    return Array.from(sources);
  }, [rows]);

  useEffect(() => {
    mapSources.forEach((source) => {
      void ensureMapFiles(source);
    });
  }, [ensureMapFiles, mapSources]);

  const getMapFileOptions = (source: string, search: string) => {
    const options =
      mapFileOptions[source] ??
      mapFileOptionsBySource[source] ??
      [];
    if (search.trim().length < 3) return [];
    const needle = search.trim().toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(needle)).slice(0, 10);
  };

  const handleColumnResizeStart = useCallback(
    (header: string, event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startWidth = columnWidths[header] ?? 180;
      resizingRef.current = { header, startX: event.clientX, startWidth };
      setIsResizing(true);
    },
    [columnWidths]
  );

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const current = resizingRef.current;
      if (!current) return;
      const delta = event.clientX - current.startX;
      const nextWidth = Math.max(80, current.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [current.header]: nextWidth }));
    };

    const handleUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = null;
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  useEffect(() => {
    document.body.style.cursor = isResizing ? "col-resize" : "";
  }, [isResizing]);

  const baseRow = useMemo(() => {
    const base: Record<string, string> = {};
    headers.forEach((header) => {
      base[header] = "";
    });
    return base;
  }, [headers]);

  useEffect(() => {
    setNewRow(baseRow);
  }, [baseRow]);

  useEffect(() => {
    setModified({});
    setRowStatus({});
  }, [rows]);

  const handleCellChange = (uniqueId: string, header: string, value: string) => {
    setModified((prev) => {
      const next = { ...prev };
      const row = next[uniqueId] ?? {};
      row[header] = value;
      next[uniqueId] = row;
      return next;
    });
  };

  const commitChanges = async (uniqueId: string) => {
    const changes = modified[uniqueId];
    if (!changes || Object.keys(changes).length === 0) return;
    setRowStatus((prev) => ({ ...prev, [uniqueId]: "processing" }));
    try {
      await window.appApi.updateNetworkRow({ uniqueId, changes });
      setRowStatus((prev) => ({ ...prev, [uniqueId]: "success" }));
      setModified((prev) => {
        const next = { ...prev };
        delete next[uniqueId];
        return next;
      });
      await refresh();
    } catch {
      setRowStatus((prev) => ({ ...prev, [uniqueId]: "error" }));
    }
  };

  const requiredFields = ["uniqueId", "shortId", "districtId", "fullName"];

  const handleAddRow = async () => {
    const payload: Record<string, string> = {};
    headers.forEach((header) => {
      payload[header] = newRow[header] ?? "";
    });
    if (requiredFields.some((field) => !payload[field]?.trim())) return;
    setAddingStatus("processing");
    try {
      await window.appApi.addNetworkRow({ uniqueId: payload.uniqueId, newRow: payload });
      setAddingStatus("success");
      setNewRow(baseRow);
      await refresh();
    } catch (error) {
      console.error("Failed to add network", error);
      setAddingStatus("error");
      window.alert(`Unable to add network: ${error instanceof Error ? error.message : error}`);
    } finally {
      setTimeout(() => setAddingStatus("idle"), 1000);
    }
  };

  const getButtonLabel = (status: RowStatus) => {
    if (status === "processing") return "Saving…";
    if (status === "success") return "Set";
    if (status === "error") return "Retry";
    return "Set";
  };

  return (
    <div className={styles.pageShell}>
      <div className={styles.pageSurface}>
        <header className={styles.header}>
        <div>
          <p className={styles.pageTitle}>Edit Networks</p>
          <p className={styles.pageSubtitle}>Inline editing of the combined networks tables.</p>
        </div>
          <div className={styles.actions}>
            <input
              type="text"
              className={styles.filter}
              placeholder="Filter rows…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
        </header>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <colgroup>
              <col style={{ width: "40px" }} />
              <col style={{ width: "120px" }} />
              {headers.map((header) => (
                <col
                  key={`col_${header}`}
                  style={{ width: columnWidths[header] ? `${columnWidths[header]}px` : undefined }}
                />
              ))}
              <col style={{ width: "48px" }} />
            </colgroup>
            <thead>
              <tr>
                <th />
                <th />
                {headers.map((header) => (
                  <th key={header} className={styles.resizableHeader}>
                    <span>{header}</span>
                    <div
                      className={styles.columnResizer}
                      onMouseDown={(event) => handleColumnResizeStart(header, event)}
                      role="presentation"
                    />
                  </th>
                ))}
                <th />
              </tr>
            </thead>
          <tbody>
            <tr>
              <td />
              <td className={`${styles.actionCell} ${styles.addActionCell}`}>
                <button
                  type="button"
                  className={`featureToggleButton ${styles.button} ${styles.commitButton} ${styles.addButton}`}
                  onClick={handleAddRow}
                  disabled={!requiredFields.every((field) => (newRow[field] ?? "").trim())}
                >
                  Add
                </button>
              </td>
              {headers.map((header) => (
                <td key={`new_${header}`}>
                  <input
                    value={newRow[header] ?? ""}
                    onChange={(event) => setNewRow((prev) => ({ ...prev, [header]: event.target.value }))}
                    placeholder={`Enter ${header}`}
                    className={styles.cellInput}
                    list={header === "mapFile" ? "mapfile-new" : undefined}
                    onFocus={() => {
                      if (header === "mapFile") {
                        const source = (newRow.mapSource ?? "custom").trim() || "custom";
                        ensureMapFiles(source);
                      }
                    }}
                  />
                  {header === "mapFile" && (
                    <datalist id="mapfile-new">
                      {getMapFileOptions(
                        (newRow.mapSource ?? "custom").trim() || "custom",
                        (newRow.mapFile ?? "").trim()
                      ).map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  )}
                </td>
              ))}
              <td />
            </tr>
            {visibleRows.map((row) => {
              const status = rowStatus[row.uniqueId] ?? "idle";
              const isModified = Boolean(modified[row.uniqueId]);
              const effectiveMapSource =
                (modified[row.uniqueId]?.mapSource ?? row.mapSource ?? "custom").trim() || "custom";
              const effectiveMapFile =
                (modified[row.uniqueId]?.mapFile ?? row.mapFile ?? "").trim() ||
                (row.mapFile === "-" || !row.mapFile ? `${row.uniqueId}.json` : "");
              return (
                <Fragment key={row.uniqueId}>
                  <tr>
                    <td>
                      <button
                        type="button"
                        className={`featureToggleButton ${styles.infoButton} ${
                          openDetails.has(row.uniqueId) ? "featureToggleButtonActive" : ""
                        }`}
                        title="Toggle details"
                        onClick={() => {
                          setOpenDetails((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.uniqueId)) {
                              next.delete(row.uniqueId);
                            } else {
                              next.add(row.uniqueId);
                            }
                            return next;
                          });
                        }}
                      >
                        Info
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`featureToggleButton ${styles.button} ${styles.commitButton} ${
                          status === "processing" ? styles.buttonProcessing : ""
                        } ${status === "error" ? styles.buttonError : ""}`}
                        onClick={() => commitChanges(row.uniqueId)}
                        disabled={!isModified || status === "processing"}
                      >
                        {getButtonLabel(status)}
                      </button>
                    </td>
                    {headers.map((header) => (
                      <td key={header}>
                    <input
                      value={modified[row.uniqueId]?.[header] ?? row[header] ?? ""}
                      onChange={(event) => handleCellChange(row.uniqueId, header, event.target.value)}
                      className={`${styles.cellInput} ${
                        modified[row.uniqueId] && modified[row.uniqueId][header] ? styles.modifiedCell : ""
                      }`}
                      list={header === "mapFile" ? `mapfile-${row.uniqueId}` : undefined}
                      onFocus={() => {
                        if (header === "mapFile") {
                          const source =
                            (modified[row.uniqueId]?.mapSource ?? row.mapSource ?? "custom").trim() || "custom";
                          ensureMapFiles(source);
                        }
                      }}
                    />
                    {header === "mapFile" && (
                      <datalist id={`mapfile-${row.uniqueId}`}>
                        {getMapFileOptions(
                          (modified[row.uniqueId]?.mapSource ?? row.mapSource ?? "custom").trim() || "custom",
                          (modified[row.uniqueId]?.mapFile ?? row.mapFile ?? "").trim()
                        ).map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    )}
                  </td>
                ))}
                    <td className={styles.actionCell}>
                      <div className={styles.actionMenuWrapper}>
                        <button
                          type="button"
                          className={`featureToggleButton ${styles.menuToggle}`}
                          onClick={() => setMenuOpenId((prev) => (prev === row.uniqueId ? null : row.uniqueId))}
                        >
                          …
                        </button>
                        {menuOpenId === row.uniqueId && (
                          <div className={styles.actionMenu}>
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={async () => {
                                const confirmText = `Delete ${row.fullName ?? row.uniqueId}? This cannot be undone.`;
                                if (!window.confirm(confirmText)) return;
                                setMenuOpenId(null);
                                try {
                                  await window.appApi.deleteNetworkRow(row.uniqueId);
                                  await refresh();
                                } catch (error) {
                                  console.error("Failed to delete network", error);
                                  window.alert("Unable to delete network; see console for details.");
                                }
                              }}
                            >
                              Delete...
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr className={styles.detailRow} data-open={openDetails.has(row.uniqueId)}>
                    <td colSpan={headers.length + 2}>
                      <div
                        className={`${styles.detailDrawer} ${
                          openDetails.has(row.uniqueId) ? styles.detailDrawerOpen : ""
                        }`}
                      >
                        {getDetailBlocks(row).map((block, index) => (
                          <div key={`block-${index}`} className={styles.detailBlock}>
                            <div
                              className={styles.detailHtml}
                              dangerouslySetInnerHTML={{ __html: block.html }}
                            />
                          </div>
                        ))}
                        {buildMapUrl({
                          mapSource: effectiveMapSource,
                          mapFile: effectiveMapFile,
                          uniqueId: row.uniqueId
                        }) && (
                          <div className={`${styles.detailBlock} ${styles.mapPreviewBlock}`}>
                            <MapPreview
                              mapSource={effectiveMapSource}
                              mapFile={effectiveMapFile}
                              uniqueId={row.uniqueId}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      {loading && !data && <p className={styles.message}>Loading network data…</p>}
      {error && <p className={styles.message}>{error}</p>}
    </div>
  );
}
