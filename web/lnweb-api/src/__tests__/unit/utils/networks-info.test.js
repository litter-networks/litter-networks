const mockDynamoSend = jest.fn();
const mockDocSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => {
  class BaseCommand {
    constructor(input) {
      this.input = input;
    }
  }
  return {
    DynamoDBClient: jest.fn(() => ({ send: mockDynamoSend })),
    ScanCommand: BaseCommand,
    GetItemCommand: BaseCommand,
    QueryCommand: BaseCommand,
  };
});

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockDocSend })),
  },
  GetCommand: class {
    constructor(input) {
      this.input = input;
    }
  },
}));

const networksInfo = require('../../../utils/networks-info');

const resetCaches = () => {
  if (typeof networksInfo.__resetCachesForTests === 'function') {
    networksInfo.__resetCachesForTests();
  } else {
    ['cacheNetworks', 'cacheNetworksByShortId', 'cacheDistricts', 'cacheDistrictLocalInfos', 'cacheNearbyNetworks', 'cacheBagsInfo', 'cacheCurrentMemberCounts']
      .forEach((cacheKey) => networksInfo[cacheKey]?.flushAll?.());
  }
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
      if (command.input?.TableName === 'LN-NetworksInfo') {
        return {
          Items: [
            { uniqueId: { S: 'net-b' }, shortId: { S: 'b' }, fullName: { S: 'Beta' } },
            { uniqueId: { S: 'net-a' }, shortId: { S: 'a' }, fullName: { S: 'Alpha' } },
          ],
        };
      }
      throw new Error(`Unexpected table ${command.input?.TableName}`);
    });

    const networks = await networksInfo.getAllNetworks();
    expect(networks.map((n) => n.fullName)).toEqual(['Alpha', 'Beta']);
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    // Cached responses should not trigger additional scans
    await networksInfo.getAllNetworks();
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    const byId = await networksInfo.findNetworkById('net-a');
    expect(byId.fullName).toBe('Alpha');

    const byShortId = await networksInfo.findNetworkByShortId('b');
    expect(byShortId.uniqueId).toBe('net-b');
  });

  it('enriches nearby networks and caches results', async () => {
    networksInfo.cacheNetworks.set('net-1', { uniqueId: 'net-1', fullName: 'Network One' });
    networksInfo.cacheNetworks.set('net-2', { uniqueId: 'net-2', fullName: 'Network Two' });
    networksInfo.cacheNetworks.set('allNetworks', [
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
    expect(info.isAll).toBe(true);
    expect(info.bagCounts).toMatchObject({
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

    networksInfo.cacheNetworks.set('net-x', { uniqueId: 'net-x', fullName: 'Extra Network' });
    mockDocSend.mockResolvedValueOnce({}); // No bag data for net-x

    const info = await networksInfo.getBagsInfo('net-x');
    expect(info.networkName).toBe('Extra Network');
    expect(info.bagCounts).toMatchObject({
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
});
