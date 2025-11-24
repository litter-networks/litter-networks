import express, { Request, Response, Router } from "express";

const knowledgeController = require("../controllers/knowledge-controller");

type KnowledgeQuery = Request<unknown, unknown, unknown, { path?: string }>;

function normalizePath(query: KnowledgeQuery): string {
  return typeof query.query.path === "string" ? query.query.path : "";
}

function initializeRoutes(): Router {
  const router = express.Router();

  router.get("/child-pages", async (req: KnowledgeQuery, res: Response) => {
    const path = normalizePath(req);
    try {
      const childPages = await knowledgeController.getChildPages(path);
      res.json({ childPages });
    } catch (error) {
      console.error("Error retrieving knowledge child pages:", error);
      res.status(500).json({ error: "Unable to fetch knowledge contents" });
    }
  });

  router.get("/page", async (req: KnowledgeQuery, res: Response) => {
    const path = normalizePath(req);
    try {
      const page = await knowledgeController.getKnowledgePage(path);
      res.json(page);
    } catch (error) {
      console.error("Error retrieving knowledge page:", error);
      res.status(500).json({ error: "Unable to fetch knowledge page" });
    }
  });

  return router;
}

const knowledgeRouter = initializeRoutes();
export = knowledgeRouter;
