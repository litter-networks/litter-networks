// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

export type MonthlyServiceCost = {
  service: string;
  usageType: string;
  costs: Record<string, number>;
  totalCost: number;
};

export type MonthlyCostsReport = {
  services: MonthlyServiceCost[];
  totalCosts: Record<string, number>;
  months: string[];
};
