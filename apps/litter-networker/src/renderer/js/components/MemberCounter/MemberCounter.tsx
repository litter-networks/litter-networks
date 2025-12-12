// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import widgetStyles from "../WidgetBase/styles/WidgetBase.module.css";

type Props = {
  inputValue: number;
  onChange: (next: number) => void;
  memberCount: number | null;
  sinceLabel: string;
  onApply: () => void;
  onAdvance: () => void;
  applying: boolean;
};

const MemberCounter = ({ inputValue, onChange, memberCount, sinceLabel, onApply, onAdvance, applying }: Props) => {
  const adjust = (delta: number) => {
    onChange(Math.max(0, Math.round(inputValue + delta)));
  };
  const disabled = applying;

  return (
    <div className={widgetStyles.widgetInline}>
      <div className={widgetStyles.stats}>
        <div className={widgetStyles.titleRow}>
          <span className={widgetStyles.title}>Member Count</span>
        </div>
        <div className={widgetStyles.statRow}>
          <span className={widgetStyles.eyebrow}>Last Count {memberCount?.toFixed(0) ?? "0"}</span>
        </div>
        <div className={widgetStyles.sinceRow}>
          <span className={widgetStyles.eyebrow}>as of {sinceLabel}</span>
        </div>
      </div>
      <div className={widgetStyles.controls}>
        <button className={widgetStyles.deltaButton} onClick={() => adjust(-5)}>
          -5
        </button>
        <button className={widgetStyles.deltaButton} onClick={() => adjust(-1)}>
          -1
        </button>
        <input value={inputValue.toFixed(0)} readOnly aria-label="Member count entry" />
        <button className={widgetStyles.deltaButton} onClick={() => adjust(1)}>
          +1
        </button>
        <button className={widgetStyles.deltaButton} onClick={() => adjust(5)}>
          +5
        </button>
        <button
          className={`${widgetStyles.cta} ${widgetStyles.ctaGo}`}
          aria-label="Apply member count and go to next network"
          onClick={onAdvance}
          disabled={disabled}
        >
          ✓+►
        </button>
        <button
          className={`${widgetStyles.cta} ${widgetStyles.ctaTick}`}
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
