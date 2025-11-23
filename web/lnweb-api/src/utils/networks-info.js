const { DynamoDBClient, GetItemCommand, ScanCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { GetCommand, DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const NodeCache = require("node-cache");

class NetworksInfo {
    constructor() {
        if (!NetworksInfo.instance) {
            this.cacheNetworks = new NodeCache({ stdTTL: 5 * 60 }); // Cache for networks (both per-item and full list)
            this.cacheNetworksByShortId = new NodeCache({ stdTTL: 5 * 60 }); // Cache for networks by shortId
            this.cacheDistricts = new NodeCache({ stdTTL: 5 * 60 }); // Cache for districts
            this.cacheDistrictLocalInfos = new NodeCache({ stdTTL: 5 * 60 }); // Cache for district local infos
            this.cacheNearbyNetworks = new NodeCache({ stdTTL: 5 * 60 }); // Cache for nearby networks
            this.cacheBagsInfo = new NodeCache({ stdTTL: 1 * 60 }); // Cache for bags-info - 1 min so we don't have to wait too long after we've refreshed bag-counts
            this.cacheCurrentMemberCounts = new NodeCache({ stdTTL: 1 * 60 }); // Cache for member-counts - 1 min so we don't have to wait too long after we've refreshed bag-counts
            this.tableName = 'LN-NetworksInfo';
            this.districtsTableName = 'LN-DistrictsInfo'; // Districts table
            this.districtsLocalInfoTableName = 'LN-DistrictsLocalInfo'; // DistrictsLocalInfo table
            this.dynamoDbClient = new DynamoDBClient({ region: 'eu-west-2' });
            // Create a DocumentClient for easier document-based interactions (auto-flattens some commands)
            this.docClient = DynamoDBDocumentClient.from(this.dynamoDbClient);
            NetworksInfo.instance = this;
        }
        return NetworksInfo.instance;
    }

    // Helper method to recursively flatten DynamoDB attribute values.
    // If an object contains a single key like "S", "N", "BOOL", etc, then it returns that value.
    flattenItem(item) {
        if (Array.isArray(item)) {
            return item.map(el => this.flattenItem(el));
        } else if (item !== null && typeof item === 'object') {
            const keys = Object.keys(item);
            if (keys.length === 1) {
                if (keys[0] === 'S') return item.S;
                if (keys[0] === 'N') return parseFloat(item.N);
                if (keys[0] === 'BOOL') return item.BOOL;
                if (keys[0] === 'NULL') return null;
                if (keys[0] === 'M') return this.flattenItem(item.M);
                if (keys[0] === 'L') return item.L.map(el => this.flattenItem(el));
            }
            const result = {};
            for (let key in item) {
                result[key] = this.flattenItem(item[key]);
            }
            return result;
        }
        return item;
    }

    // (1) Method to find District by uniqueId
    async findDistrictById(districtUniqueId) {
        await this.getAllDistricts(); // will refresh the cache if needed, adding them all to it
        const district = this.cacheDistricts.get(districtUniqueId);
        return district;
    }

    // (2) Method to get all districts (use cache if populated)
    async getAllDistricts() {
        // Check if the full dataset is cached
        let cachedDistricts = this.cacheDistricts.get('allDistricts');
        if (cachedDistricts) {
            return cachedDistricts;
        }

        // Fetch all districts from DynamoDB
        const districts = await this.fetchAllDistricts();

        // Cache the entire dataset atomically
        this.cacheDistricts.set('allDistricts', districts);

        districts.forEach(district => {
            const uniqueId = district.uniqueId; // Assuming uniqueId exists (already flattened)
            this.cacheDistricts.set(uniqueId, district); // Also cache each district individually
        });

        return districts;
    }

    // Fetch all districts from DynamoDB and flatten the items
    async fetchAllDistricts() {
        const params = {
            TableName: this.districtsTableName
        };

        try {
            const command = new ScanCommand(params);
            const data = await this.dynamoDbClient.send(command);
            return (data.Items || []).map(item => this.flattenItem(item));
        } catch (error) {
            console.error("Error fetching all districts from DynamoDB:", error);
            return [];
        }
    }

    // (3) Method to get all district local infos (use cache if populated)
    async getAllDistrictLocalInfos() {
        let cachedLocalInfos = this.cacheDistrictLocalInfos.get('allDistrictLocalInfos');
        if (cachedLocalInfos) {
            return cachedLocalInfos;
        }

        const districtLocalInfos = await this.fetchAllDistrictLocalInfos();

        // Cache the entire dataset atomically
        this.cacheDistrictLocalInfos.set('allDistrictLocalInfos', districtLocalInfos);

        districtLocalInfos.forEach(info => {
            const uniqueId = info.uniqueId; // Assuming uniqueId exists (already flattened)
            this.cacheDistrictLocalInfos.set(uniqueId, info); // Also cache each district local info individually
        });

        return districtLocalInfos;
    }

    // Fetch all district local infos from DynamoDB and flatten the items
    async fetchAllDistrictLocalInfos() {
        const params = {
            TableName: this.districtsLocalInfoTableName
        };

        try {
            const command = new ScanCommand(params);
            const data = await this.dynamoDbClient.send(command);
            return (data.Items || []).map(item => this.flattenItem(item));
        } catch (error) {
            console.error("Error fetching all district local infos from DynamoDB:", error);
            return [];
        }
    }

    // (4) Method to get all networks (use cache if populated)
    async getAllNetworks() {
        const cacheKey = 'allNetworks';

        let cachedNetworks = this.cacheNetworks.get(cacheKey);
        if (cachedNetworks) {
            return cachedNetworks;
        }

        const networks = await this.fetchAllNetworks();

        networks.sort((a, b) => {
            if (a.fullName < b.fullName) return -1;
            if (a.fullName > b.fullName) return 1;
            return 0; // Equal
        });

        // Cache the entire dataset atomically
        this.cacheNetworks.set(cacheKey, networks);

        networks.forEach(network => {
            const uniqueId = network.uniqueId; // Assuming uniqueId exists (already flattened)
            const shortId = network.shortId;
            this.cacheNetworks.set(uniqueId, network);
            this.cacheNetworksByShortId.set(shortId, network); // Also cache each network by shortId
        });

        return networks;
    }

    // Fetch all networks from DynamoDB and flatten the items
    async fetchAllNetworks() {
        const params = {
            TableName: this.tableName
        };

        try {
            const command = new ScanCommand(params);
            const data = await this.dynamoDbClient.send(command);
            return (data.Items || []).map(item => this.flattenItem(item));
        } catch (error) {
            console.error("Error fetching all networks from DynamoDB:", error);
            return [];
        }
    }

    // Method to find Network by uniqueId
    async findNetworkById(networkUniqueId) {
        await this.getAllNetworks(); // will refresh cache if needed
        const network = this.cacheNetworks.get(networkUniqueId);
        return network;
    }

    // (5) Method to find network by shortId
    async findNetworkByShortId(queryShortId) {
        await this.getAllNetworks(); // will refresh cache if needed
        const network = this.cacheNetworksByShortId.get(queryShortId);
        return network;
    }

    async getNearbyNetworks(networkId) {
        // Check if the full dataset is cached
        let cachedNearbyNetworks = this.cacheNearbyNetworks.get(networkId);
        if (cachedNearbyNetworks) {
            return cachedNearbyNetworks;
        }

        // Set up the parameters
        const params = {
            TableName: 'LN-NetworksProximityInfo',
            Key: {
                'uniqueId': { S: networkId }
            },
            ProjectionExpression: 'nearbyNetworks'
        };

        try {
            const command = new GetItemCommand(params);
            const data = await this.dynamoDbClient.send(command);

            if (data.Item && data.Item.nearbyNetworks) {
                const flattened = this.flattenItem(data.Item);
                const nearbySource = flattened.nearbyNetworks;
                const nearbyNetworks = Array.isArray(nearbySource)
                    ? nearbySource
                    : typeof nearbySource === 'string'
                        ? JSON.parse(nearbySource)
                        : [];
                // Fetch fullName for each nearby network concurrently
                const nearbyNetworksAdj = await Promise.all(
                    nearbyNetworks.map(async (network, index) => {
                        const networkInfo = await this.findNetworkById(network.uniqueId);
                        return {
                            ...network,
                            fullName: networkInfo && networkInfo.fullName ? networkInfo.fullName : "Unknown Network",
                            roundedDistance: network.distance_miles.toFixed(1), // Round to 1 decimal place
                            elementClass: index >= 3 ? "not-letterbox" : "" // <- ensure we don't make menu too full to fit on screen in letterbox mode
                        };
                    })
                );

                this.cacheNearbyNetworks.set(networkId, nearbyNetworksAdj);

                return nearbyNetworksAdj;
            } else {
                console.error(`No nearby networks found for uniqueId: ${networkId}`);
                return [];
            }
        } catch (error) {
            console.error(`Error fetching data for uniqueId ${networkId}:`, error);
            throw error;
        }
    }

    async getBagsInfo(statsUniqueId) {
        // Check if the full dataset is cached
        const cachedBagsInfo = this.cacheBagsInfo.get(statsUniqueId);
        if (cachedBagsInfo) {
            return cachedBagsInfo;
        }

        let isDistrict = false;
        let isAll = false;

        let networkFullName = "";
        let districtFullName = "";

        if (statsUniqueId === "all") {
            isAll = true;
        }
        else {
            const foundNetwork = await this.findNetworkById(statsUniqueId);
            if (foundNetwork) {
                networkFullName = foundNetwork.fullName; // Already flattened
            }
            else {
                const foundDistrict = await this.findDistrictById(statsUniqueId);
                if (foundDistrict) {
                    districtFullName = foundDistrict.fullName;
                    isDistrict = true;
                }
            }
        }

        // Use DynamoDBDocumentClient for easier document-based interaction
        try {
            const params = {
                TableName: 'LN-BagCounts',
                Key: {
                    uniqueId: statsUniqueId
                }
            };

            // Get the item using the GetCommand from lib-dynamodb
            const result = await this.docClient.send(new GetCommand(params));
            const bagCountData = result.Item;

            let bagsInfo = {};

            if (bagCountData) {
                bagsInfo = {
                    networkName: networkFullName,
                    districtName: districtFullName,
                    bagCounts: {
                        thisMonthName: bagCountData.thisMonthName,
                        thisMonth: bagCountData.thisMonth,
                        lastMonthName: bagCountData.lastMonthName,
                        lastMonth: bagCountData.lastMonth,
                        thisYearName: bagCountData.thisYearName,
                        thisYear: bagCountData.thisYear,
                        lastYearName: bagCountData.lastYearName,
                        lastYear: bagCountData.lastYear,
                        allTime: bagCountData.allTime,
                        gbsc: bagCountData.gbsc,
                        statsCreatedTime: bagCountData.statsCreatedTime,
                        mostRecentPost: bagCountData.mostRecentPost
                    },
                    isDistrict: isDistrict,
                    isAll: isAll
                };
            }
            else {
                bagsInfo = JSON.parse(JSON.stringify(await this.getBagsInfo('all'))); // produce a deep-copy of our "all" info which we know will exist and is generic

                bagsInfo.networkName = networkFullName;
                bagsInfo.districtName = districtFullName;
                bagsInfo.isAll = isAll;
                bagsInfo.isDistrict = isDistrict;

                bagsInfo.bagCounts.thisMonth = '0';
                bagsInfo.bagCounts.lastMonth = '0';
                bagsInfo.bagCounts.thisYear = '0';
                bagsInfo.bagCounts.lastYear = '0';
                bagsInfo.bagCounts.allTime = '0';
                bagsInfo.bagCounts.gbsc = '0';
                bagsInfo.bagCounts.mostRecentPost = '-';
            }

            this.cacheBagsInfo.set(statsUniqueId, bagsInfo);

            return bagsInfo;

        } catch (error) {
            console.error('Error fetching data from DynamoDB:', error);
        }

        return null;
    }

    async getCurrentMemberCount(uniqueId) {
        const cachedMemberCount = this.cacheCurrentMemberCounts.get(uniqueId);
        if (cachedMemberCount) {
            return cachedMemberCount;
        }

        const memberCount = await this.fetchCurrentMemberCount(uniqueId);
        this.cacheCurrentMemberCounts.set(uniqueId, memberCount);

        return memberCount;
    }

    async fetchCurrentMemberCount(uniqueId) {
        const params = {
            TableName: 'LN-MemberCounts',
            KeyConditionExpression: 'uniqueId = :uid',
            ExpressionAttributeValues: {
                ':uid': { S: uniqueId },
            },
            ScanIndexForward: false, // This ensures we get the most recent sampleTime first
            Limit: 1 // Only retrieve the most recent entry
        };

        try {
            const command = new QueryCommand(params);
            const result = await this.dynamoDbClient.send(command);

            if (result.Items && result.Items.length > 0) {
                // Flatten the item so that memberCount is already a number
                const flattened = this.flattenItem(result.Items[0]);
                return flattened.memberCount;
            } else {
                return null; // No entry found
            }
        } catch (error) {
            console.error('Error querying DynamoDB:', error);
            return null; // No entry found
        }
    }
}

// Exporting the singleton instance
var instance = new NetworksInfo();
module.exports = instance;
