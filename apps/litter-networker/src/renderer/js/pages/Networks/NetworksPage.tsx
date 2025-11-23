import type { NetworksResponse } from "@shared/networks";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useNetworksData } from "../../data-sources/useNetworksData";
import styles from "./styles/NetworksPage.module.css";

type RowStatus = "idle" | "processing" | "success" | "error";

const getDetailHtml = (row: NetworksResponse["rows"][number]) => {
  const name = row.fullName ?? row.uniqueId ?? "";
  return [
    [
      "<strong>Welcome!</strong> You can find out more about this network, and browse other nearby networks, here:",
      `https://litternetworks.org/network/${row.uniqueId}`,
      "Please also carefully read our <strong>SAFETY ADVICE</strong> before taking part in any Litter Network activities:",
      "https://litternetworks.org/knowledge/safetyadvice"
    ],
    [
      `Welcome to "<span class="${styles.highlight}">${name} Litter Network</span>" - your community-run resource for reporting and volunteering to clean up litter problems in our amazing area!`,
      `Spotted a litter problem? Simply post on the "${name} Litter Network" Facebook group with as much info as you can - ideally including a description of the problem and where to find it, perhaps photos, and a map / what3words location.`,
      `Cleaned up some litter? Simply comment on the post it was reported on, or if your own ad-hoc route (perhaps your daily exercise route?), then please do let us know via a new post (again on the "${name} Litter Network" group) the route / area you've cleaned so others know it may not need doing again for a while (or that it may need checking again soon!)`,
      "If you are interested in taking part, we recommend you have at least a picker/grabber, hi-vis, strong gloves, and bin bags - safety first every time. For entry-level kit, Home Bargains and B&M Bargains are always worth a look, as is Amazon online (other suppliers are available - these are just a few handy examples). For pro-quality kit, check out industry-standard HH Environmental online. We at times have free kit available also, so it is well worth asking!",
      `For more information about us, including important Safety Advice, please browse to our web page: https://litternetworks.org/network/${row.uniqueId}`,
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

export default function NetworksPage() {
  const { data, loading, error, refresh } = useNetworksData();
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [modified, setModified] = useState<Record<string, Record<string, string>>>({});
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [addingStatus, setAddingStatus] = useState<RowStatus>("idle");
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const headers = data?.headers ?? [];
  const rows = data?.rows ?? [];
  const visibleRows = useMemo(() => {
    if (!filter) return rows;
    const needle = filter.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((value) => value.toLowerCase().includes(needle))
    );
  }, [filter, rows]);

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
      await window.appApi.updateNetworkRow?.({ uniqueId, changes });
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
      await window.appApi.addNetworkRow?.({ uniqueId: payload.uniqueId, newRow: payload });
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
          <thead>
            <tr>
              <th />
              <th />
              {headers.map((header) => (
                <th key={header}>{header}</th>
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
                  />
                </td>
              ))}
              <td />
            </tr>
            {visibleRows.map((row) => {
              const status = rowStatus[row.uniqueId] ?? "idle";
              const isModified = Boolean(modified[row.uniqueId]);
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
                        />
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
                                  await window.appApi.deleteNetworkRow?.(row.uniqueId);
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
