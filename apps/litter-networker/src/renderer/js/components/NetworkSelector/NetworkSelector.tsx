// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import styles from "./styles/NetworkSelector.module.css";

type Props = {
  options: Array<{ id: string; label: string }>;
  value?: string;
  onChange: (value: string) => void;
};

const NetworkSelector = ({ options, value, onChange }: Props) => (
  <div className={styles.selector}>
    <select value={value ?? ""} onChange={(event) => onChange(event.target.value)} aria-label="Active network">
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

export default NetworkSelector;
