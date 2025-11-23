
const express = require("express");
const router = express.Router();
const { getAreaInfo } = require("../controllers/maps-area-controller");

let OPENROUTE_API_KEY;

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

async function initializeRoutes() {

    const { validateAuthToken } = require("../auth");

    router.post('/snap-route', validateAuthToken, async (req, res) => {
        try {
            if (!OPENROUTE_API_KEY) {
                OPENROUTE_API_KEY = await getParameterFromStore("/LNWeb-API/OPENROUTE_API_KEY");
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
