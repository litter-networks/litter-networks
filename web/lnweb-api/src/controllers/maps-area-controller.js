const NodeCache = require("node-cache");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const cache = new NodeCache({ stdTTL: 5 * 60 });
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-2" }));

async function fetchTable(tableName) {
    const data = await dynamoDb.send(new ScanCommand({ TableName: tableName }));
    return data.Items || [];
}

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
        const districtNetworks = networks.filter(
            (network) =>
                network.districtId === district.uniqueId ||
                (typeof network.districtId === "string" && network.districtId.includes(district.uniqueId)),
        );

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
