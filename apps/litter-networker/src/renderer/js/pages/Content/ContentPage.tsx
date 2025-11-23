import { useEffect, useMemo, useState, useRef } from "react";
import { useAppSnapshot } from "../../data-sources/useAppSnapshot";
import { useContentJob } from "../../data-sources/useContentJob";
import styles from "./styles/ContentPage.module.css";

/**
 * Renders the Content Generator page that lets the user select a target network, start or cancel content-generation jobs, and view live job logs.
 *
 * Displays a network selector (including "All networks"), action buttons for "Generate Missing Content", "Force Generate All", and "Cancel" (enabled only while a job is running), and a summary with a live-scrolling log pane that auto-scrolls to the bottom when logs update.
 *
 * @returns The React element for the Content Generator page.
 */
export default function ContentPage() {
  const { snapshot } = useAppSnapshot();
  const { networks = [] } = snapshot ?? { networks: [] };
  const { logs, running, summary, run, stop } = useContentJob();
  const [selectedNetwork, setSelectedNetwork] = useState<string>(networks[0]?.id ?? "");

  const friendlyNetworks = useMemo(
    () =>
      networks.filter((network) => network.id !== "all").map((network) => ({
        value: network.id,
        label: network.displayLabel
      })),
    [networks]
  );

  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className={styles.pageShell}>
      <div className={styles.pageSurface}>
        <header className={styles.header}>
          <div>
            <p className={styles.pageTitle}>Content Generator</p>
            <p className={styles.pageSubtitle}>Run the LNUtils generation jobs.</p>
          </div>
        </header>
        <section className={styles.formRow}>
          <label htmlFor="network" className={styles.label}>
            Target Network
          </label>
          <select
            id="network"
            value={selectedNetwork}
            onChange={(event) => setSelectedNetwork(event.target.value)}
            className={styles.input}
          >
            <option value="">All networks</option>
            {friendlyNetworks.map((network) => (
              <option key={network.value} value={network.value}>
                {network.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${styles.primaryButton} ${running ? styles.disabledButton : ""}`}
            disabled={running}
            onClick={() => run({ networkId: selectedNetwork || undefined })}
          >
            Generate Missing Content
          </button>
          <button
            type="button"
            className={`${styles.secondaryButton} ${running ? styles.disabledButton : ""}`}
            disabled={running}
            onClick={() => run({ networkId: selectedNetwork || undefined, force: true })}
          >
            Force Generate All
          </button>
          <button
            type="button"
            className={`${styles.cancelButton} ${running ? "" : styles.disabledButton}`}
            onClick={stop}
            disabled={!running}
          >
            Cancel
          </button>
        </section>
        <section className={styles.logs}>
          <p className={styles.logsTitle}>{summary}</p>
          <div ref={logRef} className={styles.logPane} data-empty={logs.length === 0}>
            {logs.length === 0 ? <p className={styles.message}>No activity yet.</p> : null}
            {logs.map((log, index) => (
              <pre key={`${index}-${log}`} className={styles.logLine}>
                {log}
              </pre>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
