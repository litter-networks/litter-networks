// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import NodeCache from "node-cache";
import fetch from "node-fetch";
import format from "date-fns/format/index.js";
import startOfMonth from "date-fns/startOfMonth/index.js";
import subMonths from "date-fns/subMonths/index.js";
import { fromIni } from "@aws-sdk/credential-providers";
import type { MonthlyCostsReport } from "../../shared/costs";

const AWS_REGION = process.env.AWS_REGION ?? "eu-west-2";
const AWS_PROFILE = process.env.AWS_PROFILE ?? "ln";
const memoryCache = new NodeCache({ stdTTL: 300 });
const FALLBACK_USD_GBP = 0.78942;

const SERVICE_ABBREVIATIONS: Record<string, string> = {
  "Amazon Elastic Compute Cloud - Compute": "EC2 Compute",
  "Amazon Virtual Private Cloud": "Amazon VPC",
  "Amazon Simple Storage Service": "Amazon S3"
};

const formatMonth = (date: Date) => format(startOfMonth(date), "MMMM yyyy");
const buildDateRange = (date: Date) => ({
  startDate: format(startOfMonth(date), "yyyy-MM-dd"),
  endDate: format(startOfMonth(subMonths(date, -1)), "yyyy-MM-dd")
});

type RawCostRow = {
  Service: string;
  UsageType: string;
  Month: string;
  Cost: number;
};

const abbreviateServiceName = (serviceName: string) => {
  const [mainPart, ...remainder] = serviceName.split(":");
  const abbreviatedMainPart = SERVICE_ABBREVIATIONS[mainPart] ?? mainPart;
  return remainder.length ? `${abbreviatedMainPart}:${remainder.join(":")}` : abbreviatedMainPart;
};

const getCostsForPeriod = async (startDate: string, endDate: string): Promise<RawCostRow[]> => {
  const client = new CostExplorerClient({
    region: AWS_REGION,
    credentials: fromIni({ profile: AWS_PROFILE })
  });
  const command = new GetCostAndUsageCommand({
    TimePeriod: { Start: startDate, End: endDate },
    Granularity: "MONTHLY",
    Metrics: ["UnblendedCost"],
    GroupBy: [
      { Type: "DIMENSION", Key: "SERVICE" },
      { Type: "DIMENSION", Key: "USAGE_TYPE" }
    ],
    Filter: {
      Not: {
        Dimensions: {
          Key: "RECORD_TYPE",
          Values: ["Credit", "Refund"]
        }
      }
    }
  });

  try {
    const response = await client.send(command);
    const results = response.ResultsByTime?.[0]?.Groups ?? [];
    const data: RawCostRow[] = [];
    results.forEach((group) => {
      const [service = "", usageType = ""] = group.Keys ?? [];
      const rawCost = Number(group.Metrics?.UnblendedCost?.Amount ?? 0);
      const cost = Math.round(rawCost * 100) / 100;
      if (cost > 0) {
        data.push({
          Service: abbreviateServiceName(service),
          UsageType: usageType,
          Month: "",
          Cost: cost
        });
      }
    });

    // Attach Month information (AWS only returns one monthly bucket)
    const month = startDate ? format(new Date(startDate), "MMMM yyyy") : "";
    data.forEach((row) => {
      row.Month = month;
    });

    return data;
  } catch (error) {
    console.error("Failed to fetch cost data from Cost Explorer", error);
    return [];
  }
};

const getCostsFromDynamoDB = async (month: string): Promise<RawCostRow[] | null> => {
  const client = new DynamoDBClient({
    region: AWS_REGION,
    credentials: fromIni({ profile: AWS_PROFILE })
  });
  const command = new GetItemCommand({
    TableName: "LN-Costs",
    Key: {
      uniqueId: { S: month }
    }
  });

  try {
    const response = await client.send(command);
    const item = response.Item;
    if (!item) {
      return null;
    }
    if (item.expiryTime?.N) {
      const expiryTime = parseInt(item.expiryTime.N, 10);
      const now = Math.floor(Date.now() / 1000);
      if (now > expiryTime) {
        console.log(`Cache expired for ${month}`);
        return null;
      }
    }
    const stored = item.costsData?.S;
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as RawCostRow[];
  } catch (error) {
    console.error("Failed to read cost cache from DynamoDB", error);
    return null;
  }
};

const saveCostsToDynamoDB = async (month: string, costsData: RawCostRow[], ttlSeconds: number | null) => {
  const client = new DynamoDBClient({
    region: AWS_REGION,
    credentials: fromIni({ profile: AWS_PROFILE })
  });
  const item: Record<string, any> = {
    uniqueId: { S: month },
    costsData: { S: JSON.stringify(costsData) }
  };
  if (ttlSeconds) {
    const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;
    item.expiryTime = { N: ttl.toString() };
  }
  try {
    await client.send(
      new PutItemCommand({
        TableName: "LN-Costs",
        Item: item
      })
    );
  } catch (error) {
    console.error("Failed to save cost cache to DynamoDB", error);
  }
};

const getExchangeRate = async (): Promise<number> => {
  try {
    const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    const payload = await response.json();
    return payload?.rates?.GBP ?? FALLBACK_USD_GBP;
  } catch (error) {
    console.error("Failed to fetch exchange rate", error);
    return FALLBACK_USD_GBP;
  }
};

export class CostService {
  async getMonthlyCosts(): Promise<MonthlyCostsReport | null> {
    const now = new Date();
    const monthNames: string[] = [];
    const dateRanges: { startDate: string; endDate: string }[] = [];

    const firstDayOfCurrentMonth = startOfMonth(now);
    for (let delta = 2; delta >= 0; delta -= 1) {
      const targetDate = subMonths(firstDayOfCurrentMonth, delta);
      monthNames.push(formatMonth(targetDate));
      dateRanges.push(buildDateRange(targetDate));
    }

    const exchangeRatePromise = getExchangeRate();

    const aggregated: RawCostRow[] = [];

    const tasks: Array<Promise<RawCostRow[]>> = dateRanges.map(async ({ startDate, endDate }, index) => {
      const month = monthNames[index];
      const cached = (memoryCache.get(month) as RawCostRow[]) ?? null;
      if (cached) {
        return cached;
      }
      let data = await getCostsFromDynamoDB(month);
      if (data) {
        memoryCache.set(month, data);
        return data;
      }

      const fetched = await getCostsForPeriod(startDate, endDate);
      if (fetched.length > 0) {
        fetched.forEach((row) => {
          row.Month = month;
        });
        if (index === 2) {
          await saveCostsToDynamoDB(month, fetched, 3 * 3600);
        } else {
          await saveCostsToDynamoDB(month, fetched, null);
        }
        memoryCache.set(month, fetched);
        return fetched;
      }

      return [];
    });

    const results = await Promise.all(tasks);
    results.forEach((portion: RawCostRow[]) => {
      if (portion.length > 0) {
        aggregated.push(...portion);
      }
    });

    if (aggregated.length === 0) {
      return null;
    }

    const servicesMap = new Map<string, { Service: string; UsageType: string; Costs: Record<string, number>; TotalCost: number }>();
    aggregated.forEach((entry) => {
      const key = `${entry.Service}||${entry.UsageType}`;
      if (!servicesMap.has(key)) {
        servicesMap.set(key, {
          Service: entry.Service,
          UsageType: entry.UsageType,
          Costs: {},
          TotalCost: 0
        });
      }
      const target = servicesMap.get(key)!;
      target.Costs[entry.Month] = (target.Costs[entry.Month] ?? 0) + entry.Cost;
      target.TotalCost += entry.Cost;
    });

    const servicesData = Array.from(servicesMap.values()).filter((service) => service.TotalCost > 0);
    if (servicesData.length === 0) {
      return null;
    }

    const exchangeRate = await exchangeRatePromise;
    if (!exchangeRate) {
      return null;
    }

    servicesData.forEach((service) => {
      monthNames.forEach((month) => {
        const cost = service.Costs[month] ?? 0;
        const converted = Math.round(cost * exchangeRate * 100) / 100;
        service.Costs[month] = converted;
      });
      service.TotalCost = Math.round(service.TotalCost * exchangeRate * 100) / 100;
    });

    servicesData.sort((a, b) => b.TotalCost - a.TotalCost);

    const totalCosts: Record<string, number> = {};
    monthNames.forEach((month) => {
      totalCosts[month] = 0;
    });
    servicesData.forEach((service) => {
      monthNames.forEach((month) => {
        totalCosts[month] += service.Costs[month] ?? 0;
      });
    });

    return {
      services: servicesData.map((service) => ({
        service: service.Service,
        usageType: service.UsageType,
        costs: monthNames.reduce<Record<string, number>>((acc, month) => {
          acc[month] = service.Costs[month] ?? 0;
          return acc;
        }, {}),
        totalCost: service.TotalCost
      })),
      totalCosts,
      months: [...monthNames]
    };
  }
}
