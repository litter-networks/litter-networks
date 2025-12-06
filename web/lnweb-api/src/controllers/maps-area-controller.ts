// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import NodeCache from "node-cache";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, ScanCommandInput } from "@aws-sdk/lib-dynamodb";

const cache = new NodeCache({ stdTTL: 5 * 60 });
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-2" }));

/**
 * Check if a network's district list includes the specified district.
 *
 * @param {string|null|undefined} networkDistrictId - Comma-separated district IDs (e.g. "district-1,district-2"); may be null or undefined.
 * @param {string} targetDistrictId - District ID to check for.
 * @returns {boolean} `true` if `targetDistrictId` is present in `networkDistrictId`, `false` otherwise.
 */
function isNetworkInDistrict(networkDistrictId: string | null | undefined, targetDistrictId: string): boolean {
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
 * Retrieve all items from a DynamoDB table using paginated Scan operations.
 * @param {string} tableName - The name of the DynamoDB table to scan.
 * @returns {Promise<Array<Object>>} Promise resolving to the array of items from the table, or an empty array if none are found.
 */
async function fetchTable<T = any>(tableName: string): Promise<T[]> {
    const items: T[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
        const params: ScanCommandInput = {
            TableName: tableName,
            ExclusiveStartKey: lastEvaluatedKey,
        };
        const data = await dynamoDb.send(new ScanCommand(params));
        if (Array.isArray(data.Items)) {
            items.push(...(data.Items as T[]));
        }
        lastEvaluatedKey = data.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
}

/**
 * Builds and returns aggregated area information for all districts, including each district's networks and associated map details.
 *
 * The result is cached in memory under the key "areaInfo" to avoid repeated table scans.
 *
 * @returns {Promise<Array<Object>>} Promise resolving to an array of district objects. Each district has:
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
type DistrictRecord = {
  uniqueId: string;
  fullName: string;
  mapStyle?: string;
};

type NetworkRecord = {
  uniqueId: string;
  fullName: string;
  districtId?: string;
};

type NetworkMapRecord = {
  uniqueId: string;
  mapSource?: string;
  mapFile?: string | null;
};

type DistrictAreaInfo = {
  mapName: string;
  mapStyle: string;
  uniqueId: string;
  fullName: string;
  networks: Array<{
    uniqueId: string;
    fullName: string;
    mapSource: string;
    mapFile: string | null;
  }>;
};

async function getAreaInfo(): Promise<DistrictAreaInfo[]> {
    const cached = cache.get("areaInfo") as DistrictAreaInfo[] | undefined;
    if (cached) {
        return cached;
    }

    try {
        const [districts, networks, networkMaps] = await Promise.all([
            fetchTable<DistrictRecord>("LN-DistrictsInfo"),
            fetchTable<NetworkRecord>("LN-NetworksInfo"),
            fetchTable<NetworkMapRecord>("LN-NetworksMapInfo"),
        ]);

        const mapInfoByNetwork = new Map(networkMaps.map((item) => [item.uniqueId, item]));

        const areaInfo = districts.map((district) => {
            const districtNetworks = networks.filter((network) => isNetworkInDistrict(network.districtId, district.uniqueId));

            const networkEntries = districtNetworks.map((network) => {
                const mapInfo: NetworkMapRecord | undefined = mapInfoByNetwork.get(network.uniqueId);
                return {
                    uniqueId: network.uniqueId,
                    fullName: network.fullName,
                    mapSource: mapInfo?.mapSource || 'custom',
                    mapFile: mapInfo?.mapFile || null,
                };
            });

            const mapStyleName = district.mapStyle ?? "default";
            return {
                mapName: (district.fullName || '').toLowerCase().replace(/\s+/g, '_'),
                mapStyle: `zone-style-${mapStyleName}`,
                uniqueId: district.uniqueId,
                fullName: district.fullName,
                networks: networkEntries,
            };
        });

        cache.set("areaInfo", areaInfo);
        return areaInfo;
    } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        const errStack = error instanceof Error ? error.stack : undefined;
        console.error("Failed to fetch area info from DynamoDB tables:", {
            message: errMessage,
            stack: errStack,
        });
        throw new Error("Failed to retrieve area information");
    }
}

function resetCache(): void {
    cache.flushAll();
}

module.exports = {
    getAreaInfo,
    isNetworkInDistrict,
    fetchTable,
    __resetCache: resetCache,
};
