const NodeCache = require("node-cache");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const cache = new NodeCache({ stdTTL: 5 * 60 });
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-2" }));

/**
 * Check if a network's district list includes the specified district.
 *
 * @param {string|null|undefined} networkDistrictId - Comma-separated district IDs (e.g. "district-1,district-2"); may be null or undefined.
 * @param {string} targetDistrictId - District ID to check for.
 * @returns {boolean} `true` if `targetDistrictId` is present in `networkDistrictId`, `false` otherwise.
 */
function isNetworkInDistrict(networkDistrictId, targetDistrictId) {
    if (typeof networkDistrictId !== "string" || !targetDistrictId) {
        return false;
    }

    return networkDistrictId
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .some((id) => id === targetDistrictId);
}

/**
 * Retrieve all items from a DynamoDB table using a Scan operation.
 * @param {string} tableName - The name of the DynamoDB table to scan.
 * @returns {Array<Object>} The array of items from the table, or an empty array if none are found.
 */
async function fetchTable(tableName) {
    const data = await dynamoDb.send(new ScanCommand({ TableName: tableName }));
    return data.Items || [];
}

/**
 * Builds and returns aggregated area information for all districts, including each district's networks and associated map details.
 *
 * The result is cached in memory under the key "areaInfo" to avoid repeated table scans.
 *
 * @returns {Array<Object>} An array of district objects. Each district has:
 *  - mapName: string (lowercased, spaces replaced with underscores)
 *  - mapStyle: string (formatted as "zone-style-<mapStyle>")
 *  - uniqueId: string
 *  - fullName: string
 *  - networks: Array<Object> where each network object contains:
 *      - uniqueId: string
 *      - fullName: string
 *      - mapSource: string ('custom' if not provided)
 *      - mapFile: string|null
 */
async function getAreaInfo() {
    const cached = cache.get("areaInfo");
    if (cached) {
        return cached;
    }

    const [districts, networks, networkMaps] = await Promise.all([
        fetchTable("LN-DistrictsInfo"),
        fetchTable("LN-NetworksInfo"),
        fetchTable("LN-NetworksMapInfo"),
    ]);

    const mapInfoByNetwork = new Map(networkMaps.map((item) => [item.uniqueId, item]));

    const areaInfo = districts.map((district) => {
        const districtNetworks = networks.filter((network) => isNetworkInDistrict(network.districtId, district.uniqueId));

        const networkEntries = districtNetworks.map((network) => {
            const mapInfo = mapInfoByNetwork.get(network.uniqueId) || {};
            return {
                uniqueId: network.uniqueId,
                fullName: network.fullName,
                mapSource: mapInfo.mapSource || 'custom',
                mapFile: mapInfo.mapFile || null,
            };
        });

        return {
            mapName: (district.fullName || '').toLowerCase().replace(/\s+/g, '_'),
            mapStyle: `zone-style-${district.mapStyle}`,
            uniqueId: district.uniqueId,
            fullName: district.fullName,
            networks: networkEntries,
        };
    });

    cache.set("areaInfo", areaInfo);
    return areaInfo;
}

module.exports = {
    getAreaInfo,
};