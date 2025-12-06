// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import widgetStyles from "../WidgetBase/styles/WidgetBase.module.css";

type Props = {
  inputValue: number;
  onChange: (next: number) => void;
  sessionCount: number;
  totalLabel: string;
  sinceLabel?: string;
  onApply: (advance: boolean) => void;
  applying: boolean;
};

const BagCounter = ({ inputValue, onChange, sessionCount, totalLabel, sinceLabel, onApply, applying }: Props) => {
  const adjust = (delta: number) => {
    onChange(Math.max(0, +(inputValue + delta).toFixed(1)));
  };
  const disabled = applying;
  const sinceText = sinceLabel ?? "--";

  return (
    <div className={widgetStyles.widgetInline}>
      <div className={widgetStyles.stats}>
        <div className={widgetStyles.titleRow}>
          <span className={widgetStyles.title}>Bag Count</span>
        </div>
        <div className={widgetStyles.statRow}>
          <span className={widgetStyles.eyebrow}>{totalLabel}</span>
          <span className={widgetStyles.eyebrow}>This {sessionCount.toFixed(1)}</span>
        </div>
        <div className={widgetStyles.sinceRow}>
          <span className={widgetStyles.eyebrow}>Since {sinceText}</span>
        </div>
      </div>
      <div className={widgetStyles.controls}>
        <button className={widgetStyles.deltaButton} onClick={() => adjust(-5)}>
          -5
        </button>
        <button className={widgetStyles.deltaButton} onClick={() => adjust(-1)}>
          -1
        </button>
        <input value={inputValue.toFixed(1)} readOnly aria-label="Bag count entry" />
        <button className={widgetStyles.deltaButton} onClick={() => adjust(1)}>
          +1
        </button>
        <button className={widgetStyles.deltaButton} onClick={() => adjust(5)}>
          +5
        </button>
        <button
          className={`${widgetStyles.cta} ${widgetStyles.ctaGo}`}
          onClick={() => onApply(true)}
          disabled={disabled}
          aria-label="Apply and go to next network"
        >
          ✓+►
        </button>
        <button
          className={`${widgetStyles.cta} ${widgetStyles.ctaTick}`}
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
