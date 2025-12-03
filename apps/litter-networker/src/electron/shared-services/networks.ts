import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, UpdateCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import type { NetworkRow, NetworksResponse } from "../../shared/networks";

const AWS_REGION = process.env.AWS_REGION ?? "eu-west-2";
const AWS_PROFILE = process.env.AWS_PROFILE ?? "ln";
const CDN_BUCKET = process.env.CDN_BUCKET ?? "lnweb-public";
const NETWORKS_INFO_TABLE = "LN-NetworksInfo";
const NETWORKS_MAP_TABLE = "LN-NetworksMapInfo";
const NETWORKS_PROXIMITY_TABLE = "LN-NetworksProximityInfo";

const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: AWS_REGION,
    credentials: fromIni({ profile: AWS_PROFILE })
  })
);

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: fromIni({ profile: AWS_PROFILE })
});

const preferredHeaders = ["uniqueId", "shortId", "districtId", "fullName", "logoName"];

const simplifyItem = (item: Record<string, any>): NetworkRow => {
  const simplified: NetworkRow = {};
  Object.keys(item).forEach((key) => {
    const field = item[key];
    const value = Object.values(field)[0];
    simplified[key] = typeof value === "string" ? value : `${value}`;
  });
  return simplified;
};

const scanTable = async (tableName: string): Promise<NetworkRow[]> => {
  const rows: NetworkRow[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;
  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey
      })
    );
    if (response.Items) {
      rows.push(...(response.Items.map(simplifyItem) ?? []));
    }
    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return rows;
};

const mergeRows = (info: NetworkRow[], mapInfo: NetworkRow[]): NetworkRow[] => {
  const data: Record<string, NetworkRow> = {};
  info.forEach((item) => {
    data[item.uniqueId] = { ...(item as NetworkRow) };
  });
  mapInfo.forEach((item) => {
    const existing = data[item.uniqueId];
    data[item.uniqueId] = existing ? { ...existing, ...item } : { ...item };
  });
  return Object.values(data);
};

const getHeadersFromDataFields = (rows: NetworkRow[]): string[] => {
  const union = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((key) => union.add(key)));
  const fixed = preferredHeaders.filter((h) => union.has(h));
  const remaining = Array.from(union).filter((key) => !fixed.includes(key));
  remaining.sort();
  return [...fixed, ...remaining];
};

const MAP_TABLE_FIELDS = new Set(["mapFile", "mapSource"]);

export class NetworksService {
  async getNetworks(): Promise<NetworksResponse> {
    const [infoRows, mapRows] = await Promise.all([scanTable(NETWORKS_INFO_TABLE), scanTable(NETWORKS_MAP_TABLE)]);
    const merged = mergeRows(infoRows, mapRows);
    merged.sort((a, b) => (a.uniqueId ?? "").localeCompare(b.uniqueId ?? ""));
    const headers = getHeadersFromDataFields(merged);
    return { headers, rows: merged };
  }

  async updateRow(uniqueId: string, changes: Record<string, string>): Promise<void> {
    const updates: Record<string, Record<string, string>> = {
      [NETWORKS_INFO_TABLE]: {},
      [NETWORKS_MAP_TABLE]: {}
    };

    for (const [key, value] of Object.entries(changes)) {
      const trimmed = value.trim();
      const targetTable = MAP_TABLE_FIELDS.has(key) ? NETWORKS_MAP_TABLE : NETWORKS_INFO_TABLE;
      updates[targetTable][key] = trimmed;
    }

    for (const [table, payload] of Object.entries(updates)) {
      if (!table || Object.keys(payload).length === 0) {
        continue;
      }
      const expressionParts: string[] = [];
      const attributeNames: Record<string, string> = {};
      const attributeValues: Record<string, any> = {};
      let counter = 0;
      for (const [key, value] of Object.entries(payload)) {
        counter += 1;
        const nameKey = `#attr${counter}`;
        const valueKey = `:val${counter}`;
        expressionParts.push(`${nameKey} = ${valueKey}`);
        attributeNames[nameKey] = key;
        attributeValues[valueKey] = value;
      }
      const updateExpression = `SET ${expressionParts.join(", ")}`;
      await documentClient.send(
        new UpdateCommand({
          TableName: table,
          Key: { uniqueId },
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: attributeNames,
          ExpressionAttributeValues: attributeValues
        })
      );
    }
  }

  async addRow(uniqueId: string, newRow: Record<string, string>): Promise<void> {
    const item: Record<string, any> = { uniqueId };
    Object.entries(newRow).forEach(([key, value]) => {
      if (key === "uniqueId") return;
      item[key] = value;
    });
    try {
      await documentClient.send(
        new PutCommand({
          TableName: NETWORKS_INFO_TABLE,
          Item: item
        })
      );
    } catch (error) {
      console.error("NetworksService.addRow failed", error);
      throw error;
    }
  }

  async deleteRow(uniqueId: string): Promise<void> {
    const tables = [NETWORKS_INFO_TABLE, NETWORKS_MAP_TABLE, NETWORKS_PROXIMITY_TABLE];
    await Promise.all(
      tables.map((tableName) =>
        documentClient.send(
          new DeleteCommand({
            TableName: tableName,
            Key: { uniqueId }
          })
        )
      )
    );
  }

  async listMapFiles(mapSource: string): Promise<string[]> {
    const prefix = `maps/${mapSource}/`;
    const results: string[] = [];
    let ContinuationToken: string | undefined;
    do {
      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: CDN_BUCKET,
          Prefix: prefix,
          ContinuationToken
        })
      );
      const keys =
        response.Contents?.map((item) => item.Key)
          .filter((key): key is string => Boolean(key))
          .map((key) => key.replace(prefix, ""))
          .filter((key) => key && !key.endsWith("/")) ?? [];
      results.push(...keys);
      ContinuationToken = response.NextContinuationToken;
    } while (ContinuationToken);
    return Array.from(new Set(results)).sort();
  }
}
