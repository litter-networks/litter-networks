
const express = require("express");
const router = express.Router();

async function initializeRoutes() {

    // ===========================================================================================
    // Legacy API: (remove once we've deleted old website)

    const networkInfoControllerLegacy = require("../controllers/legacy/network-info-controller.js");

    // network/district info (CSV - legacy)
    router.get('/get-districts-csv', (req, res, next) => {
        networkInfoControllerLegacy.getDistrictsCsv(req, res, next);
    });

    router.get('/get-districts-localinfo-csv', (req, res, next) => {
        networkInfoControllerLegacy.getDistrictsLocalInfoCsv(req, res, next);
    });

    router.get('/get-networks-csv', (req, res, next) => {
        networkInfoControllerLegacy.getNetworksCsv(req, res, next);
    });

    const networksInfo = require("../utils/networks-info.js");

    router.get('/networks', async (req, res) => {
        try {
            const networks = await networksInfo.getAllNetworks();
            res.json(networks);
        } catch (error) {
            console.error('Error retrieving networks:', error);
            res.status(500).json({ error: 'Unable to fetch networks' });
        }
    });

    router.get('/networks/:networkId/nearby', async (req, res) => {
        const { networkId } = req.params;

        try {
            const nearby = await networksInfo.getNearbyNetworks(networkId);
            if (!nearby) {
                return res.json([]);
            }
            res.json(nearby);
        } catch (error) {
            console.error(`Error retrieving nearby networks for ${networkId}:`, error);
            res.status(500).json({ error: 'Unable to fetch nearby networks' });
        }
    });

    return router;
}

module.exports = initializeRoutes();
