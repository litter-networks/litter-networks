// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import { BagCountService } from "../bagCounts";
import { CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";

describe("BagCountService", () => {
  it("sends a CloudFront invalidation when configured", async () => {
    const send = vi.fn(() => Promise.resolve({ Invalidation: { Id: "ABC123" } }));
    const wait = vi.fn(() => Promise.resolve({ state: "SUCCESS" } as any));
    const fakeClient = { send } as any;
    const service = new BagCountService(fakeClient, wait);

    await service.invalidateDistribution("E38XGOGM7XNRC5");

    expect(send).toHaveBeenCalledWith(expect.any(CreateInvalidationCommand));
    expect(wait).toHaveBeenCalledWith(
      expect.objectContaining({ client: fakeClient }),
      { DistributionId: "E38XGOGM7XNRC5", Id: "ABC123" }
    );
  });
});
