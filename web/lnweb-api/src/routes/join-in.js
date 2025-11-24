const express = require("express");
const router = express.Router();
const networksInfo = require("../utils/networks-info");

/**
 * Create and configure an Express router with a GET /districts/:districtId/local-info endpoint.
 *
 * The endpoint validates the presence of `districtId` path parameter, looks up district local
 * information by case-insensitive `uniqueId`, and returns the matching info as JSON.
 *
 * @returns {import('express').Router} The configured Express router.
 */
function initializeRoutes() {
    router.get("/districts/:districtId/local-info", async (req, res) => {
        try {
            const { districtId } = req.params;
            if (!districtId) {
                return res.status(400).json({ error: "districtId is required" });
            }

            const infos = await networksInfo.getAllDistrictLocalInfos();
            const info = infos.find((item) => item.uniqueId && item.uniqueId.toLowerCase() === districtId.toLowerCase());

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

module.exports = initializeRoutes();
