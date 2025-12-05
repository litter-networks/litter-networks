// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient, DescribeTableCommand, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import type { TableItem, TableScanRequest, TableScanResult } from "../../shared/tables";

const AWS_REGION = process.env.AWS_REGION ?? "eu-west-2";
const AWS_PROFILE = process.env.AWS_PROFILE ?? "ln";

const lowLevelClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials: fromIni({ profile: AWS_PROFILE })
});

const documentClient = DynamoDBDocumentClient.from(lowLevelClient);

const encodeKey = (key?: Record<string, unknown> | null): string | null => {
  if (!key || Object.keys(key).length === 0) {
    return null;
  }
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64");
};

const decodeKey = (token?: string | null): Record<string, unknown> | undefined => {
  if (!token) return undefined;
  try {
    const json = Buffer.from(token, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.error("Failed to decode pagination token", error);
  }
  return undefined;
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return `${value}`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

type TableMeta = {
  primaryKeyAttributes: string[];
};

export class TablesService {
  private describeCache = new Map<string, TableMeta>();

  private async getTableMeta(tableName: string): Promise<TableMeta> {
    const cached = this.describeCache.get(tableName);
    if (cached) return cached;
    const response = await lowLevelClient.send(
      new DescribeTableCommand({
        TableName: tableName
      })
    );
    const keySchema = response.Table?.KeySchema ?? [];
    const primaryKeyAttributes = keySchema.map((entry) => entry.AttributeName ?? "").filter(Boolean);
    const meta = { primaryKeyAttributes };
    this.describeCache.set(tableName, meta);
    return meta;
  }

  async listTables(): Promise<string[]> {
    const tables: string[] = [];
    let ExclusiveStartTableName: string | undefined;
    do {
      const response = await lowLevelClient.send(
        new ListTablesCommand({
          ExclusiveStartTableName
        })
      );
      if (response.TableNames) {
        tables.push(...response.TableNames);
      }
      ExclusiveStartTableName = response.LastEvaluatedTableName;
    } while (ExclusiveStartTableName);
    tables.sort((a, b) => a.localeCompare(b));
    return tables;
  }

  private buildHeaders(items: TableItem[], primaryKeyAttributes: string[]) {
    const headerSet = new Set<string>(primaryKeyAttributes);
    items.forEach((item) => {
      Object.keys(item.values).forEach((key) => headerSet.add(key));
    });
    return Array.from(headerSet);
  }

  async scan(payload: TableScanRequest): Promise<TableScanResult> {
    const { tableName, limit = 100, nextToken } = payload;
    const ExclusiveStartKey = decodeKey(nextToken);
    const [{ primaryKeyAttributes }, response] = await Promise.all([
      this.getTableMeta(tableName),
      documentClient.send(
        new ScanCommand({
          TableName: tableName,
          Limit: limit,
          ExclusiveStartKey
        })
      )
    ]);

    const rawItems = (response.Items ?? []) as Record<string, unknown>[];
    const items: TableItem[] = rawItems.map((raw) => {
      const values: Record<string, string> = {};
      Object.entries(raw).forEach(([key, value]) => {
        values[key] = formatValue(value);
      });
      const key: Record<string, unknown> = {};
      primaryKeyAttributes.forEach((attr) => {
        if (raw[attr] !== undefined) {
          key[attr] = raw[attr];
        }
      });
      return {
        values,
        raw,
        key
      };
    });

    const headers = this.buildHeaders(items, primaryKeyAttributes);

    return {
      tableName,
      headers,
      primaryKeyAttributes,
      items,
      count: response.Count ?? items.length,
      scannedCount: response.ScannedCount ?? items.length,
      nextToken: encodeKey(response.LastEvaluatedKey as Record<string, unknown> | undefined)
    };
  }

  async putItem(tableName: string, item: Record<string, unknown>): Promise<void> {
    await documentClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item
      })
    );
  }

  async deleteItem(tableName: string, key: Record<string, unknown>): Promise<void> {
    if (!key || Object.keys(key).length === 0) {
      throw new Error("Cannot delete item without key attributes");
    }
    await documentClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: key
      })
    );
  }
}
