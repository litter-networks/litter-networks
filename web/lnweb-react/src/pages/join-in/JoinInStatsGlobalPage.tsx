// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { fetchGlobalStatsTable, type GlobalStatsRow } from '@/data-sources/stats';
import { usePageTitle } from '@/shared/hooks/usePageTitle';
import styles from './styles/join-in-stats-global.module.css';

type SortDirection = 'asc' | 'desc';

type SortConfig = {
  key: string;
  direction: SortDirection;
};

type Column = {
  key: string;
  label: string;
  align?: 'left' | 'right';
  isNumeric?: boolean;
  getValue: (row: GlobalStatsRow) => string;
  getSortValue: (row: GlobalStatsRow) => string | number;
};

const DEFAULT_SORT: SortConfig = { key: 'fullName', direction: 'asc' };

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const numberFormatter = new Intl.NumberFormat();

const formatNumber = (value: unknown) => {
  const parsed = toNumber(value);
  return numberFormatter.format(parsed);
};

const formatMemberCount = (value: number | null) => {
  if (value === null || value === undefined) return '-';
  return formatNumber(value);
};

const formatText = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const formatDate = (value: unknown) => {
  if (!value) return '-';
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }
  return String(value);
};

const withLabel = (label: string, suffix?: string) => (suffix ? `${label} (${suffix})` : label);

/**
 * Renders a global stats table combining bag counts and member counts.
 */
export function JoinInStatsGlobalPage() {
  usePageTitle('Join In | Stats | Global');

  const [rows, setRows] = useState<GlobalStatsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortConfig>(DEFAULT_SORT);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchGlobalStatsTable();
        if (!cancelled) {
          setRows(data.rows ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load global stats table', err);
          setError('Unable to load global stats at the moment.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const monthLabels = useMemo(() => {
    const first = rows[0]?.bagCounts;
    return {
      thisMonthName: first?.thisMonthName ?? '',
      lastMonthName: first?.lastMonthName ?? '',
      thisYearName: first?.thisYearName ?? '',
      lastYearName: first?.lastYearName ?? '',
    };
  }, [rows]);

  const columns = useMemo<Column[]>(
    () => [
      {
        key: 'statType',
        label: 'Type',
        getValue: (row) => formatText(row.statType),
        getSortValue: (row) => row.statType ?? '',
      },
      {
        key: 'fullName',
        label: 'Full Name',
        getValue: (row) => formatText(row.fullName ?? row.uniqueId),
        getSortValue: (row) => row.fullName ?? row.uniqueId ?? '',
      },
      {
        key: 'uniqueId',
        label: 'Unique ID',
        getValue: (row) => formatText(row.uniqueId),
        getSortValue: (row) => row.uniqueId ?? '',
      },
      {
        key: 'districtName',
        label: 'District',
        getValue: (row) => formatText(row.districtName ?? row.districtId),
        getSortValue: (row) => row.districtName ?? row.districtId ?? '',
      },
      {
        key: 'memberCount',
        label: 'Members',
        align: 'right',
        isNumeric: true,
        getValue: (row) => formatMemberCount(row.memberCount),
        getSortValue: (row) => row.memberCount ?? -1,
      },
      {
        key: 'thisMonth',
        label: withLabel('This Month', monthLabels.thisMonthName),
        align: 'right',
        isNumeric: true,
        getValue: (row) => formatNumber(row.bagCounts.thisMonth),
        getSortValue: (row) => toNumber(row.bagCounts.thisMonth),
      },
      {
        key: 'lastMonth',
        label: withLabel('Last Month', monthLabels.lastMonthName),
        align: 'right',
        isNumeric: true,
        getValue: (row) => formatNumber(row.bagCounts.lastMonth),
        getSortValue: (row) => toNumber(row.bagCounts.lastMonth),
      },
      {
        key: 'thisYear',
        label: withLabel('This Year', monthLabels.thisYearName),
        align: 'right',
        isNumeric: true,
        getValue: (row) => formatNumber(row.bagCounts.thisYear),
        getSortValue: (row) => toNumber(row.bagCounts.thisYear),
      },
      {
        key: 'lastYear',
        label: withLabel('Last Year', monthLabels.lastYearName),
        align: 'right',
        isNumeric: true,
        getValue: (row) => formatNumber(row.bagCounts.lastYear),
        getSortValue: (row) => toNumber(row.bagCounts.lastYear),
      },
      {
        key: 'allTime',
        label: 'All Time',
        align: 'right',
        isNumeric: true,
        getValue: (row) => formatNumber(row.bagCounts.allTime),
        getSortValue: (row) => toNumber(row.bagCounts.allTime),
      },
      {
        key: 'statsCreatedTime',
        label: 'Stats Created',
        getValue: (row) => formatDate(row.bagCounts.statsCreatedTime),
        getSortValue: (row) => {
          const raw = row.bagCounts.statsCreatedTime;
          if (typeof raw === 'number') return raw;
          if (typeof raw === 'string') return raw;
          return '';
        },
      },
    ],
    [monthLabels],
  );

  const filteredRows = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.statType,
        row.fullName,
        row.uniqueId,
        row.shortId,
        row.districtId,
        row.districtName,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return haystack.some((value) => value.includes(query));
    });
  }, [filter, rows]);

  const sortedRows = useMemo(() => {
    const column = columns.find((col) => col.key === sort.key) ?? columns[0];
    const sorted = [...filteredRows].sort((a, b) => {
      const left = column.getSortValue(a);
      const right = column.getSortValue(b);
      if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
      }
      return String(left).localeCompare(String(right));
    });
    if (sort.direction === 'desc') {
      sorted.reverse();
    }
    return sorted;
  }, [columns, filteredRows, sort.direction, sort.key]);

  const toggleSort = (key: string) => {
    setSort((current) => {
      const column = columns.find((col) => col.key === key);
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: column?.isNumeric ? 'desc' : 'asc' };
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>
            Join In | <b>Stats</b> | Global
          </h1>
        </div>
        <div className={styles.controls}>
          <label className={styles.filterLabel}>
            Search
            <input
              className={styles.filterInput}
              type="search"
              value={filter}
              placeholder="Filter by network, district, or ID"
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
        </div>
      </div>

      {loading && <p className={styles.status}>Loading global stats…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && (
        <div className={styles.tableWrap}>
          <div className={styles.tableMeta}>
            <span>
              Showing {sortedRows.length.toLocaleString()} of {rows.length.toLocaleString()} networks
            </span>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((column) => {
                  const isActive = sort.key === column.key;
                  const direction = isActive ? (sort.direction === 'asc' ? '▲' : '▼') : '';
                  return (
                    <th key={column.key} className={column.align === 'right' ? styles.alignRight : undefined}>
                      <button type="button" className={styles.sortButton} onClick={() => toggleSort(column.key)}>
                        {column.label} {direction}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.uniqueId}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.align === 'right' ? styles.alignRight : undefined}>
                      {column.getValue(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
