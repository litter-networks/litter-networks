const { createRequest, createResponse } = require('node-mocks-http');
const { EventEmitter } = require('events');

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

jest.mock('../../../utils/networks-info.js', () => mockNetworksInfo);

const mockKnowledgePage = { bodyContent: '<p>Hello knowledge</p>', metadata: { title: 'Test', description: 'Desc' } };
const mockKnowledgeChildren = [{ pageUrl: 'knowledge/foo', pageTitle: 'Foo' }];

jest.mock('../../../controllers/knowledge-controller', () => ({
  getKnowledgePage: jest.fn().mockResolvedValue(mockKnowledgePage),
  getChildPages: jest.fn().mockResolvedValue(mockKnowledgeChildren),
}));

const mockAreaInfo = [{ uniqueId: 'dist-1', fullName: 'District One', mapName: 'district_one', mapStyle: 'zone-style-default', networks: [] }];

jest.mock('../../../controllers/maps-area-controller', () => ({
  getAreaInfo: jest.fn().mockResolvedValue(mockAreaInfo),
}));

const knowledgeController = require('../../../controllers/knowledge-controller');
const { getAreaInfo } = require('../../../controllers/maps-area-controller');
const mapsRouterInstance = require('../../../routes/maps');

jest.mock('../../../controllers/news-controller', () => ({
  fetchNextNewsItems: jest.fn().mockResolvedValue([{ uniqueId: 'n1', title: 'News' }]),
}));

const newsController = require('../../../controllers/news-controller');

jest.mock('../../../controllers/legacy/news-controller-legacy.js', () => ({
  getPressCuttingsCsvDeprecated: jest.fn((req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.send('scope,scopeId\n');
  }),
}));

const mockSsmSend = jest.fn();
const mockFetch = jest.fn();

jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn(() => ({ send: mockSsmSend })),
  GetParameterCommand: jest.fn((input) => input),
}));

global.fetch = mockFetch;

let appPromise;

async function getApp() {
  if (!appPromise) {
    const initializeApp = require('../../../app');
    appPromise = initializeApp();
  }
  return appPromise;
}

function createReqRes(method, path, { body, headers, query } = {}) {
  const req = createRequest({
    method,
    url: path,
    headers,
    body,
    query,
  });
  const res = createResponse({ eventEmitter: EventEmitter });
  return { req, res };
}

async function sendRequest(method, path, options) {
  const app = await getApp();
  const { req, res } = createReqRes(method, path, options);
  return new Promise((resolve) => {
    const cleanup = () => resolve(res);
    res.on('end', cleanup);
    res.on('finish', cleanup);
    app.handle(req, res);
  });
}

function getJson(res) {
  const data = res._getData();
  if (!data) return null;
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function resetMocks() {
  jest.clearAllMocks();
  mockFetch.mockReset();
  if (typeof mapsRouterInstance.resetOpenRouteKey === 'function') {
    mapsRouterInstance.resetOpenRouteKey();
  }
}

module.exports = {
  sendRequest,
  getJson,
  mockNetworksInfo,
  knowledgeController,
  getAreaInfo,
  newsController,
  mockSsmSend,
  mockFetch,
  mapsRouterInstance,
  resetMocks,
};
