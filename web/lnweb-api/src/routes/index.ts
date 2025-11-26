import express, { Request, Response, Router } from "express";

import { setCacheControl } from "../utils/cache-control";
import infoRouter from "./info";
import mapsRouter from "./maps";
import newsRouter from "./news";
import statsRouter from "./stats";
import knowledgeRouter from "./knowledge";
import joinInRouter from "./join-in";

const router = express.Router();

/**
 * Create and configure the main Express router, mounting sub-routers and applying per-route cache policies.
 *
 * Configures a root GET endpoint that returns a welcome message, mounts cached routers for `/info`, `/maps`, `/news`,
 * `/stats`, `/knowledge`, and `/join-in` (client max-age 300 seconds, CDN s-maxage 86400 seconds), and adds a 404 fallback for unknown paths.
 * The function logs start and completion messages and returns the configured router instance.
 */
function initializeRoutes(): Router {
  console.log("Routes initializing...");

  router.get("/", (_req: Request, res: Response) =>
    res.json({ message: "Welcome to LNWeb-API!" }),
  );

  router.use("/info", setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }), infoRouter);
  router.use("/maps", setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }), mapsRouter);
  router.use("/news", setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }), newsRouter);
  router.use("/stats", setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }), statsRouter);
  router.use(
    "/knowledge",
    setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }),
    knowledgeRouter,
  );
  router.use(
    "/join-in",
    setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }),
    joinInRouter,
  );
  // ^- client should cache these responses for 5 min, CDN should cache for 24 hours (unless we invalidate))

  router.use((req, res) => res.status(404).json({ error: "Not found", path: req.path }));

  console.log("Routes initialized");

  return router;
}

const rootRouter = initializeRoutes();
export = rootRouter;
