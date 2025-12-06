// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import express, { NextFunction, Request, Response, Router } from "express";
import networksInfo from "../utils/networks-info";
const networkInfoControllerLegacy = require("../controllers/legacy/network-info-controller");

type NearbyRequest = Request<{ networkId: string }>;

function initializeRoutes(): Router {
  const router = express.Router();

  router.get("/get-districts-csv", (req: Request, res: Response, next: NextFunction) => {
    networkInfoControllerLegacy.getDistrictsCsv(req, res, next);
  });

  router.get(
    "/get-districts-localinfo-csv",
    (req: Request, res: Response, next: NextFunction) => {
      networkInfoControllerLegacy.getDistrictsLocalInfoCsv(req, res, next);
    },
  );

  router.get("/get-networks-csv", (req: Request, res: Response, next: NextFunction) => {
    networkInfoControllerLegacy.getNetworksCsv(req, res, next);
  });

  router.get("/networks", async (_req: Request, res: Response) => {
    try {
      const networks = await networksInfo.getAllNetworks();
      res.json(networks);
    } catch (error) {
      console.error("Error retrieving networks:", error);
      res.status(500).json({ error: "Unable to fetch networks" });
    }
  });

  router.get("/networks/:networkId/nearby", async (req: NearbyRequest, res: Response) => {
    const { networkId } = req.params;

    try {
      const nearby = await networksInfo.getNearbyNetworks(networkId);
      res.json(nearby ?? []);
    } catch (error) {
      console.error(`Error retrieving nearby networks for ${networkId}:`, error);
      res.status(500).json({ error: "Unable to fetch nearby networks" });
    }
  });

  return router;
}

const infoRouter = initializeRoutes();
export = infoRouter;
