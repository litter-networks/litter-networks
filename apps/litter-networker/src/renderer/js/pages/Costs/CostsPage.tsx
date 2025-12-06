// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react";
import { useCostsReport } from "../../data-sources/useCostsReport";
import styles from "./styles/CostsPage.module.css";

const formatCurrency = (value?: number) => `£${(value ?? 0).toFixed(2)}`;

/**
 * Render the Monthly AWS Costs page with a refresh control and a per-month costs table.
 *
 * Displays one of: a loading message, an error message, an empty-data message, or a table of services
 * with usage types and monthly costs (displayed in GBP rounded to two decimal places). The header
 * includes a Refresh button that triggers the data source refresh and is disabled while loading.
 *
 * @returns The page content as a JSX element.
 */
export default function CostsPage() {
  const { data, loading, error, refresh } = useCostsReport();
  const months = data?.months ?? [];
  const hasData = Boolean(data?.services.length);

  const columns = useMemo(() => {
    if (!months.length) return [];
    return ["Service", "Usage Type", ...months];
  }, [months]);

  return (
    <div className={styles.pageShell}>
      <div className={styles.pageSurface}>
        <header className={styles.header}>
          <div>
            <p className={styles.pageTitle}>Monthly AWS Costs</p>
            <p className={styles.pageSubtitle}>Converted to GBP & rounded to 2 decimal places</p>
          </div>
          <button type="button" className={styles.refreshButton} onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {loading && !data ? (
          <div className={styles.message}>Loading AWS cost data…</div>
        ) : error ? (
          <div className={styles.error}>Unable to load costs: {error}</div>
        ) : !hasData ? (
          <div className={styles.message}>No cost data available for the selected period.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} className={styles.tableHeader}>
                      {column}
                      {column === "Usage Type" && (
                        <span className={styles.subLabel}>per service/usage</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.services.map((service) => (
                  <tr key={`${service.service}-${service.usageType}`} className={styles.tableRow}>
                    <td className={styles.tableCell}>{service.service}</td>
                    <td className={styles.tableCell}>{service.usageType}</td>
                    {months.map((month) => (
                      <td key={`${service.service}-${service.usageType}-${month}`} className={styles.tableCell}>
                        {formatCurrency(service.costs[month])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className={`${styles.tableRow} ${styles.totalRow}`}>
                  <td className={styles.tableCell} colSpan={2}>
                    Total
                  </td>
                  {months.map((month) => (
                    <td key={`total-${month}`} className={styles.tableCell}>
                      {formatCurrency(data?.totalCosts[month])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
