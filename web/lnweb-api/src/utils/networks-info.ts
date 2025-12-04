// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import NodeCache from "node-cache";

type NetworkRecord = {
  uniqueId: string;
  fullName: string;
  shortId?: string;
  districtId?: string;
  [key: string]: any;
};

type DistrictRecord = {
  uniqueId: string;
  fullName: string;
  mapStyle?: string;
  [key: string]: any;
};

type NearbyNetwork = {
  uniqueId: string;
  distance_miles: number;
};

class NetworksInfo {
  private static instance: NetworksInfo;
  private cacheNetworks = new NodeCache({ stdTTL: 5 * 60 });
  private cacheNetworksByShortId = new NodeCache({ stdTTL: 5 * 60 });
  private cacheDistricts = new NodeCache({ stdTTL: 5 * 60 });
  private cacheDistrictLocalInfos = new NodeCache({ stdTTL: 5 * 60 });
  private cacheNearbyNetworks = new NodeCache({ stdTTL: 5 * 60 });
  private cacheBagsInfo = new NodeCache({ stdTTL: 60 });
  private cacheCurrentMemberCounts = new NodeCache({ stdTTL: 60 });
  private cacheAllMemberCounts = new NodeCache({ stdTTL: 60 });
  private tableName = 'LN-NetworksInfo';
  private districtsTableName = 'LN-DistrictsInfo';
  private districtsLocalInfoTableName = 'LN-DistrictsLocalInfo';
  private dynamoDbClient = new DynamoDBClient({ region: 'eu-west-2' });
  private docClient = DynamoDBDocumentClient.from(this.dynamoDbClient);

  constructor() {
    if (!NetworksInfo.instance) {
      NetworksInfo.instance = this;
    }
  }

    // Helper method to recursively flatten DynamoDB attribute values.
    // If an object contains a single key like "S", "N", "BOOL", etc, then it returns that value.
  flattenItem(item: any): any {
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
        if (keys[0] === 'L') return item.L.map((el: any) => this.flattenItem(el));
      }
      const result: Record<string, any> = {};
      for (const key in item) {
        result[key] = this.flattenItem(item[key]);
      }
      return result;
    }
    return item;
  }

    // (1) Method to find District by uniqueId
  async findDistrictById(districtUniqueId: string) {
    await this.getAllDistricts();
    return this.cacheDistricts.get(districtUniqueId);
  }

    // (2) Method to get all districts (use cache if populated)
  async getAllDistricts(): Promise<DistrictRecord[]> {
    const cachedDistricts = this.cacheDistricts.get<DistrictRecord[]>('allDistricts');
    if (cachedDistricts) {
      return cachedDistricts;
    }

    const districts = await this.fetchAllDistricts();
    this.cacheDistricts.set('allDistricts', districts);
    districts.forEach((district) => {
      this.cacheDistricts.set(district.uniqueId, district);
    });
    return districts;
  }

    // Fetch all districts from DynamoDB and flatten the items
  async fetchAllDistricts(): Promise<DistrictRecord[]> {
    const params = { TableName: this.districtsTableName };
    try {
      const data = await this.dynamoDbClient.send(new ScanCommand(params));
      return (data.Items || []).map((item) => this.flattenItem(item)) as DistrictRecord[];
    } catch (error) {
      console.error("Error fetching all districts from DynamoDB:", error);
      return [];
    }
  }

    // (3) Method to get all district local infos (use cache if populated)
  async getAllDistrictLocalInfos(): Promise<DistrictRecord[]> {
    const cachedLocalInfos = this.cacheDistrictLocalInfos.get<DistrictRecord[]>('allDistrictLocalInfos');
    if (cachedLocalInfos) {
      return cachedLocalInfos;
    }

    const districtLocalInfos = await this.fetchAllDistrictLocalInfos();
    this.cacheDistrictLocalInfos.set('allDistrictLocalInfos', districtLocalInfos);
    districtLocalInfos.forEach((info) => {
      this.cacheDistrictLocalInfos.set(info.uniqueId, info);
    });
    return districtLocalInfos;
  }

    // Fetch all district local infos from DynamoDB and flatten the items
  async fetchAllDistrictLocalInfos(): Promise<DistrictRecord[]> {
    const params = { TableName: this.districtsLocalInfoTableName };
    try {
      const data = await this.dynamoDbClient.send(new ScanCommand(params));
      return (data.Items || []).map((item) => this.flattenItem(item)) as DistrictRecord[];
    } catch (error) {
      console.error("Error fetching all district local infos from DynamoDB:", error);
      return [];
    }
  }

    // (4) Method to get all networks (use cache if populated)
  async getAllNetworks(): Promise<NetworkRecord[]> {
    const cacheKey = 'allNetworks';
    const cachedNetworks = this.cacheNetworks.get<NetworkRecord[]>(cacheKey);
    if (cachedNetworks) {
      return cachedNetworks;
    }

    const networks = await this.fetchAllNetworks();
    networks.sort((a, b) => (a.fullName < b.fullName ? -1 : a.fullName > b.fullName ? 1 : 0));
    this.cacheNetworks.set(cacheKey, networks);
    networks.forEach((network) => {
      this.cacheNetworks.set(network.uniqueId, network);
      if (network.shortId) {
        this.cacheNetworksByShortId.set(network.shortId, network);
      }
    });
    return networks;
  }

    // Fetch all networks from DynamoDB and flatten the items
  async fetchAllNetworks(): Promise<NetworkRecord[]> {
    const params = { TableName: this.tableName };
    try {
      const data = await this.dynamoDbClient.send(new ScanCommand(params));
      return (data.Items || []).map((item) => this.flattenItem(item)) as NetworkRecord[];
    } catch (error) {
      console.error("Error fetching all networks from DynamoDB:", error);
      return [];
    }
  }

    // Method to find Network by uniqueId
  async findNetworkById(networkUniqueId: string) {
    await this.getAllNetworks();
    return this.cacheNetworks.get(networkUniqueId);
  }

  async findNetworkByShortId(queryShortId: string) {
    await this.getAllNetworks();
    return this.cacheNetworksByShortId.get(queryShortId);
  }

  async getNearbyNetworks(networkId: string) {
        // Check if the full dataset is cached
    const cachedNearbyNetworks = this.cacheNearbyNetworks.get(networkId);
    if (cachedNearbyNetworks) {
      return cachedNearbyNetworks;
    }

        // Set up the parameters
    const params = {
      TableName: 'LN-NetworksProximityInfo',
      Key: { uniqueId: { S: networkId } },
      ProjectionExpression: 'nearbyNetworks'
    };

    try {
      const data = await this.dynamoDbClient.send(new GetItemCommand(params));
      if (data.Item?.nearbyNetworks) {
        const flattened = this.flattenItem(data.Item);
        const nearbySource = flattened.nearbyNetworks;
        const nearbyNetworks: NearbyNetwork[] = Array.isArray(nearbySource)
          ? nearbySource
          : typeof nearbySource === 'string'
            ? JSON.parse(nearbySource)
            : [];

        const nearbyNetworksAdj = await Promise.all(
          nearbyNetworks.map(async (network, index) => {
            const networkInfo = (await this.findNetworkById(network.uniqueId)) as NetworkRecord | undefined;
            return {
              ...network,
              fullName: networkInfo?.fullName ?? "Unknown Network",
              roundedDistance: network.distance_miles.toFixed(1),
              elementClass: index >= 3 ? "not-letterbox" : "",
            };
          })
        );

        this.cacheNearbyNetworks.set(networkId, nearbyNetworksAdj);
        return nearbyNetworksAdj;
      }
      console.error(`No nearby networks found for uniqueId: ${networkId}`);
      return [];
    } catch (error) {
      console.error(`Error fetching data for uniqueId ${networkId}:`, error);
      throw error;
    }
  }

  async getBagsInfo(statsUniqueId: string) {
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
    } else {
      const foundNetwork = (await this.findNetworkById(statsUniqueId)) as NetworkRecord | undefined;
      if (foundNetwork) {
        networkFullName = foundNetwork.fullName;
      } else {
        const foundDistrict = (await this.findDistrictById(statsUniqueId)) as DistrictRecord | undefined;
        if (foundDistrict) {
          districtFullName = foundDistrict.fullName;
          isDistrict = true;
        }
      }
    }

    try {
      const params = {
        TableName: 'LN-BagCounts',
        Key: {
          uniqueId: statsUniqueId,
        },
      };

      const result = await this.docClient.send(new GetCommand(params));
      const bagCountData = result.Item;
      let bagsInfo: any;

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
            mostRecentPost: bagCountData.mostRecentPost,
          },
          isDistrict,
          isAll,
        };
      } else if (statsUniqueId !== "all") {
        bagsInfo = JSON.parse(JSON.stringify(await this.getBagsInfo('all')));
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
      } else {
        bagsInfo = {
          networkName: "",
          districtName: "",
          bagCounts: {
            thisMonthName: "",
            thisMonth: '0',
            lastMonthName: "",
            lastMonth: '0',
            thisYearName: "",
            thisYear: '0',
            lastYearName: "",
            lastYear: '0',
            allTime: '0',
            gbsc: '0',
            statsCreatedTime: null,
            mostRecentPost: '-',
          },
          isDistrict: false,
          isAll: true,
        };
      }

      this.cacheBagsInfo.set(statsUniqueId, bagsInfo);
      return bagsInfo;
    } catch (error) {
      console.error('Error fetching data from DynamoDB:', error);
    }
    return null;
  }

  async getCurrentMemberCount(uniqueId: string) {
    const cachedMemberCount = this.cacheCurrentMemberCounts.get(uniqueId);
    if (cachedMemberCount) {
      return cachedMemberCount;
    }

    const memberCount = await this.fetchCurrentMemberCount(uniqueId);
    if (typeof memberCount === 'number') {
      this.cacheCurrentMemberCounts.set(uniqueId, memberCount);
    }

    return memberCount;
  }

  async getAllMemberCounts(): Promise<Map<string, number>> {
    const cached = this.cacheAllMemberCounts.get<Map<string, number>>('allMemberCounts');
    if (cached) {
      return cached;
    }
    const counts = await this.fetchAllMemberCounts();
    this.cacheAllMemberCounts.set('allMemberCounts', counts);
    counts.forEach((value, key) => {
      this.cacheCurrentMemberCounts.set(key, value);
    });
    return counts;
  }

  async fetchCurrentMemberCount(uniqueId: string) {
    const params = {
      TableName: 'LN-MemberCounts',
      KeyConditionExpression: 'uniqueId = :uid',
      ExpressionAttributeValues: {
        ':uid': { S: uniqueId },
      },
      ScanIndexForward: false,
      Limit: 1,
    };

    try {
      const result = await this.dynamoDbClient.send(new QueryCommand(params));
      if (result.Items && result.Items.length > 0) {
        const flattened = this.flattenItem(result.Items[0]);
        return flattened.memberCount;
      }
      return null;
    } catch (error) {
      console.error('Error querying DynamoDB:', error);
      return null;
    }
  }

  private async fetchAllMemberCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    let exclusiveStartKey: Record<string, any> | undefined;

    do {
      const result = await this.dynamoDbClient.send(
        new ScanCommand({
          TableName: 'LN-MemberCounts',
          ProjectionExpression: 'uniqueId, memberCount',
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );

      (result.Items ?? []).forEach((item) => {
        const flattened = this.flattenItem(item);
        if (flattened?.uniqueId) {
          const parsed = typeof flattened.memberCount === 'number' ? flattened.memberCount : Number(flattened.memberCount ?? 0);
          counts.set(flattened.uniqueId, Number.isFinite(parsed) ? parsed : 0);
        }
      });

      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return counts;
  }
}

const instance = new NetworksInfo();

function resetCachesForTests() {
  [
    'cacheNetworks',
    'cacheNetworksByShortId',
    'cacheDistricts',
    'cacheDistrictLocalInfos',
    'cacheNearbyNetworks',
    'cacheBagsInfo',
    'cacheCurrentMemberCounts',
    'cacheAllMemberCounts',
  ].forEach((cacheKey) => {
    const cacheRef = (instance as any)[cacheKey];
    if (cacheRef && typeof cacheRef.flushAll === 'function') {
      cacheRef.flushAll();
    }
  });
}

module.exports = instance;
(module.exports as any).__resetCachesForTests = resetCachesForTests;
export {};
