// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import express, { Request, Response, Router } from "express";
import networksInfo from "../utils/networks-info";

type DistrictParams = { districtId?: string };
type DistrictLocalInfo = {
  uniqueId?: string;
  [key: string]: unknown;
};

function initializeRoutes(): Router {
  const router = express.Router();

  router.get("/districts/:districtId/local-info", async (req: Request<DistrictParams>, res: Response) => {
    try {
      const { districtId } = req.params;
      if (!districtId) {
        return res.status(400).json({ error: "districtId is required" });
      }

      const infos: DistrictLocalInfo[] = await networksInfo.getAllDistrictLocalInfos();
      const info = infos.find((item) =>
        item.uniqueId && item.uniqueId.toLowerCase() === districtId.toLowerCase(),
      );

      if (!info) {
        return res.status(404).json({ error: "District local info not found" });
      }

      res.json(info);
    } catch (error) {
      console.error("Error fetching district local info:", error);
      res.status(500).json({ error: "Unable to fetch district local info" });
    }
  });

  return router;
}

const joinInRouter = initializeRoutes();
export = joinInRouter;
