import bagStyles from "../BagCounter/styles/BagCounter.module.css";

type Props = {
  inputValue: number;
  onChange: (next: number) => void;
  memberCount: number | null;
  lastUpdatedLabel: string;
  onApply: () => void;
  applying: boolean;
};

const MemberCounter = ({
  inputValue,
  onChange,
  memberCount,
  lastUpdatedLabel,
  onApply,
  applying
}: Props) => {
  const adjust = (delta: number) => {
    onChange(Math.max(0, Math.round(inputValue + delta)));
  };
  const disabled = applying;

  return (
    <div className={bagStyles.bagInline}>
      <div className={bagStyles.stats}>
        <span className={bagStyles.eyebrow}>Registered {memberCount?.toFixed(0) ?? "0"}</span>
        <span className={bagStyles.eyebrow}>Updated {lastUpdatedLabel}</span>
      </div>
      <div className={bagStyles.controls}>
        <button className={bagStyles.deltaButton} onClick={() => adjust(-5)}>
          -5
        </button>
        <button className={bagStyles.deltaButton} onClick={() => adjust(-1)}>
          -1
        </button>
        <input value={inputValue.toFixed(0)} readOnly aria-label="Member count entry" />
        <button className={bagStyles.deltaButton} onClick={() => adjust(1)}>
          +1
        </button>
        <button className={bagStyles.deltaButton} onClick={() => adjust(5)}>
          +5
        </button>
        <button
          className={`${bagStyles.cta} ${bagStyles.ctaTick}`}
          aria-label="Apply member count"
          onClick={onApply}
          disabled={disabled}
        >
          ✓
        </button>
      </div>
    </div>
  );
};

export default MemberCounter;
