// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { createRequest, createResponse } from 'node-mocks-http';
import { EventEmitter } from 'events';
import type { Application, RequestHandler } from 'express';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type SampleNetwork = {
  uniqueId: string;
  shortId: string;
  districtId: string;
  fullName: string;
};

type SampleDistrict = {
  uniqueId: string;
  fullName: string;
};

type SampleDistrictInfo = {
  uniqueId: string;
  disposeEmail: string;
  localRecyclingUrl: string;
};

const sampleNetworks: SampleNetwork[] = [
  { uniqueId: 'net-1', shortId: 'n1', districtId: 'dist-1', fullName: 'Network One' },
  { uniqueId: 'net-2', shortId: 'n2', districtId: 'dist-1', fullName: 'Network Two' },
];

const sampleDistricts: SampleDistrict[] = [
  { uniqueId: 'dist-1', fullName: 'District One' },
];

const sampleDistrictLocalInfos: SampleDistrictInfo[] = [
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
  getNearbyNetworks: jest
    .fn()
    .mockResolvedValue([{ uniqueId: 'net-2', fullName: 'Network Two', distance_miles: 1.2 }]),
  getBagsInfo: jest.fn().mockResolvedValue({
    networkName: 'Network One',
    bagCounts: { thisMonth: 5, lastMonth: 4, allTime: 20 },
  }),
  getCurrentMemberCount: jest.fn(async (id: string) => (id === 'net-1' ? 10 : 5)),
  getAllMemberCounts: jest.fn(async () => new Map([
    ['net-1', 10],
    ['net-2', 5],
  ])),
  findNetworkById: jest.fn(async (id: string) => sampleNetworks.find((n) => n.uniqueId === id) || null),
  findNetworkByShortId: jest.fn(async (id: string) => sampleNetworks.find((n) => n.shortId === id) || null),
  findDistrictById: jest.fn(async (id: string) => sampleDistricts.find((d) => d.uniqueId === id) || null),
};

jest.mock('../../../utils/networks-info.js', () => mockNetworksInfo);

const mockKnowledgePage = { bodyContent: '<p>Hello knowledge</p>', metadata: { title: 'Test', description: 'Desc' } };
const mockKnowledgeChildren = [{ pageUrl: 'knowledge/foo', pageTitle: 'Foo' }];

jest.mock('../../../controllers/knowledge-controller', () => ({
  getKnowledgePage: jest.fn().mockResolvedValue(mockKnowledgePage),
  getChildPages: jest.fn().mockResolvedValue(mockKnowledgeChildren),
}));

const mockAreaInfo = [
  { uniqueId: 'dist-1', fullName: 'District One', mapName: 'district_one', mapStyle: 'zone-style-default', networks: [] },
];

jest.mock('../../../controllers/maps-area-controller', () => ({
  getAreaInfo: jest.fn().mockResolvedValue(mockAreaInfo),
}));

type KnowledgeControllerMocks = {
  getKnowledgePage: jest.Mock;
  getChildPages: jest.Mock;
};

type MapsAreaControllerMocks = {
  getAreaInfo: jest.Mock;
};

type NewsControllerMocks = {
  fetchNextNewsItems: jest.Mock;
};

const knowledgeController = require('../../../controllers/knowledge-controller') as KnowledgeControllerMocks;
const mapsAreaController = require('../../../controllers/maps-area-controller') as MapsAreaControllerMocks;
const { getAreaInfo } = mapsAreaController;
const mapsRouterInstance = require('../../../routes/maps') as {
  resetOpenRouteKey?: () => void;
} & RequestHandler;

jest.mock('../../../controllers/news-controller', () => ({
  fetchNextNewsItems: jest.fn().mockResolvedValue([{ uniqueId: 'n1', title: 'News' }]),
}));

const newsController = require('../../../controllers/news-controller') as NewsControllerMocks;

jest.mock('../../../controllers/legacy/news-controller-legacy.js', () => ({
  getPressCuttingsCsvDeprecated: jest.fn((req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.send('scope,scopeId\n');
  }),
}));

const mockFetch = jest.fn();

jest.mock('@aws-sdk/client-ssm', () => {
  const mockSend = jest.fn();
  return {
    SSMClient: jest.fn(() => ({ send: mockSend })),
    GetParameterCommand: jest.fn((input) => input),
    __mockSend: mockSend,
  };
});

const { __mockSend: mockSsmSend } = require('@aws-sdk/client-ssm');

(global as any).fetch = mockFetch;

let appPromise: Promise<Application> | null = null;

async function getApp(): Promise<Application> {
  if (!appPromise) {
    const initializeApp = require('../../../app') as () => Promise<Application>;
    appPromise = initializeApp();
  }
  return appPromise;
}

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
};

function createReqRes(method: HttpMethod, path: string, { body, headers, query }: RequestOptions = {}) {
  const req = createRequest({
    method,
    url: path,
    headers,
    body: body as Record<string, unknown> | undefined,
    query,
  });
  const res = createResponse({ eventEmitter: EventEmitter });
  (res as any).pipes = [];
  return { req, res };
}

type IntegrationResponse = ReturnType<typeof createResponse> & {
  statusCode: number;
  getHeader(name: string): string | number | string[] | undefined;
};

async function sendRequest(method: HttpMethod, path: string, options?: RequestOptions): Promise<IntegrationResponse> {
  const app = await getApp();
  const { req, res } = createReqRes(method, path, options);
  return new Promise((resolve) => {
    const cleanup = () => resolve(res as IntegrationResponse);
    res.on('end', cleanup);
    res.on('finish', cleanup);
    (app as unknown as { handle: (req: unknown, res: unknown) => void }).handle(req, res);
  });
}

function getJson(res: IntegrationResponse): any {
  const data = res._getData();
  if (!data) return null;
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function resetMocks(): void {
  jest.clearAllMocks();
  mockFetch.mockReset();
  if (typeof mapsRouterInstance.resetOpenRouteKey === 'function') {
    mapsRouterInstance.resetOpenRouteKey();
  }
}

export {
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
