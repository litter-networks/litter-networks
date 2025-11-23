import NetworkSelector from "../NetworkSelector/NetworkSelector";
import styles from "./styles/NetworkNavigation.module.css";

type Option = { id: string; label: string };
type PrefetchStatus = { prevReady?: boolean; nextReady?: boolean; nextTwoReady?: boolean };

type Props = {
  options: Option[];
  value?: string;
  onChange: (id: string) => void;
  arrowLockEnabled: boolean;
  onToggleArrowLock: () => void;
  prefetchStatus: PrefetchStatus;
};

export default function NetworkNavigation({
  options,
  value,
  onChange,
  arrowLockEnabled,
  onToggleArrowLock,
  prefetchStatus
}: Props) {
  return (
    <div className={styles.navShell}>
      <div className={styles.selector}>
        <NetworkSelector options={options} value={value} onChange={onChange} />
      </div>
      <button
        type="button"
        className={`featureToggleButton ${arrowLockEnabled ? "featureToggleButtonActive" : ""}`}
        onClick={onToggleArrowLock}
      >◄ | ►</button>
      <div className={styles.prefetch}>
        <span className={styles.label}>Prev</span>
        <span className={`${styles.dot} ${prefetchStatus.prevReady ? styles.dotReady : ""}`} />
        <span className={styles.label}>Next</span>
        <div className={styles.nextDots}>
          <span className={`${styles.dot} ${prefetchStatus.nextReady ? styles.dotReady : ""}`} />
          <span className={`${styles.dot} ${prefetchStatus.nextTwoReady ? styles.dotReady : ""}`} />
        </div>
      </div>
    </div>
  );
}
