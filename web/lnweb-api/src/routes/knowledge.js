const express = require("express");
const router = express.Router();

const knowledgeController = require("../controllers/knowledge-controller");

/**
 * Create and configure an Express router exposing knowledge-related endpoints.
 *
 * Configures two GET routes:
 * - GET /child-pages: accepts optional `path` query string and responds with `{ childPages }`.
 * - GET /page: accepts optional `path` query string and responds with the knowledge page payload.
 *
 * @returns {import('express').Router} The configured Express router.
 */
async function initializeRoutes() {
    router.get("/child-pages", async (req, res) => {
        const path = typeof req.query.path === "string" ? req.query.path : "";
        try {
            const childPages = await knowledgeController.getChildPages(path);
            res.json({ childPages });
        } catch (error) {
            console.error("Error retrieving knowledge child pages:", error);
            res.status(500).json({ error: "Unable to fetch knowledge contents" });
        }
    });

    router.get("/page", async (req, res) => {
        const path = typeof req.query.path === "string" ? req.query.path : "";
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

module.exports = initializeRoutes();