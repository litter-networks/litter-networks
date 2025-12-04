// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { CloudFrontClient, CreateInvalidationCommand, waitUntilInvalidationCompleted } from "@aws-sdk/client-cloudfront";
import { fromIni } from "@aws-sdk/credential-providers";
import os from "node:os";
import crypto from "node:crypto";

export enum BagMode {
  Mock = "mock",
  Stage = "stage",
  Prod = "prod"
}

export type ApplyBagCountPayload = {
  networkId: string;
  bagCount: number;
  districtIds: string[];
};

type ModeConfig = {
  entriesTable?: string;
  countsTable?: string;
  cloudfrontDistributionId?: string;
};

const BAG_MODE: BagMode = BagMode.Prod;

const AWS_REGION = process.env.AWS_REGION ?? "eu-west-2";
const AWS_PROFILE = process.env.AWS_PROFILE ?? "ln";

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: AWS_REGION,
    credentials: fromIni({ profile: AWS_PROFILE })
  })
);

const defaultCloudFrontClient = new CloudFrontClient({
  region: AWS_REGION,
  credentials: fromIni({ profile: AWS_PROFILE })
});

const MODE_CONFIG: Record<Exclude<BagMode, BagMode.Mock>, ModeConfig> = {
  [BagMode.Prod]: {
    entriesTable: "LN-BagCountEntries",
    countsTable: "LN-BagCounts",
    cloudfrontDistributionId: "E38XGOGM7XNRC5"
  },
  [BagMode.Stage]: {
    entriesTable: "LN-BagCountEntries-Stage",
    countsTable: "LN-BagCounts-Stage",
    cloudfrontDistributionId: "E11STAGING0000"
  }
};

const GBS_START = new Date("2025-03-21T00:00:00Z");
const GBS_END = new Date("2025-04-06T23:59:59Z");

const toBagCountsTimeDate = (date: Date) =>
  date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

const getMonthAndYearNames = () => {
  const currentDate = new Date();
  const thisMonthName = currentDate.toLocaleString("default", { month: "short" });
  const thisYearName = currentDate.getFullYear().toString();

  const lastMonthDate = new Date(currentDate);
  lastMonthDate.setDate(1);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthName = lastMonthDate.toLocaleString("default", { month: "short" });

  const lastYearDate = new Date(currentDate);
  lastYearDate.setDate(1);
  lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
  const lastYearName = lastYearDate.getFullYear().toString();

  return { thisMonthName, thisYearName, lastMonthName, lastYearName };
};

const isInGBSBDateRange = (date: Date) => date >= GBS_START && date <= GBS_END;

type AggregateRecord = {
  uniqueId: string;
  allTime: number;
  thisYear: number;
  lastYear: number;
  thisMonth: number;
  lastMonth: number;
  gbsc: number;
  mostRecentPost?: string;
  statsCreatedTime?: string;
  lastMonthName?: string;
  thisMonthName?: string;
  lastYearName?: string;
  thisYearName?: string;
};

export class BagCountService {
  private mode: BagMode = BAG_MODE;
  private mockEntries: Array<{ id: string; payload: ApplyBagCountPayload; timestamp: number }> = [];

  constructor(
    private cloudFrontClient = defaultCloudFrontClient,
    private waitForInvalidation = waitUntilInvalidationCompleted
  ) {}

  getMode() {
    return this.mode;
  }

  async apply(payload: ApplyBagCountPayload) {
    if (!payload.networkId) {
      throw new Error("NetworkId required for bag count entry.");
    }
    if (payload.bagCount < 0) {
      throw new Error("Bag count cannot be negative.");
    }
    if (!Number.isFinite(payload.bagCount)) {
      throw new Error("Bag count must be a non-negative finite number.");
    }

    if (this.mode === BagMode.Mock) {
      this.recordMockEntry(payload);
      return { mode: this.mode, mockCount: this.mockEntries.length };
    }

    const config = MODE_CONFIG[this.mode as Exclude<BagMode, BagMode.Mock>];
    if (!config.entriesTable || !config.countsTable) {
      throw new Error(`Bag count tables not configured for mode ${this.mode}`);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    await this.putEntry(config.entriesTable, payload, timestamp);
    await this.rebuildAggregates(config.entriesTable, config.countsTable);

    if (config.cloudfrontDistributionId) {
      await this.invalidateCloudfront(config.cloudfrontDistributionId);
    }

    return { mode: this.mode, keysUpdated: 0 };
  }

  async getStats(networkId: string) {
    if (this.mode === BagMode.Mock) {
      return {
        all: { total: 0, session: 0, lastUpdated: undefined },
        network: { total: 0, session: 0, lastUpdated: undefined }
      };
    }

    const config = MODE_CONFIG[this.mode as Exclude<BagMode, BagMode.Mock>];
    if (!config.countsTable) {
      throw new Error("Counts table not configured.");
    }

    const [allItem, networkItem] = await Promise.all([
      this.fetchCountRow(config.countsTable, "all"),
      this.fetchCountRow(config.countsTable, networkId)
    ]);

    const formatRow = (item?: { thisYear?: number; mostRecentPost?: string }) => ({
      session: Number(item?.thisYear ?? 0),
      lastUpdated: item?.mostRecentPost
    });

    return {
      all: formatRow(allItem),
      network: formatRow(networkItem)
    };
  }

  private recordMockEntry(payload: ApplyBagCountPayload) {
    this.mockEntries.push({
      id: crypto.randomUUID(),
      payload,
      timestamp: Date.now()
    });
    if (this.mockEntries.length > 1000) {
      this.mockEntries.shift();
    }
  }

  private async putEntry(tableName: string, payload: ApplyBagCountPayload, timestamp: number) {
    const document = {
      uniqueId: timestamp.toString(),
      bagCount: Number(payload.bagCount.toFixed(1)),
      networkId: payload.networkId,
      dataSource: "LitterNetworker-V2",
      appliedBy: os.userInfo().username,
      createdAt: new Date(timestamp * 1000).toISOString()
    };

    await dynamoClient.send(
      new PutCommand({
        TableName: tableName,
        Item: document
      })
    );
  }

  private async rebuildAggregates(entriesTable: string, countsTable: string) {
    type EntryRow = { uniqueId?: string; bagCount?: number; networkId?: string; createdAt?: string };
    type DistrictRow = { uniqueId?: string; districtId?: string };

    const [entries, networksInfo] = await Promise.all([
      this.scanTable<EntryRow>(entriesTable),
      this.scanTable<DistrictRow>("LN-NetworksInfo")
    ]);

    const districtMap = new Map<string, string[]>();
    networksInfo.forEach((row) => {
      if (!row.uniqueId) return;
      const ids = (row.districtId ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      districtMap.set(row.uniqueId, ids);
    });

    type Aggregation = {
      total: number;
      mostRecent: number;
      thisYear: number;
      lastYear: number;
      thisMonth: number;
      lastMonth: number;
      gbsc: number;
    };

    const bagCounts = new Map<string, Aggregation>();
    const upsert = (key: string) => {
      let agg = bagCounts.get(key);
      if (!agg) {
        agg = { total: 0, mostRecent: 0, thisYear: 0, lastYear: 0, thisMonth: 0, lastMonth: 0, gbsc: 0 };
        bagCounts.set(key, agg);
      }
      return agg;
    };

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    entries.forEach((entry) => {
      const networkId = entry.networkId;
      const amount = Number(entry.bagCount ?? 0);
      if (!networkId || Number.isNaN(amount)) return;
      const timestamp = this.parseTimestamp(entry);
      if (!timestamp) return;
      const date = new Date(timestamp * 1000);
      const postYear = date.getFullYear();
      const postMonth = date.getMonth() + 1;
      const districtIds = districtMap.get(networkId) ?? [];
      const keys = this.buildAggregateKeys(districtIds, networkId);

      keys.forEach((key) => {
        const agg = upsert(key);
        agg.total += amount;
        if (timestamp > agg.mostRecent) {
          agg.mostRecent = timestamp;
        }
        if (postYear === currentYear) {
          agg.thisYear += amount;
        }
        if (postYear === currentYear - 1) {
          agg.lastYear += amount;
        }
        if (postYear === currentYear && postMonth === currentMonth) {
          agg.thisMonth += amount;
        }
        if (postYear === lastMonthYear && postMonth === lastMonth) {
          agg.lastMonth += amount;
        }
        if (isInGBSBDateRange(date)) {
          agg.gbsc += amount;
        }
      });
    });

    const monthNames = getMonthAndYearNames();
    for (const [key, info] of bagCounts.entries()) {
      const record: AggregateRecord = {
        uniqueId: key,
        allTime: info.total,
        thisYear: info.thisYear,
        lastYear: info.lastYear,
        thisMonth: info.thisMonth,
        lastMonth: info.lastMonth,
        gbsc: info.gbsc,
        thisMonthName: monthNames.thisMonthName,
        lastMonthName: monthNames.lastMonthName,
        thisYearName: monthNames.thisYearName,
        lastYearName: monthNames.lastYearName,
        mostRecentPost: info.mostRecent ? toBagCountsTimeDate(new Date(info.mostRecent * 1000)) : undefined,
        statsCreatedTime: toBagCountsTimeDate(new Date())
      };

      await dynamoClient.send(
        new PutCommand({
          TableName: countsTable,
          Item: record
        })
      );
    }
  }

  private buildAggregateKeys(districtIds: string[], networkId: string) {
    const keys = new Set<string>();
    keys.add("all");
    keys.add(networkId);
    districtIds
      .map((id) => id.trim())
      .filter(Boolean)
      .forEach((id) => keys.add(id));
    return Array.from(keys);
  }

  private async scanTable<T>(tableName: string): Promise<T[]> {
    const items: T[] = [];
    let ExclusiveStartKey: Record<string, any> | undefined;
    do {
      const response = await dynamoClient.send(
        new ScanCommand({
          TableName: tableName,
          ExclusiveStartKey
        })
      );
      if (response.Items) {
        items.push(...(response.Items as T[]));
      }
      ExclusiveStartKey = response.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
  }

  private parseTimestamp(entry: { uniqueId?: string; createdAt?: string }): number | null {
    if (entry.uniqueId && /^\d+$/.test(entry.uniqueId)) {
      return Number(entry.uniqueId);
    }
    if (entry.createdAt) {
      const parsed = Date.parse(entry.createdAt);
      if (!Number.isNaN(parsed)) {
        return Math.floor(parsed / 1000);
      }
    }
    return null;
  }

  private async fetchCountRow(table: string, key: string) {
    const result = await dynamoClient.send(
      new GetCommand({
        TableName: table,
        Key: { uniqueId: key }
      })
    );
    return result.Item as { thisYear?: number; mostRecentPost?: string } | undefined;
  }

  async invalidateDistribution(distributionId: string) {
    if (!distributionId) {
      throw new Error("DistributionId is required for invalidation.");
    }
    await this.invalidateCloudfront(distributionId);
  }

  private async invalidateCloudfront(distributionId: string) {
    const command = new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `${distributionId}-${Date.now()}`,
        Paths: {
          Quantity: 1,
          Items: ["/*"]
        }
      }
    });

    const response = await this.cloudFrontClient.send(command);
    const invalidationId = response.Invalidation?.Id;
    if (!invalidationId) {
      throw new Error("CloudFront invalidation did not return an Id.");
    }

    await this.waitForInvalidation(
      { client: this.cloudFrontClient, maxWaitTime: 300, minDelay: 5 },
      { DistributionId: distributionId, Id: invalidationId }
    );
  }
}
