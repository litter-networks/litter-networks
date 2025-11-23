
const express = require("express");
const router = express.Router();

const newsController = require("../controllers/news-controller.js");

const cdnHost = "https://cdn.litternetworks.org";

function initializeRoutes() {

    // news:
    router.get('/get-press-cuttings-json/:prevUniqueId?', async (req, res) => {
        const { prevUniqueId } = req.params;
        // ^- if null / not set then implies no previous - take from start of list

        const maxNumItemsDynamic = 10;
        // ^- we've hard-coded this value, to deter malicious clients from overloading us with to many requests (was http param before)

        const items = await newsController.fetchNextNewsItems(maxNumItemsDynamic, prevUniqueId, cdnHost); // <- returns null only on error
        if (items) {
            res.status(200).json(items);
        }
        else {
            res.status(500).json({ error: "An error occurred while fetching the data." });
        }
    });

    // ===========================================================================================
    // Legacy API: (remove once we've deleted old website)

    const newsControllerLegacy = require("../controllers/legacy/news-controller-legacy.js");

    router.get('/get-press-cuttings-csv', (req, res, next) => {
        newsControllerLegacy.getPressCuttingsCsvDeprecated(req, res, next);
    });

    router.get('/get-press-cuttings-csv/:scope/:scopeId', (req, res, next) => {
        newsControllerLegacy.getPressCuttingsCsvDeprecated(req, res, next);
    });

    return router;
}

module.exports = initializeRoutes();
