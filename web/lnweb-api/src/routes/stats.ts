// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import express, { Request, Response, Router } from "express";
import networksInfo, { type BagCountsRecord, type NetworkRecord } from "../utils/networks-info";

type BagsInfoRequest = Request<{ uniqueId: string }>;
type SummaryRequest = Request<{ networkId?: string }>;

type RouterHandler = (req: SummaryRequest, res: Response) => Promise<void>;

type BagCounts = {
  thisMonthName: string;
  thisMonth: number;
  lastMonthName: string;
  lastMonth: number;
  thisYearName: string;
  thisYear: number;
  lastYearName: string;
  lastYear: number;
  allTime: number;
  gbsc?: number;
  statsCreatedTime?: string | number | null;
  mostRecentPost?: string;
};

type GlobalStatsRow = {
  uniqueId: string;
  shortId?: string;
  fullName?: string;
  districtId?: string;
  districtName?: string;
  statType: "Network" | "District" | "Global";
  memberCount: number | null;
  bagCounts: BagCounts;
};

type GlobalStatsResponse = {
  generatedAt: string;
  rows: GlobalStatsRow[];
};

const normalizeNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const buildBagCounts = (record?: BagCountsRecord, template?: BagCountsRecord): BagCounts => ({
  thisMonthName: record?.thisMonthName ?? template?.thisMonthName ?? "",
  thisMonth: normalizeNumber(record?.thisMonth),
  lastMonthName: record?.lastMonthName ?? template?.lastMonthName ?? "",
  lastMonth: normalizeNumber(record?.lastMonth),
  thisYearName: record?.thisYearName ?? template?.thisYearName ?? "",
  thisYear: normalizeNumber(record?.thisYear),
  lastYearName: record?.lastYearName ?? template?.lastYearName ?? "",
  lastYear: normalizeNumber(record?.lastYear),
  allTime: normalizeNumber(record?.allTime),
  gbsc: record?.gbsc === undefined ? undefined : normalizeNumber(record?.gbsc),
  statsCreatedTime: record?.statsCreatedTime ?? template?.statsCreatedTime ?? null,
  mostRecentPost: record?.mostRecentPost ?? "-",
});

function createSummaryHandler(): RouterHandler {
  return async (req: SummaryRequest, res: Response) => {
    try {
      const { networkId } = req.params;
      const allNetworks = await networksInfo.getAllNetworks();
      const memberCountByNetwork = await networksInfo.getAllMemberCounts();

      const memberCountAll = Array.from(memberCountByNetwork.values()).reduce<number>((total, count) => {
        return total + (typeof count === "number" ? count : 0);
      }, 0);

      let memberCountNetwork = 0;
      let districtName = "";
      let numNetworksInDistrict = 0;
      let memberCountDistrict = 0;

      const normalizedNetworkId = networkId && networkId !== "all" ? networkId : null;
      const selectedNetwork: NetworkRecord | null =
        normalizedNetworkId
          ? ((await networksInfo.findNetworkById(normalizedNetworkId)) ??
              (await networksInfo.findNetworkByShortId(normalizedNetworkId)) ??
              null)
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

  router.get("/global-table", async (_req: Request, res: Response) => {
    try {
      const [networks, districts, memberCountByNetwork, bagCountsById] = await Promise.all([
        networksInfo.getAllNetworks(),
        networksInfo.getAllDistricts(),
        networksInfo.getAllMemberCounts(),
        networksInfo.getAllBagCounts(),
      ]);

      const networkById = new Map<string, NetworkRecord>();
      networks.forEach((network) => {
        networkById.set(network.uniqueId, network);
      });

      const districtNameById = new Map<string, string>();
      districts.forEach((district) => {
        districtNameById.set(district.uniqueId, district.fullName);
      });

      const templateCounts = bagCountsById.get("all");
      const rows: GlobalStatsRow[] = [];

      bagCountsById.forEach((bagCountsRecord, uniqueId) => {
        const network = networkById.get(uniqueId);
        const districtName = network?.districtId ? districtNameById.get(network.districtId) ?? "" : "";
        const districtNameForId = districtNameById.get(uniqueId) ?? "";
        let statType: GlobalStatsRow["statType"] = "Network";
        let fullName = network?.fullName ?? "";
        let shortId = network?.shortId;
        let districtId = network?.districtId;
        let resolvedDistrictName = districtName;

        if (uniqueId === "all") {
          statType = "Global";
          fullName = "All Litter Networks";
          shortId = undefined;
          districtId = undefined;
          resolvedDistrictName = "";
        } else if (!network && districtNameForId) {
          statType = "District";
          fullName = districtNameForId;
          shortId = undefined;
          districtId = uniqueId;
          resolvedDistrictName = districtNameForId;
        }

        rows.push({
          uniqueId,
          shortId,
          fullName,
          districtId,
          districtName: resolvedDistrictName,
          statType,
          memberCount: memberCountByNetwork.get(uniqueId) ?? null,
          bagCounts: buildBagCounts(bagCountsRecord, templateCounts),
        });
      });

      const response: GlobalStatsResponse = {
        generatedAt: new Date().toISOString(),
        rows,
      };

      res.json(response);
    } catch (error) {
      console.error("Error retrieving global stats table:", error);
      res.status(500).json({ error: "An error occurred while fetching the global stats table" });
    }
  });

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
