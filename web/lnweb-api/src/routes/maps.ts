// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import express, { Request, Response, Router } from "express";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const mapsAreaController = require("../controllers/maps-area-controller");

type Coordinate = [number, number];

interface SnapRoutePayload {
  format?: string;
  id?: string;
  name?: string;
  geometry: {
    coordinates: Coordinate[];
    type?: string;
  };
  properties?: Record<string, unknown>;
}

const MAX_COORDINATES = 256;

let OPENROUTE_API_KEY: string | undefined;
const ssmClient = new SSMClient({ region: "eu-west-2" }); // reuse single client across requests

async function getParameterFromStore(parameterName: string): Promise<string | undefined> {
  try {
    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    console.error("Failed to load OpenRouteService API key from Parameter Store:", error);
    return undefined;
  }
}

function isCoordinate(value: unknown): value is Coordinate {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function parseSnapRouteBody(body: unknown): SnapRoutePayload {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be an object");
  }

  const geometry = (body as Record<string, unknown>).geometry;
  if (!geometry || typeof geometry !== "object") {
    throw new Error("Missing geometry");
  }

  const coordinates = (geometry as Record<string, unknown>).coordinates;
  if (!Array.isArray(coordinates)) {
    throw new Error("geometry.coordinates must be an array");
  }

  if (coordinates.length === 0) {
    throw new Error("Provide at least one coordinate");
  }
  if (coordinates.length > MAX_COORDINATES) {
    throw new Error(`Too many coordinates (max ${MAX_COORDINATES})`);
  }

  const sanitized: Coordinate[] = [];
  for (const entry of coordinates) {
    if (!isCoordinate(entry)) {
      throw new Error("Coordinates must be [lon, lat] pairs");
    }
    sanitized.push([entry[0], entry[1]]);
  }

  const payload: SnapRoutePayload = {
    format: typeof (body as Record<string, unknown>).format === "string" ? (body as Record<string, unknown>).format : undefined,
    id: typeof (body as Record<string, unknown>).id === "string" ? (body as Record<string, unknown>).id : undefined,
    name: typeof (body as Record<string, unknown>).name === "string" ? (body as Record<string, unknown>).name : undefined,
    geometry: {
      coordinates: sanitized,
      type: typeof (geometry as Record<string, unknown>).type === "string" ? (geometry as Record<string, unknown>).type : undefined,
    },
  };

  const properties = (body as Record<string, unknown>).properties;
  if (properties && typeof properties === "object") {
    payload.properties = properties as Record<string, unknown>;
  }

  return payload;
}

function initializeRoutes(): Router {
  const router = express.Router();

  router.post("/snap-route", async (req: Request, res: Response) => {
    try {
      if (!OPENROUTE_API_KEY) {
        OPENROUTE_API_KEY = await getParameterFromStore("/LNWeb-API/OPENROUTE_API_KEY");
      }
      if (!OPENROUTE_API_KEY) {
        console.error("OpenRouteService API key is missing; aborting snap-route proxy call.");
        return res.status(503).json({ error: "Routing service temporarily unavailable" });
      }

      let payload: SnapRoutePayload;
      try {
        payload = parseSnapRouteBody(req.body);
      } catch (validationError) {
        return res.status(400).json({ error: (validationError as Error).message });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch("https://api.openrouteservice.org/v2/snap/foot-walking", {
          method: "POST",
          headers: {
            Accept: "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
            "Content-Type": "application/json; charset=utf-8",
            Authorization: OPENROUTE_API_KEY,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`OpenRouteService API responded with status: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const status = error instanceof Error && error.name === "AbortError" ? 504 : 500;
      const message =
        status === 504 ? "Routing service timed out" : "Failed to process request";
      console.error("Error proxying to OpenRouteService:", error);
      res.status(status).json({ error: message });
    }
  });

  router.get("/area-info", async (_req: Request, res: Response) => {
    try {
      const areaInfo = await mapsAreaController.getAreaInfo();
      res.json({ areaInfo });
    } catch (error) {
      console.error("Error fetching area info:", error);
      res.status(500).json({ error: "Unable to fetch area info" });
    }
  });

  return router;
}

const mapsRouter = initializeRoutes() as Router & { resetOpenRouteKey?: () => void };
mapsRouter.resetOpenRouteKey = function resetOpenRouteKey() {
  OPENROUTE_API_KEY = undefined;
};

export = mapsRouter;
