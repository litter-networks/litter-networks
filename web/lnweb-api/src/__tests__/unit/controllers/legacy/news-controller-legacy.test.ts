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
}));

const libDynamoMock = require('@aws-sdk/lib-dynamodb');

type CsvRow = Record<string, unknown>;
const writeCalls: CsvRow[] = [];
type CsvStream = {
  pipe: jest.Mock;
  write: jest.Mock;
  end: jest.Mock;
};
let lastCsvStream: CsvStream | null = null;

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

function buildReq(params?: { scope?: string; scopeId?: string }) {
  const url =
    params?.scope && params?.scopeId
      ? `/news/get-press-cuttings-csv/${params.scope}/${params.scopeId}`
      : '/news/get-press-cuttings-csv';
  return createRequest({
    method: 'GET',
    url,
    params,
  });
}

describe('legacy news CSV controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    writeCalls.length = 0;
    lastCsvStream = null;
  });

  it('queries all press cuttings when no scope provided', async () => {
    mockSend
      .mockResolvedValueOnce({
        Items: [{ scope: 'area', scopeId: 'net-1', title: 'One', articleDate: '2025-01-01' }],
        LastEvaluatedKey: { next: true },
      })
      .mockResolvedValueOnce({
        Items: [{ scope: 'area', scopeId: 'net-1', title: 'Two', articleDate: '2025-01-02' }],
      });

    const res = createResponse({ eventEmitter: require('events').EventEmitter });
    await csvController.getPressCuttingsCsvDeprecated(buildReq(), res);
    if (!lastCsvStream) {
      throw new Error('CSV stream was not initialized');
    }
    expect(lastCsvStream.pipe).toHaveBeenCalledWith(res);
    expect(writeCalls.length).toBe(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('returns 500 when Dynamo errors', async () => {
    mockSend.mockRejectedValue(new Error('boom'));
    const res = createResponse({ eventEmitter: require('events').EventEmitter });
    await csvController.getPressCuttingsCsvDeprecated(buildReq(), res);
    expect(res.statusCode).toBe(500);
    expect(res._getData()).toContain('Error retrieving data');
  });

  it('adds filter expressions when scope params provided', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [{ scope: 'area', scopeId: 'net-1', title: 'Scoped', articleDate: '2025-02-01' }],
    });
    const res = createResponse({ eventEmitter: require('events').EventEmitter });
    await csvController.getPressCuttingsCsvDeprecated(buildReq({ scope: 'area', scopeId: 'net-1' }), res);
    const lastCallInput = libDynamoMock.QueryCommand.mock.calls.at(-1)?.[0];
    expect(lastCallInput?.FilterExpression).toContain('#scope = :scope');
    expect(lastCallInput?.FilterExpression).toContain('#scopeId = :scopeId');
    expect(lastCallInput?.ExpressionAttributeValues?.[':scope']).toBe('area');
    expect(lastCallInput?.ExpressionAttributeValues?.[':scopeId']).toBe('net-1');
  });
});
