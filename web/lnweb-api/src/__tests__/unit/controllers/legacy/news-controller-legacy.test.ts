// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

export {};

const { createRequest, createResponse } = require('node-mocks-http');

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({ send: mockSend })),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend })),
  },
  QueryCommand: jest.fn((input) => input),
  ScanCommand: jest.fn((input) => input),
}));

const writeCalls = [];
let lastCsvStream = null;

jest.mock('@fast-csv/format', () => ({
  format: jest.fn(() => {
    const stream = {
      pipe: jest.fn(),
      write: jest.fn((row) => writeCalls.push(row)),
      end: jest.fn(),
    };
    lastCsvStream = stream;
    return stream;
  }),
}));

const csvController = require('../../../../controllers/legacy/news-controller-legacy');

function buildReq(query = {}) {
  return createRequest({
    method: 'GET',
    url: '/news/get-press-cuttings-csv',
    query,
  });
}

describe('legacy news CSV controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    writeCalls.length = 0;
    lastCsvStream = null;
  });

  it('streams CSV rows via scans when no scope provided', async () => {
    mockSend
      .mockResolvedValueOnce({
        Items: [{ scope: 'global', title: 'One', articleDate: '2025-01-01' }],
        LastEvaluatedKey: { next: true },
      })
      .mockResolvedValueOnce({
        Items: [{ scope: 'global', title: 'Two', articleDate: '2025-01-02' }],
      });

    const res = createResponse({ eventEmitter: require('events').EventEmitter });
    await csvController.getPressCuttingsCsvDeprecated(buildReq(), res);
    expect(lastCsvStream.pipe).toHaveBeenCalledWith(res);
    expect(writeCalls.length).toBe(2);
    const titles = writeCalls.map((row) => row.title);
    expect(titles).toContain('One');
    expect(titles).toContain('Two');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('queries when scope parameters are provided', async () => {
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ scope: 'area', scopeId: 'net-1', title: 'Area', articleDate: '2025-02-01' }],
    }));

    const res = createResponse({ eventEmitter: require('events').EventEmitter });
    await csvController.getPressCuttingsCsvDeprecated(buildReq({ scope: 'scope', scopeId: 'scopeId' }), res);
    expect(writeCalls[0]).toMatchObject({ scopeId: 'net-1' });
    expect(mockSend).toHaveBeenCalled();
  });

  it('returns 500 when Dynamo errors', async () => {
    mockSend.mockRejectedValue(new Error('boom'));
    const res = createResponse({ eventEmitter: require('events').EventEmitter });
    await csvController.getPressCuttingsCsvDeprecated(buildReq(), res);
    expect(res.statusCode).toBe(500);
    expect(res._getData()).toContain('Error retrieving data');
  });
});
