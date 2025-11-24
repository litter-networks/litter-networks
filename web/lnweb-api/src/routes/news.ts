import express, { NextFunction, Request, Response, Router } from "express";

const newsController = require("../controllers/news-controller.js");
const newsControllerLegacy = require("../controllers/legacy/news-controller-legacy.js");

const cdnHost = "https://cdn.litternetworks.org";

type NewsJsonRequest = Request<{ prevUniqueId?: string }>;

function initializeRoutes(): Router {
  const router = express.Router();

  router.get("/get-press-cuttings-json/:prevUniqueId?", async (req: NewsJsonRequest, res: Response) => {
    const { prevUniqueId = null } = req.params;
    const maxNumItemsDynamic = 10;

    const items = await newsController.fetchNextNewsItems(maxNumItemsDynamic, prevUniqueId, cdnHost);
    if (items) {
      res.status(200).json(items);
    } else {
      res.status(500).json({ error: "An error occurred while fetching the data." });
    }
  });

  router.get("/get-press-cuttings-csv", (req: Request, res: Response, next: NextFunction) => {
    newsControllerLegacy.getPressCuttingsCsvDeprecated(req, res, next);
  });

  router.get("/get-press-cuttings-csv/:scope/:scopeId", (req: Request, res: Response, next: NextFunction) => {
    newsControllerLegacy.getPressCuttingsCsvDeprecated(req, res, next);
  });

  return router;
}

const newsRouter = initializeRoutes();
export = newsRouter;
