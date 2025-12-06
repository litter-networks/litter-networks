// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState, type UIEvent } from "react";
import type { TableItem, TableScanResult, TablePreferences, TableSortConfig } from "@shared/tables";
import styles from "./styles/TablesPage.module.css";

type RowStatus = "idle" | "processing" | "success" | "error";
type SortConfig = TableSortConfig;

const DEFAULT_LIMIT = 100;
const SCAN_BATCH_SIZE = 500;
const DEFAULT_SORT: SortConfig = { column: null, direction: "asc" };

const parseNumericValue = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const coerceValue = (input: string, original: unknown): unknown => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const normalize = (value: string) => value.toLowerCase();

  if (original !== undefined) {
    if (typeof original === "number") {
      const next = Number(trimmed);
      if (!Number.isNaN(next)) return next;
    } else if (typeof original === "boolean") {
      if (normalize(trimmed) === "true") return true;
      if (normalize(trimmed) === "false") return false;
    } else if (original === null) {
      if (normalize(trimmed) === "null") return null;
    } else if (Array.isArray(original) || typeof original === "object") {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
  }

  if (normalize(trimmed) === "null") return null;
  if (normalize(trimmed) === "true") return true;
  if (normalize(trimmed) === "false") return false;

  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // ignore parse failure and fall back to other heuristics
    }
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const next = Number(trimmed);
    if (!Number.isNaN(next)) return next;
  }

  return input;
};

const buildRowKey = (item: TableItem, index: number, tableName: string) => {
  const serializedKey = Object.keys(item.key).length > 0 ? JSON.stringify(item.key) : `row-${index}`;
  return `${tableName}:${serializedKey}`;
};

const getCellValue = (
  rowKey: string,
  header: string,
  item: TableItem,
  modified: Record<string, Record<string, string>>
) => {
  return modified[rowKey]?.[header] ?? item.values[header] ?? "";
};

const getNumericValueForSort = (
  rowKey: string,
  header: string,
  item: TableItem,
  modified: Record<string, Record<string, string>>
): number | null => {
  const fromRaw = parseNumericValue(item.raw[header]);
  if (fromRaw !== null) return fromRaw;
  const display = getCellValue(rowKey, header, item, modified);
  return parseNumericValue(display);
};

const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const getSortedHeaders = (result: TableScanResult | null, extras: string[]) => {
  if (!result) return extras;
  const { primaryKeyAttributes, headers } = result;
  const remaining = headers.filter((header) => !primaryKeyAttributes.includes(header));
  const extraHeaders = extras.filter(
    (header) => !primaryKeyAttributes.includes(header) && !remaining.includes(header)
  );
  return [...primaryKeyAttributes, ...remaining, ...extraHeaders];
};

export default function TablesPage() {
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [tableListLoading, setTableListLoading] = useState(true);
  const [tableListError, setTableListError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [scanResult, setScanResult] = useState<TableScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortConfig>(DEFAULT_SORT);
  const [prefsReady, setPrefsReady] = useState(false);
  const [modifiedRows, setModifiedRows] = useState<Record<string, Record<string, string>>>({});
  const [rowStatuses, setRowStatuses] = useState<Record<string, RowStatus>>({});
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [addingStatus, setAddingStatus] = useState<RowStatus>("idle");
  const [customColumns, setCustomColumns] = useState<Record<string, string[]>>({});
  const [visibleCount, setVisibleCount] = useState(DEFAULT_LIMIT);

  useEffect(() => {
    let cancelled = false;
    const loadPrefs = async () => {
      try {
        const prefs = (await window.appApi.getTablesPreferences?.()) as TablePreferences | null;
        if (cancelled || !prefs) return;
        if (typeof prefs.filter === "string") {
          setFilter(prefs.filter);
        }
        if (prefs.sort) {
          setSort(prefs.sort);
        }
        if (prefs.table) {
          setSelectedTable(prefs.table);
        }
      } catch (err) {
        console.error("Failed to load table preferences", err);
      } finally {
        if (!cancelled) {
          setPrefsReady(true);
        }
      }
    };

    loadPrefs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTableListLoading(true);
    setTableListError(null);
    window.appApi
      .listTables()
      .then((names) => {
        if (cancelled) return;
        setTableNames(names);
        setSelectedTable((prev) => {
          if (prev && names.includes(prev)) {
            return prev;
          }
          return names[0] ?? "";
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setTableListError(formatError(err));
      })
      .finally(() => {
        if (!cancelled) {
          setTableListLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCustomColumns = customColumns[selectedTable] ?? [];
  const headers = useMemo(
    () => getSortedHeaders(scanResult, activeCustomColumns),
    [scanResult, activeCustomColumns]
  );

  const numericColumns = useMemo(() => {
    const numeric = new Set<string>();
    if (!scanResult) return numeric;
    headers.forEach((header) => {
      const isNumeric = scanResult.items.every((item) => {
        const rawValue = item.raw[header];
        if (rawValue === undefined || rawValue === null || rawValue === "") {
          const display = item.values[header];
          if (display === undefined || display === null || display === "") {
            return true;
          }
          return parseNumericValue(display) !== null;
        }
        return parseNumericValue(rawValue) !== null;
      });
      if (isNumeric) {
        numeric.add(header);
      }
    });
    return numeric;
  }, [headers, scanResult]);

  useEffect(() => {
    const applyDefaultSort = () => {
      if (sort.column || headers.length === 0 || !scanResult) return;
      const primaryHeader = scanResult.primaryKeyAttributes[0] ?? headers[0];
      if (!primaryHeader) return;
      const isNumeric = numericColumns.has(primaryHeader);
      setSort({ column: primaryHeader, direction: isNumeric ? "desc" : "asc" });
    };

    setNewRow((prev) => {
      const next: Record<string, string> = {};
      headers.forEach((header) => {
        next[header] = prev[header] ?? "";
      });
      return next;
    });
    applyDefaultSort();
  }, [headers, numericColumns, scanResult, sort.column]);

  const fetchTable = useCallback(async () => {
    if (!selectedTable) return;
    setLoading(true);
    setError(null);
    setScanResult(null);
    setVisibleCount(DEFAULT_LIMIT);
    try {
      let nextToken: string | null = null;
      const items: TableItem[] = [];
      const headerSet = new Set<string>();
      let primaryKeyAttributes: string[] = [];
      let scannedCount = 0;
      do {
        const result = await window.appApi.scanTable({
          tableName: selectedTable,
          limit: SCAN_BATCH_SIZE,
          nextToken
        });
        result.items.forEach((item) => items.push(item));
        result.headers.forEach((header) => headerSet.add(header));
        primaryKeyAttributes = result.primaryKeyAttributes;
        scannedCount += result.scannedCount ?? result.items.length;
        nextToken = result.nextToken ?? null;
      } while (nextToken);
      primaryKeyAttributes.forEach((attr) => headerSet.add(attr));
      const headerList = Array.from(headerSet).sort((a, b) => a.localeCompare(b));
      setScanResult({
        tableName: selectedTable,
        headers: headerList,
        primaryKeyAttributes,
        items,
        count: items.length,
        scannedCount,
        nextToken: null
      });
      setModifiedRows({});
      setRowStatuses({});
    } catch (err) {
      setScanResult(null);
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedTable]);

  useEffect(() => {
    if (!selectedTable) return;
    fetchTable().catch((err) => setError(formatError(err)));
  }, [selectedTable, fetchTable]);

  const keyedItems = useMemo(() => {
    if (!scanResult) return [];
    return scanResult.items.map((item, index) => ({
      item,
      rowKey: buildRowKey(item, index, scanResult.tableName)
    }));
  }, [scanResult]);

  const visibleRows = useMemo(() => {
    const rows = [...keyedItems];
    if (filter.trim()) {
      const needle = filter.trim().toLowerCase();
      return rows.filter(({ item, rowKey }) => {
        return headers.some((header) => {
          const value = getCellValue(rowKey, header, item, modifiedRows);
          return value.toLowerCase().includes(needle);
        });
      });
    }
    return rows;
  }, [filter, headers, keyedItems, modifiedRows]);

  const sortedRows = useMemo(() => {
    if (!sort.column) return visibleRows;
    const sorted = [...visibleRows];
    const column = sort.column ?? "";
    const useNumeric = numericColumns.has(column);
    sorted.sort((a, b) => {
      if (useNumeric) {
        const leftNum = getNumericValueForSort(a.rowKey, column, a.item, modifiedRows);
        const rightNum = getNumericValueForSort(b.rowKey, column, b.item, modifiedRows);
        if (leftNum !== null || rightNum !== null) {
          if (leftNum === null) return sort.direction === "asc" ? 1 : -1;
          if (rightNum === null) return sort.direction === "asc" ? -1 : 1;
          const diff = leftNum - rightNum;
          if (diff === 0) return 0;
          return sort.direction === "asc" ? (diff > 0 ? 1 : -1) : diff > 0 ? -1 : 1;
        }
      }
      const left = getCellValue(a.rowKey, column, a.item, modifiedRows).toLowerCase();
      const right = getCellValue(b.rowKey, column, b.item, modifiedRows).toLowerCase();
      if (left === right) return 0;
      if (sort.direction === "asc") {
        return left > right ? 1 : -1;
      }
      return left < right ? 1 : -1;
    });
    return sorted;
  }, [visibleRows, sort, modifiedRows, numericColumns]);

  const handleSort = (header: string) => {
    setSort((prev) => {
      if (prev.column === header) {
        return { column: header, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      const isNumeric = numericColumns.has(header);
      return { column: header, direction: isNumeric ? "desc" : "asc" };
    });
  };

  const setCellValue = (rowKey: string, header: string, value: string) => {
    setModifiedRows((prev) => {
      const next = { ...prev };
      const row = { ...(next[rowKey] ?? {}) };
      row[header] = value;
      next[rowKey] = row;
      return next;
    });
  };

  const refreshCurrentPage = useCallback(() => {
    fetchTable().catch((err) => setError(formatError(err)));
  }, [fetchTable]);

  const commitRow = async (rowKey: string, item: TableItem) => {
    if (!selectedTable || !scanResult) return;
    const changes = modifiedRows[rowKey];
    if (!changes || Object.keys(changes).length === 0) return;
    const { primaryKeyAttributes } = scanResult;
    const nextItem: Record<string, unknown> = { ...item.raw };
    try {
      Object.entries(changes).forEach(([key, value]) => {
        const converted = coerceValue(value, item.raw[key]);
        if (converted === undefined) {
          delete nextItem[key];
        } else {
          nextItem[key] = converted;
        }
      });
      primaryKeyAttributes.forEach((attr) => {
        const value = nextItem[attr];
        if (value === undefined || value === null || value === "") {
          throw new Error(`Primary key "${attr}" is required.`);
        }
      });
    } catch (err) {
      window.alert(formatError(err));
      return;
    }
    setRowStatuses((prev) => ({ ...prev, [rowKey]: "processing" }));
    try {
      await window.appApi.putTableItem({ tableName: selectedTable, item: nextItem });
      setRowStatuses((prev) => ({ ...prev, [rowKey]: "success" }));
      setModifiedRows((prev) => {
        const next = { ...prev };
        delete next[rowKey];
        return next;
      });
      refreshCurrentPage();
    } catch (err) {
      console.error("Failed to update table row", err);
      setRowStatuses((prev) => ({ ...prev, [rowKey]: "error" }));
      window.alert(`Unable to update row: ${formatError(err)}`);
    }
  };

  const handleDeleteRow = async (item: TableItem) => {
    if (!selectedTable) return;
    const keyDescription = Object.entries(item.key)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(", ");
    const confirmed = window.confirm(
      `Delete item from ${selectedTable}?\n\nKeys: ${keyDescription || "(unknown)"}\n\nThis cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await window.appApi.deleteTableItem({ tableName: selectedTable, key: item.key });
      refreshCurrentPage();
    } catch (err) {
      console.error("Failed to delete table item", err);
      window.alert(`Unable to delete item: ${formatError(err)}`);
    }
  };

  const requiredFields = scanResult?.primaryKeyAttributes ?? [];
  const canAdd = requiredFields.every((field) => (newRow[field] ?? "").trim().length > 0);

  const handleAddRow = async () => {
    if (!selectedTable) return;
    if (!canAdd) {
      window.alert("Please populate all key attributes before adding a row.");
      return;
    }
    const payload: Record<string, unknown> = {};
    Object.entries(newRow).forEach(([key, value]) => {
      if ((value ?? "").trim().length === 0) return;
      payload[key] = coerceValue(value, undefined);
    });
    setAddingStatus("processing");
    try {
      await window.appApi.putTableItem({ tableName: selectedTable, item: payload });
      setAddingStatus("success");
      setNewRow((prev) => {
        const next: Record<string, string> = {};
        Object.keys(prev).forEach((key) => {
          next[key] = "";
        });
        return next;
      });
      refreshCurrentPage();
    } catch (err) {
      console.error("Failed to add table row", err);
      setAddingStatus("error");
      window.alert(`Unable to add row: ${formatError(err)}`);
    } finally {
      setTimeout(() => setAddingStatus("idle"), 800);
    }
  };

  const getButtonLabel = (status: RowStatus) => {
    if (status === "processing") return "Saving…";
    if (status === "success") return "Set";
    if (status === "error") return "Retry";
    return "Set";
  };

  const handleAddColumn = () => {
    if (!selectedTable) return;
    const name = window.prompt("New column name");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomColumns((prev) => {
      const existing = prev[selectedTable] ?? [];
      if (existing.includes(trimmed)) return prev;
      return {
        ...prev,
        [selectedTable]: [...existing, trimmed]
      };
    });
  };

  const renderStatus = () => {
    if (loading) return "Scanning entire table…";
    if (error) return error;
    if (!scanResult) return selectedTable ? "No rows loaded" : "Select a table";
    return `Fetched ${scanResult.items.length} rows (scanned ${scanResult.scannedCount}).`;
  };

  useEffect(() => {
    setVisibleCount((prev) => {
      const clamped = Math.max(DEFAULT_LIMIT, prev);
      return Math.min(sortedRows.length || DEFAULT_LIMIT, clamped);
    });
  }, [sortedRows.length]);

  useEffect(() => {
    setVisibleCount(DEFAULT_LIMIT);
  }, [filter, sort, selectedTable]);

  useEffect(() => {
    if (!prefsReady) return;
    const prefs: TablePreferences = {
      table: selectedTable || undefined,
      filter,
      sort
    };
    window.appApi
      .setTablesPreferences?.(prefs)
      ?.catch((err) => console.error("Failed to persist table preferences", err));
  }, [prefsReady, selectedTable, filter, sort]);

  const pagedRows = useMemo(() => {
    return sortedRows.slice(0, Math.min(visibleCount, sortedRows.length));
  }, [sortedRows, visibleCount]);

  const handleScrollLoadMore = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (loading) return;
      if (visibleCount >= sortedRows.length) return;
      const target = event.currentTarget;
      const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (remaining < 200) {
        setVisibleCount((prev) => Math.min(sortedRows.length, prev + DEFAULT_LIMIT));
      }
    },
    [sortedRows.length, visibleCount, loading]
  );

  return (
    <div className={styles.pageShell}>
      <div className={styles.pageSurface}>
        <header className={styles.header}>
          <div>
            <p className={styles.pageTitle}>Tables</p>
            <p className={styles.pageSubtitle}>
              Browse, filter, and edit DynamoDB tables with on-demand scans and inline editing.
            </p>
          </div>
          <div className={styles.actions}>
            <div className={styles.selectGroup}>
              {tableListLoading ? (
                <span className={styles.selectPlaceholder}>Loading tables…</span>
              ) : tableListError ? (
                <span className={styles.selectError}>{tableListError}</span>
              ) : (
                <select
                  className={styles.tableSelect}
                  value={selectedTable}
                  onChange={(event) => {
                    setSelectedTable(event.target.value);
                    setFilter("");
                    setSort({ column: null, direction: "asc" });
                    setVisibleCount(DEFAULT_LIMIT);
                  }}
                >
                  {tableNames.map((table) => (
                    <option key={table} value={table}>
                      {table}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <input
              type="text"
              className={styles.filter}
              placeholder="Filter rows…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <button type="button" className={styles.button} onClick={() => refreshCurrentPage()}>
              Refresh
            </button>
            <button type="button" className={styles.button} onClick={handleAddColumn} disabled={!selectedTable}>
              Add column
            </button>
          </div>
        </header>

        <div className={styles.tableToolbar}>
          <div className={styles.tableStatus}>{renderStatus()}</div>
        </div>

        <div className={styles.tableWrapper} onScroll={handleScrollLoadMore}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th />
                <th />
                {headers.map((header) => {
                  const isActive = sort.column === header;
                  const indicator = isActive ? (sort.direction === "asc" ? "↑" : "↓") : "-";
                  return (
                    <th key={header}>
                      <button type="button" className={styles.sortHeader} onClick={() => handleSort(header)}>
                        <span>{header}</span>
                        <span
                          className={styles.sortIndicator}
                          data-active={isActive ? "true" : "false"}
                          data-direction={isActive ? sort.direction : undefined}
                        >
                          {indicator}
                        </span>
                      </button>
                    </th>
                  );
                })}
                <th />
              </tr>
            </thead>
            <tbody>
              {selectedTable && headers.length > 0 && (
                <tr>
                  <td />
                  <td className={styles.actionCell}>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.commitButton}`}
                      onClick={handleAddRow}
                      disabled={!canAdd || addingStatus === "processing"}
                    >
                      {addingStatus === "processing" ? "Adding…" : "Add"}
                    </button>
                  </td>
                  {headers.map((header) => (
                    <td key={`new_${header}`}>
                      <input
                        className={styles.cellInput}
                        value={newRow[header] ?? ""}
                        onChange={(event) => setNewRow((prev) => ({ ...prev, [header]: event.target.value }))}
                        placeholder={`Enter ${header}`}
                      />
                    </td>
                  ))}
                  <td />
                </tr>
              )}
              {pagedRows.map(({ item, rowKey }) => {
                const status = rowStatuses[rowKey] ?? "idle";
                const hasChanges = Boolean(modifiedRows[rowKey]);
                const keyReady =
                  scanResult && Object.keys(item.key).length === scanResult.primaryKeyAttributes.length;
                return (
                  <tr key={rowKey}>
                    <td />
                    <td className={styles.actionCell}>
                      <button
                        type="button"
                        className={`${styles.button} ${styles.commitButton} ${
                          status === "processing" ? styles.buttonProcessing : ""
                        } ${status === "error" ? styles.buttonError : ""}`}
                        onClick={() => commitRow(rowKey, item)}
                        disabled={!hasChanges || status === "processing"}
                      >
                        {getButtonLabel(status)}
                      </button>
                    </td>
                    {headers.map((header) => (
                      <td key={`${rowKey}_${header}`}>
                        <input
                          className={`${styles.cellInput} ${
                            modifiedRows[rowKey] && modifiedRows[rowKey][header] !== undefined
                              ? styles.modifiedCell
                              : ""
                          }`}
                          value={getCellValue(rowKey, header, item, modifiedRows)}
                          onChange={(event) => setCellValue(rowKey, header, event.target.value)}
                        />
                      </td>
                    ))}
                    <td className={styles.actionCell}>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => handleDeleteRow(item)}
                        disabled={!keyReady}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && sortedRows.length === 0 && (
            <div className={styles.emptyState}>No rows match this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}
