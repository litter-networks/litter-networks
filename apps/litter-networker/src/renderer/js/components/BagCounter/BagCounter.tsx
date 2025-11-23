import styles from "./styles/BagCounter.module.css";

type Props = {
  inputValue: number;
  onChange: (next: number) => void;
  sessionCount: number;
  totalLabel: string;
  lastUpdated?: string;
  onApply: (advance: boolean) => void;
  applying: boolean;
};

const BagCounter = ({ inputValue, onChange, sessionCount, totalLabel, lastUpdated, onApply, applying }: Props) => {
  const adjust = (delta: number) => {
    onChange(Math.max(0, +(inputValue + delta).toFixed(1)));
  };
  const disabled = applying;

  return (
    <div className={styles.bagInline}>
      <div className={styles.stats}>
        <span className={styles.eyebrow}>{totalLabel}</span>
        <span className={styles.eyebrow}>This {sessionCount.toFixed(1)}</span>
        <span className={styles.eyebrow}>Updated {lastUpdated ?? "--"}</span>
      </div>
      <div className={styles.controls}>
        <button className={styles.deltaButton} onClick={() => adjust(-5)}>
          -5
        </button>
        <button className={styles.deltaButton} onClick={() => adjust(-1)}>
          -1
        </button>
        <input value={inputValue.toFixed(1)} readOnly aria-label="Bag count entry" />
        <button className={styles.deltaButton} onClick={() => adjust(1)}>
          +1
        </button>
        <button className={styles.deltaButton} onClick={() => adjust(5)}>
          +5
        </button>
        <button
          className={`${styles.cta} ${styles.ctaGo}`}
          onClick={() => onApply(true)}
          disabled={disabled}
          aria-label="Apply and go to next network"
        >
          ✓+►
        </button>
        <button
          className={`${styles.cta} ${styles.ctaTick}`}
          aria-label="Apply bag count"
          onClick={() => onApply(false)}
          disabled={disabled}
        >
          ✓
        </button>
      </div>
    </div>
  );
};

export default BagCounter;
