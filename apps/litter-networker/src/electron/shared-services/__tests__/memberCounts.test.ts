// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { MemberCountService } from "../memberCounts";

class StubClient {
  public commands: Array<PutCommand | QueryCommand> = [];
  constructor(private queryResponse: unknown = { Items: [] }) {}

  async send(command: PutCommand | QueryCommand) {
    this.commands.push(command);
    if (command instanceof QueryCommand) {
      return this.queryResponse;
    }
    return {};
  }
}

describe("MemberCountService", () => {
  it("returns null when no entry exists", async () => {
    const client = new StubClient();
    const service = new MemberCountService(client, "test-table");
    const result = await service.getLatestCount("network-id");
    expect(result).toBeNull();
    expect(client.commands[0]).toBeInstanceOf(QueryCommand);
  });

  it("unwraps the latest member count entry", async () => {
    const client = new StubClient({
      Items: [
        {
          memberCount: 12,
          sampleTime: 123456,
          dataSource: "ln-web",
          reviewAdjustments: ["note"]
        }
      ]
    });
    const service = new MemberCountService(client, "test-table");
    const result = await service.getLatestCount("network-id");
    expect(result).toEqual({
      memberCount: 12,
      sampleTime: 123456,
      dataSource: "ln-web",
      reviewAdjustments: ["note"]
    });
  });

  it("persists a new member count entry", async () => {
    const client = new StubClient();
    const service = new MemberCountService(client, "table-name");
    const payload = { networkId: "network-id", memberCount: 5.8, dataSource: "manual" };
    const entry = await service.apply(payload);
    const putCommand = client.commands.find((cmd) => cmd instanceof PutCommand) as PutCommand | undefined;
    expect(putCommand).toBeDefined();
    expect(entry.memberCount).toBe(6);
    expect(entry.sampleTime).toBeGreaterThan(0);
    expect(putCommand?.input.TableName).toBe("table-name");
    expect(putCommand?.input.Item).toMatchObject({
      uniqueId: "network-id",
      memberCount: 6,
      dataSource: "manual",
      reviewAdjustments: []
    });
  });
});
