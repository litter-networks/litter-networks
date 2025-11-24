import express, { Request, Response, Router } from "express";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const mapsAreaController = require("../controllers/maps-area-controller");

let OPENROUTE_API_KEY: string | undefined;

async function getParameterFromStore(parameterName: string): Promise<string | undefined> {
  const ssmClient = new SSMClient({ region: "eu-west-2" });
  try {
    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    console.error("Failed to load session secret from Parameter Store:", error);
    return undefined;
  }
}

type SnapRouteRequest = Request;

function initializeRoutes(): Router {
  const router = express.Router();

  router.post("/snap-route", async (req: SnapRouteRequest, res: Response) => {
    try {
      if (!OPENROUTE_API_KEY) {
        OPENROUTE_API_KEY = await getParameterFromStore("/LNWeb-API/OPENROUTE_API_KEY");
      }
      if (!OPENROUTE_API_KEY) {
        console.error("OpenRouteService API key is missing; aborting snap-route proxy call.");
        return res.status(503).json({ error: "Routing service temporarily unavailable" });
      }

      const response = await fetch("https://api.openrouteservice.org/v2/snap/foot-walking", {
        method: "POST",
        headers: {
          Accept: "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
          "Content-Type": "application/json; charset=utf-8",
          Authorization: OPENROUTE_API_KEY,
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        throw new Error(`OpenRouteService API responded with status: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error proxying to OpenRouteService:", error);
      res.status(500).json({ error: "Failed to process request" });
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
