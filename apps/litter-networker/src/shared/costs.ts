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
