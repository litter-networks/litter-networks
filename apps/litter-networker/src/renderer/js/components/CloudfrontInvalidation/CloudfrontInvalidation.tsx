import { useCallback, useState } from "react";
import widgetStyles from "../WidgetBase/styles/WidgetBase.module.css";
import styles from "./styles/CloudfrontInvalidation.module.css";

const TARGETS = [
  { id: "web", label: "Web / API", distribution: "E38XGOGM7XNRC5" },
  { id: "cdn", label: "CDN", distribution: "EWXIG6ZADYHMA" }
];

type Props = {
  onInvalidate: (distributionId: string) => Promise<void>;
};

const CloudfrontInvalidation = ({ onInvalidate }: Props) => {
  const [running, setRunning] = useState<Record<string, boolean>>({});

  const trigger = useCallback(
    async (target: typeof TARGETS[number]) => {
      if (running[target.id]) return;
      setRunning((prev) => ({ ...prev, [target.id]: true }));
      try {
        await onInvalidate(target.distribution);
      } catch (error) {
        console.error("CloudFront invalidation failed", error);
      } finally {
        setRunning((prev) => ({ ...prev, [target.id]: false }));
      }
    },
    [onInvalidate, running]
  );

  return (
    <div className={`${widgetStyles.widgetInline} ${styles.widget}`}>
      <div className={widgetStyles.stats}>
        <div className={widgetStyles.titleRow}>
          <span className={widgetStyles.title}>Refresh Cloudfront</span>
        </div>
        <div className={styles.buttonRow}>
          {TARGETS.map((target) => {
            const isRunning = running[target.id];
            return (
              <button
                key={target.id}
                type="button"
                className={`${styles.button} ${isRunning ? styles.loading : ""}`}
                onClick={() => trigger(target)}
                disabled={isRunning}
              >
                <span className={styles.label}>{target.label}</span>
                {isRunning ? <span className={styles.spinner} aria-hidden="true">...</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CloudfrontInvalidation;
