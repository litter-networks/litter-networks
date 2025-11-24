const request = require('supertest');

const sampleNetworks = [
  { uniqueId: 'net-1', shortId: 'n1', districtId: 'dist-1', fullName: 'Network One' },
  { uniqueId: 'net-2', shortId: 'n2', districtId: 'dist-1', fullName: 'Network Two' },
];

const sampleDistricts = [
  { uniqueId: 'dist-1', fullName: 'District One' },
];

const sampleDistrictLocalInfos = [
  {
    uniqueId: 'dist-1',
    disposeEmail: 'council@example.org',
    localRecyclingUrl: 'https://council.example.org/recycling',
  },
];

const mockNetworksInfo = {
  getAllNetworks: jest.fn().mockResolvedValue(sampleNetworks),
  getAllDistricts: jest.fn().mockResolvedValue(sampleDistricts),
  getAllDistrictLocalInfos: jest.fn().mockResolvedValue(sampleDistrictLocalInfos),
  getNearbyNetworks: jest.fn().mockResolvedValue([{ uniqueId: 'net-2', fullName: 'Network Two', distance_miles: 1.2 }]),
  getBagsInfo: jest.fn().mockResolvedValue({
    networkName: 'Network One',
    bagCounts: { thisMonth: 5, lastMonth: 4, allTime: 20 },
  }),
  getCurrentMemberCount: jest.fn(async (id) => (id === 'net-1' ? 10 : 5)),
  findNetworkById: jest.fn(async (id) => sampleNetworks.find((n) => n.uniqueId === id) || null),
  findNetworkByShortId: jest.fn(async (id) => sampleNetworks.find((n) => n.shortId === id) || null),
  findDistrictById: jest.fn(async (id) => sampleDistricts.find((d) => d.uniqueId === id) || null),
};

jest.mock('../../utils/networks-info.js', () => mockNetworksInfo);

const mockKnowledgePage = { bodyContent: '<p>Hello knowledge</p>', metadata: { title: 'Test', description: 'Desc' } };
const mockKnowledgeChildren = [{ pageUrl: 'knowledge/foo', pageTitle: 'Foo' }];

jest.mock('../../controllers/knowledge-controller', () => ({
  getKnowledgePage: jest.fn().mockResolvedValue(mockKnowledgePage),
  getChildPages: jest.fn().mockResolvedValue(mockKnowledgeChildren),
}));

const mockAreaInfo = [{ uniqueId: 'dist-1', fullName: 'District One', mapName: 'district_one', mapStyle: 'zone-style-default', networks: [] }];

jest.mock('../../controllers/maps-area-controller', () => ({
  getAreaInfo: jest.fn().mockResolvedValue(mockAreaInfo),
}));

const knowledgeController = require('../../controllers/knowledge-controller');
const { getAreaInfo } = require('../../controllers/maps-area-controller');

let app;

beforeAll(async () => {
  const initializeApp = require('../../app');
  app = await initializeApp();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Full Express app integration', () => {
  it('returns networks list with cache headers', async () => {
    const res = await request(app).get('/info/networks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockNetworksInfo.getAllNetworks).toHaveBeenCalled();
    expect(res.headers['cache-control']).toBe('public, max-age=300, s-maxage=86400');
  });

  it('returns nearby networks data', async () => {
    const res = await request(app).get('/info/networks/net-1/nearby');
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ uniqueId: 'net-2' });
    expect(mockNetworksInfo.getNearbyNetworks).toHaveBeenCalledWith('net-1');
  });

  it('returns bag info for stats endpoint', async () => {
    const res = await request(app).get('/stats/get-bags-info/net-1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ networkName: 'Network One' });
    expect(mockNetworksInfo.getBagsInfo).toHaveBeenCalledWith('net-1');
  });

  it('returns stats summary and aggregates member counts', async () => {
    const res = await request(app).get('/stats/summary/net-1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      memberCountNetwork: 10,
      numNetworksInAll: 2,
      numNetworksInDistrict: 2,
      districtName: 'District One',
    });
  });

  it('returns district local info via join-in route', async () => {
    const res = await request(app).get('/join-in/districts/dist-1/local-info');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ uniqueId: 'dist-1', disposeEmail: 'council@example.org' });
    expect(res.headers['cache-control']).toBe('public, max-age=300, s-maxage=86400');
  });

  it('returns knowledge page and child listings', async () => {
    const pageRes = await request(app).get('/knowledge/page?path=foo');
    expect(pageRes.status).toBe(200);
    expect(pageRes.body).toEqual(mockKnowledgePage);
    expect(knowledgeController.getKnowledgePage).toHaveBeenCalledWith('foo');

    const childRes = await request(app).get('/knowledge/child-pages?path=foo');
    expect(childRes.status).toBe(200);
    expect(childRes.body).toEqual({ childPages: mockKnowledgeChildren });
    expect(knowledgeController.getChildPages).toHaveBeenCalledWith('foo');
  });

  it('returns area info for maps route with cache headers', async () => {
    const res = await request(app).get('/maps/area-info');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ areaInfo: mockAreaInfo });
    expect(res.headers['cache-control']).toBe('public, max-age=300, s-maxage=86400');
  });

  it('handles stats summary errors gracefully', async () => {
    mockNetworksInfo.getAllNetworks.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/stats/summary/net-1');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'An error occurred while fetching the stats summary' });
  });

  it('handles maps area info errors gracefully', async () => {
    getAreaInfo.mockRejectedValueOnce(new Error('nope'));
    const res = await request(app).get('/maps/area-info');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Unable to fetch area info' });
  });
});
