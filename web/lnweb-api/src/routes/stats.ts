// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import express, { Request, Response, Router } from "express";

const networksInfo = require("../utils/networks-info.js");

type BagsInfoRequest = Request<{ uniqueId: string }>;
type SummaryRequest = Request<{ networkId?: string }>;

type RouterHandler = (req: SummaryRequest, res: Response) => Promise<void>;

function createSummaryHandler(): RouterHandler {
  return async (req: SummaryRequest, res: Response) => {
    try {
      const { networkId } = req.params;
      const allNetworks: Array<{ uniqueId: string; districtId?: string }> = await networksInfo.getAllNetworks();
      const memberCountByNetwork = await networksInfo.getAllMemberCounts();

      const memberCountAll = Array.from(memberCountByNetwork.values()).reduce<number>((total, count) => {
        return total + (typeof count === "number" ? count : 0);
      }, 0);

      let memberCountNetwork = 0;
      let districtName = "";
      let numNetworksInDistrict = 0;
      let memberCountDistrict = 0;

      const normalizedNetworkId = networkId && networkId !== "all" ? networkId : null;
      const selectedNetwork = normalizedNetworkId
        ? (await networksInfo.findNetworkById(normalizedNetworkId)) ??
          (await networksInfo.findNetworkByShortId(normalizedNetworkId))
        : null;

      if (selectedNetwork) {
        const districtId: string | undefined = selectedNetwork.districtId;
        const networkValue = memberCountByNetwork.get(selectedNetwork.uniqueId);
        memberCountNetwork = typeof networkValue === "number" ? networkValue : 0;

        if (districtId) {
          const districtNetworks = allNetworks.filter((network) => network.districtId === districtId);
          numNetworksInDistrict = districtNetworks.length;
          memberCountDistrict = districtNetworks.reduce<number>((total, network) => {
            const count = memberCountByNetwork.get(network.uniqueId);
            return total + (typeof count === "number" ? count : 0);
          }, 0);

          const district = await networksInfo.findDistrictById(districtId);
          districtName = district?.fullName ?? "";
        }
      }

      res.json({
        memberCountNetwork,
        numNetworksInDistrict,
        memberCountDistrict,
        districtName,
        numNetworksInAll: allNetworks.length,
        memberCountAll,
      });
    } catch (error) {
      console.error("Error retrieving stats summary:", error);
      res.status(500).json({ error: "An error occurred while fetching the stats summary" });
    }
  };
}

function initializeRoutes(): Router {
  const router = express.Router();

  router.get("/get-bags-info/:uniqueId", async (req: BagsInfoRequest, res: Response) => {
    try {
      const { uniqueId } = req.params;
      const bagsInfo = await networksInfo.getBagsInfo(uniqueId);
      res.json(bagsInfo);
    } catch (error) {
      console.error("Error retrieving bag info:", error);
      res.status(500).json({ error: "An error occurred while fetching the data" });
    }
  });

  const summaryHandler = createSummaryHandler();
  router.get("/summary", summaryHandler);
  router.get("/summary/:networkId", summaryHandler);

  router.get("/get-bag-stats-json/:uniqueId", async (req: BagsInfoRequest, res: Response) => {
    try {
      const { uniqueId } = req.params;
      const bagsInfo = await networksInfo.getBagsInfo(uniqueId);
      res.json(bagsInfo.bagCounts);
    } catch (error) {
      console.error("Error retrieving legacy bag stats:", error);
      res.status(500).json({ error: "An error occurred while fetching the data" });
    }
  });

  return router;
}

const statsRouter = initializeRoutes();
export = statsRouter;
