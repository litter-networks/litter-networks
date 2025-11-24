const express = require("express");
const router = express.Router();
const { getAreaInfo } = require("../controllers/maps-area-controller");

let OPENROUTE_API_KEY;

/**
 * Retrieve a decrypted parameter value from AWS SSM Parameter Store for the given parameter name.
 * @param {string} parameterName - Full name or path of the SSM parameter to fetch (for example, '/LNWeb-API/OPENROUTE_API_KEY').
 * @returns {string|undefined} The parameter's value, or `undefined` if the parameter could not be retrieved.
 */
async function getParameterFromStore(parameterName) {
    const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

    const ssmClient = new SSMClient({ region: "eu-west-2" });
    try {
        const command = new GetParameterCommand({
            Name: parameterName,
            WithDecryption: true
        });
        const response = await ssmClient.send(command);
        return response.Parameter.Value;
    } catch (error) {
        console.error("Failed to load session secret from Parameter Store:", error);
    }
}

/**
 * Create and configure an Express router exposing map-related endpoints.
 *
 * Registers POST /snap-route (lazily loads the OpenRouteService API key from AWS Parameter Store on first use,
 * and proxies requests to the OpenRouteService snap endpoint) and GET /area-info (returns area information from the maps-area-controller).
 * @returns {import('express').Router} The configured Express router.
 */
function initializeRoutes() {

    router.post('/snap-route', async (req, res) => {
        try {
            if (!OPENROUTE_API_KEY) {
                OPENROUTE_API_KEY = await getParameterFromStore("/LNWeb-API/OPENROUTE_API_KEY");
            }
            if (!OPENROUTE_API_KEY) {
                console.error("OpenRouteService API key is missing; aborting snap-route proxy call.");
                return res.status(503).json({ error: "Routing service temporarily unavailable" });
            }

            const response = await fetch('https://api.openrouteservice.org/v2/snap/foot-walking', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
                    'Content-Type': 'application/json; charset=utf-8',
                    'Authorization': OPENROUTE_API_KEY
                },
                body: JSON.stringify(req.body)
            });

            if (!response.ok) {
                throw new Error(`OpenRouteService API responded with status: ${response.status}`);
            }

            const data = await response.json();
            res.json(data);
        } catch (error) {
            console.error('Error proxying to OpenRouteService:', error);
            res.status(500).json({ error: 'Failed to process request' });
        }
    });

    router.get('/area-info', async (req, res) => {
        try {
            const areaInfo = await getAreaInfo();
            res.json({ areaInfo });
        } catch (error) {
            console.error('Error fetching area info:', error);
            res.status(500).json({ error: 'Unable to fetch area info' });
        }
    });

    return router;
}

module.exports = initializeRoutes();
