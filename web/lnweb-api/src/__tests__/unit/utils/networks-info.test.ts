// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import networksInfo, { resetCachesForTests } from '../../../utils/networks-info';

jest.mock('@aws-sdk/client-dynamodb', () => {
  class BaseCommand {
    constructor(public input: any) {
      this.input = input;
    }
  }
  const mockSend = jest.fn();
  return {
    DynamoDBClient: jest.fn(() => ({ send: mockSend })),
    ScanCommand: BaseCommand,
    GetItemCommand: BaseCommand,
    QueryCommand: BaseCommand,
    __mockSend: mockSend,
  };
});

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({ send: mockSend })),
    },
    GetCommand: class {
      constructor(public input: any) {
        this.input = input;
      }
    },
    __mockSend: mockSend,
  };
});

const { __mockSend: mockDynamoSend } = require('@aws-sdk/client-dynamodb') as { __mockSend: jest.Mock };
const { __mockSend: mockDocSend } = require('@aws-sdk/lib-dynamodb') as { __mockSend: jest.Mock };

const networksInfoAny = networksInfo as any;

const resetCaches = () => {
  resetCachesForTests();
};

describe('NetworksInfo utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCaches();
  });

  it('flattens DynamoDB attribute structures', () => {
    expect(networksInfo.flattenItem({ S: 'foo' })).toBe('foo');
    expect(networksInfo.flattenItem({ N: '42' })).toBe(42);
    expect(networksInfo.flattenItem({ BOOL: true })).toBe(true);
    expect(networksInfo.flattenItem({ NULL: true })).toBeNull();
    expect(networksInfo.flattenItem([{ S: 'a' }, { N: '1' }])).toEqual(['a', 1]);
    expect(networksInfo.flattenItem({ M: { nested: { S: 'value' } } })).toEqual({ nested: 'value' });
  });

  it('returns sorted networks and caches lookups', async () => {
    mockDynamoSend.mockImplementation(async (command) => {
      const input = (command as any).input;
      if (input?.TableName === 'LN-NetworksInfo') {
        return {
          Items: [
            { uniqueId: { S: 'net-b' }, shortId: { S: 'b' }, fullName: { S: 'Beta' } },
            { uniqueId: { S: 'net-a' }, shortId: { S: 'a' }, fullName: { S: 'Alpha' } },
          ],
        };
      }
      throw new Error(`Unexpected table ${input?.TableName}`);
    });

    const networks = await networksInfo.getAllNetworks();
    expect(networks.map((n: { fullName: string }) => n.fullName)).toEqual(['Alpha', 'Beta']);
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    // Cached responses should not trigger additional scans
    await networksInfo.getAllNetworks();
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    const byId = await networksInfo.findNetworkById('net-a');
    expect(byId).toBeTruthy();
    expect(byId!.fullName).toBe('Alpha');

    const byShortId = await networksInfo.findNetworkByShortId('b');
    expect(byShortId).toBeTruthy();
    expect(byShortId!.uniqueId).toBe('net-b');
  });

  it('enriches nearby networks and caches results', async () => {
    networksInfoAny.cacheNetworks.set('net-1', { uniqueId: 'net-1', fullName: 'Network One' });
    networksInfoAny.cacheNetworks.set('net-2', { uniqueId: 'net-2', fullName: 'Network Two' });
    networksInfoAny.cacheNetworks.set('allNetworks', [
      { uniqueId: 'net-1', fullName: 'Network One' },
      { uniqueId: 'net-2', fullName: 'Network Two' },
    ]);

    mockDynamoSend.mockResolvedValueOnce({
      Item: {
        nearbyNetworks: {
          S: JSON.stringify([
            { uniqueId: 'net-2', distance_miles: 1.234 },
          ]),
        },
      },
    });

    const result = await networksInfo.getNearbyNetworks('net-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      uniqueId: 'net-2',
      fullName: 'Network Two',
      roundedDistance: '1.2',
      elementClass: '',
    });
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    await networksInfo.getNearbyNetworks('net-1');
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
  });

  it('caches bag info responses from DynamoDB', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: {
        thisMonthName: 'Jan',
        thisMonth: 10,
        lastMonthName: 'Dec',
        lastMonth: 5,
        thisYearName: '2025',
        thisYear: 100,
        lastYearName: '2024',
        lastYear: 80,
        allTime: 400,
        gbsc: 12,
        statsCreatedTime: 'time',
        mostRecentPost: 'now',
      },
    });

    const info = await networksInfo.getBagsInfo('all');
    expect(info).not.toBeNull();
    expect(info!.isAll).toBe(true);
    expect(info!.bagCounts).toMatchObject({
      thisMonth: 10,
      lastMonth: 5,
      allTime: 400,
    });
    expect(mockDocSend).toHaveBeenCalledTimes(1);

    await networksInfo.getBagsInfo('all');
    expect(mockDocSend).toHaveBeenCalledTimes(1);
  });

  it('falls back to template when bag info is missing', async () => {
    // Prime the "all" cache
    mockDocSend.mockResolvedValueOnce({
      Item: {
        thisMonthName: 'Jan',
        thisMonth: 10,
        lastMonthName: 'Dec',
        lastMonth: 5,
        thisYearName: '2025',
        thisYear: 100,
        lastYearName: '2024',
        lastYear: 80,
        allTime: 400,
        gbsc: 12,
        statsCreatedTime: 'time',
        mostRecentPost: 'now',
      },
    });
    await networksInfo.getBagsInfo('all');

    networksInfoAny.cacheNetworks.set('net-x', { uniqueId: 'net-x', fullName: 'Extra Network' });
    mockDocSend.mockResolvedValueOnce({}); // No bag data for net-x

    const info = await networksInfo.getBagsInfo('net-x');
    expect(info).not.toBeNull();
    expect(info!.networkName).toBe('Extra Network');
    expect(info!.bagCounts).toMatchObject({
      thisMonth: '0',
      allTime: '0',
    });
    expect(mockDocSend).toHaveBeenCalledTimes(2);
  });

  it('caches current member counts', async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Items: [
        {
          memberCount: { N: '123' },
        },
      ],
    });

    const count = await networksInfo.getCurrentMemberCount('net-1');
    expect(count).toBe(123);
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    const again = await networksInfo.getCurrentMemberCount('net-1');
    expect(again).toBe(123);
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
  });

  it('returns null when member count query has no items', async () => {
    mockDynamoSend.mockResolvedValueOnce({ Items: [] });
    const count = await networksInfo.getCurrentMemberCount('net-missing');
    expect(count).toBeNull();
  });

  it('returns districts and caches them', async () => {
    mockDynamoSend.mockImplementation(async (command) => {
      const input = (command as any).input;
      if (input?.TableName === 'LN-DistrictsInfo') {
        return { Items: [{ uniqueId: 'district1', fullName: 'District One' }] };
      }
      return { Items: [] };
    });

    const districts = await networksInfo.getAllDistricts();
    expect(districts[0].uniqueId).toBe('district1');
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    await networksInfo.getAllDistricts();
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    const found = await networksInfo.findDistrictById('district1');
    expect(found).toBeTruthy();
    expect(found!.fullName).toBe('District One');
  });

  it('returns district local infos and caches them', async () => {
    mockDynamoSend.mockImplementation(async (command) => {
      const input = (command as any).input;
      if (input?.TableName === 'LN-DistrictsLocalInfo') {
        return { Items: [{ uniqueId: 'district1', info: 'x' }] };
      }
      return { Items: [] };
    });

    const infos = await networksInfo.getAllDistrictLocalInfos();
    expect(infos).toHaveLength(1);
    await networksInfo.getAllDistrictLocalInfos();
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
  });

  it('handles errors when fetching districts', async () => {
    mockDynamoSend.mockRejectedValueOnce(new Error('boom'));
    const districts = await networksInfo.getAllDistricts();
    expect(districts).toEqual([]);
  });

  it('handles errors when fetching district local infos', async () => {
    mockDynamoSend.mockRejectedValueOnce(new Error('boom'));
    const infos = await networksInfo.getAllDistrictLocalInfos();
    expect(infos).toEqual([]);
  });
});
