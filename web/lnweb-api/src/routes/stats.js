const express = require("express");
const router = express.Router();
const networksInfo = require("../utils/networks-info.js");

/**
 * Create and configure an Express Router with endpoints that provide bag and network statistics.
 *
 * Registers routes for fetching bag information, a network/district summary, and a legacy bag-stats JSON endpoint.
 * @returns {import('express').Router} The configured Express Router with the registered statistics routes.
 */
async function initializeRoutes() {

    // bag-stats (being used by stats pages - so not deprecated):
    router.get('/get-bags-info/:uniqueId', async (req, res) => {
        try {
            const { uniqueId } = req.params;

            const bagsInfo = await networksInfo.getBagsInfo(uniqueId);

            res.json(bagsInfo);
        }
        catch (error) {
            // Handle errors
            console.error(error);
            res.status(500).json({ error: 'An error occurred while fetching the data' });
        }
    });

    router.get('/summary/:networkId?', async (req, res) => {
        try {
            const { networkId } = req.params;
            const allNetworks = await networksInfo.getAllNetworks();
            const memberCounts = await Promise.all(
                allNetworks.map((network) => networksInfo.getCurrentMemberCount(network.uniqueId)),
            );

            const memberCountByNetwork = new Map(
                allNetworks.map((network, index) => {
                    const value = memberCounts[index];
                    return [network.uniqueId, typeof value === 'number' ? value : null];
                }),
            );
            const memberCountAll = Array.from(memberCountByNetwork.values()).reduce((total, count) => {
                return total + (typeof count === 'number' ? count : 0);
            }, 0);

            let memberCountNetwork = null;
            let districtName = '';
            let numNetworksInDistrict = 0;
            let memberCountDistrict = 0;

            const normalizedNetworkId = networkId && networkId !== 'all' ? networkId : null;
            const selectedNetwork = normalizedNetworkId
                ? await networksInfo.findNetworkById(normalizedNetworkId) ??
                  (await networksInfo.findNetworkByShortId(normalizedNetworkId))
                : null;

            if (selectedNetwork) {
                const districtId = selectedNetwork.districtId;
                memberCountNetwork =
                    memberCountByNetwork.get(selectedNetwork.uniqueId) ?? 3;

                if (districtId) {
                    const districtNetworks = allNetworks.filter((network) => network.districtId === districtId);
                    numNetworksInDistrict = districtNetworks.length;
                    memberCountDistrict = districtNetworks.reduce((total, network) => {
                        const count = memberCountByNetwork.get(network.uniqueId) ?? 0;
                        return total + (typeof count === 'number' ? count : 0);
                    }, 0);

                    const district = await networksInfo.findDistrictById(districtId);
                    districtName = district?.fullName ?? '';
                }
            }

            res.json({
                memberCountNetwork,
                numNetworksInDistrict,
                memberCountDistrict,
                districtName,
                numNetworksInAll: allNetworks.length,
                memberCountAll,
            });
        } catch (error) {
            console.error('Error retrieving stats summary:', error);
            res.status(500).json({ error: 'An error occurred while fetching the stats summary' });
        }
    });

    // ===========================================================================================
    // Legacy API: (remove once we've deleted old website)

    router.get('/get-bag-stats-json/:uniqueId', async (req, res) => {
        try {
            const { uniqueId } = req.params;

            const networksInfo = require("../utils/networks-info.js");
            const bagsInfo = await networksInfo.getBagsInfo(uniqueId);

            res.json(bagsInfo.bagCounts);
        }
        catch (error) {
            // Handle errors
            console.error(error);
            res.status(500).json({ error: 'An error occurred while fetching the data' });
        }
    });

    return router;
}

module.exports = initializeRoutes();