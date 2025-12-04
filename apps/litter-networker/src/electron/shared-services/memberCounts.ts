// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";

const AWS_REGION = process.env.AWS_REGION ?? "eu-west-2";
const AWS_PROFILE = process.env.AWS_PROFILE ?? "ln";
const MEMBER_COUNTS_TABLE = "LN-MemberCounts";

const defaultDocumentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: AWS_REGION,
    credentials: fromIni({ profile: AWS_PROFILE })
  })
);

export type MemberCountEntry = {
  memberCount: number;
  sampleTime: number;
  dataSource?: string;
  reviewAdjustments?: unknown[];
};

export type ApplyMemberCountPayload = {
  networkId: string;
  memberCount: number;
  dataSource?: string;
  reviewAdjustments?: unknown[];
};

type DocumentClient = {
  send: (command: PutCommand | QueryCommand) => Promise<any>;
};

export class MemberCountService {
  constructor(private client: DocumentClient = defaultDocumentClient, private tableName = MEMBER_COUNTS_TABLE) {}

  async getLatestCount(networkId: string): Promise<MemberCountEntry | null> {
    if (!networkId) {
      throw new Error("Network ID is required to fetch member counts.");
    }

    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "uniqueId = :uid",
        ExpressionAttributeValues: {
          ":uid": networkId
        },
        ScanIndexForward: false,
        Limit: 1
      })
    );

    const items = response.Items as Array<Record<string, any>> | undefined;
    const item = items && items[0];
    if (!item) return null;

    return {
      memberCount: Number(item.memberCount ?? 0),
      sampleTime: Number(item.sampleTime ?? 0),
      dataSource: typeof item.dataSource === "string" ? item.dataSource : undefined,
      reviewAdjustments: Array.isArray(item.reviewAdjustments) ? item.reviewAdjustments : undefined
    };
  }

  async apply(payload: ApplyMemberCountPayload) {
    if (!payload.networkId) {
      throw new Error("NetworkId required for member count entry.");
    }
    if (!Number.isFinite(payload.memberCount) || payload.memberCount < 0) {
      throw new Error("Member count must be a non-negative finite number.");
    }

    const entry = {
      uniqueId: payload.networkId,
      memberCount: Math.round(payload.memberCount),
      sampleTime: Math.floor(Date.now() / 1000),
      dataSource: payload.dataSource ?? "LitterNetworker",
      reviewAdjustments: payload.reviewAdjustments ?? []
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: entry
      })
    );

    return entry;
  }
}
