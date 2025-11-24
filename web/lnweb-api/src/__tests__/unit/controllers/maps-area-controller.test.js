const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  ScanCommand: jest.fn((params) => params),
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend })),
  },
}));

const {
  getAreaInfo,
  isNetworkInDistrict,
  fetchTable,
  __resetCache,
} = require('../../../controllers/maps-area-controller');

describe('maps-area-controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetCache();
  });

  describe('isNetworkInDistrict', () => {
    it('identifies matching district IDs', () => {
      expect(isNetworkInDistrict('a,b,c', 'b')).toBe(true);
      expect(isNetworkInDistrict('a, b , c', 'b')).toBe(true);
      expect(isNetworkInDistrict(null, 'b')).toBe(false);
      expect(isNetworkInDistrict('a,b', '')).toBe(false);
    });
  });

  describe('fetchTable', () => {
    it('paginates until LastEvaluatedKey is falsy', async () => {
      mockSend.mockImplementation(async (params) => {
        if (!params.ExclusiveStartKey) {
          return { Items: [{ id: 1 }], LastEvaluatedKey: { next: true } };
        }
        return { Items: [{ id: 2 }] };
      });

      const rows = await fetchTable('TestTable');
      expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAreaInfo', () => {
    it('builds aggregated info and caches it', async () => {
      mockSend.mockImplementation(async ({ TableName }) => {
        if (TableName === 'LN-DistrictsInfo') {
          return { Items: [{ uniqueId: 'dist-1', fullName: 'District', mapStyle: 'foo' }] };
        }
        if (TableName === 'LN-NetworksInfo') {
          return {
            Items: [{ uniqueId: 'net-1', fullName: 'Network', districtId: 'dist-1' }],
          };
        }
        if (TableName === 'LN-NetworksMapInfo') {
          return { Items: [{ uniqueId: 'net-1', mapSource: 'custom', mapFile: 'mapfile' }] };
        }
        return { Items: [] };
      });

      const first = await getAreaInfo();
      expect(first[0]).toMatchObject({
        uniqueId: 'dist-1',
        mapStyle: 'zone-style-foo',
        networks: [
          { uniqueId: 'net-1', mapSource: 'custom', mapFile: 'mapfile' },
        ],
      });

      mockSend.mockClear();
      const cached = await getAreaInfo();
      expect(cached).toEqual(first);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('re-throws on Dynamo failure with descriptive error', async () => {
      mockSend.mockRejectedValue(new Error('boom'));
      await expect(getAreaInfo()).rejects.toThrow('Failed to retrieve area information');
    });
  });
});
