// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

jest.mock('@aws-sdk/client-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBClient: jest.fn(() => ({ send: mockSend })),
    GetItemCommand: jest.fn((input) => input),
    __mockSend: mockSend,
  };
});
jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();
  return {
    S3Client: jest.fn(() => ({ send: mockSend })),
    GetObjectCommand: jest.fn((input) => input),
    __mockSend: mockSend,
  };
});

const { __mockSend: mockDynamoSend } = require('@aws-sdk/client-dynamodb');
const { __mockSend: mockS3Send } = require('@aws-sdk/client-s3');

const {
  getKnowledgePage: getKnowledgePageFn,
  getChildPages: getChildPagesFn,
  normalizePath: normalizePathFn,
  extractBodyContent: extractBodyContentFn,
  __resetCaches: resetCachesFn,
} = require('../../../controllers/knowledge-controller');

describe('knowledge-controller utilities', () => {
beforeEach(() => {
  mockDynamoSend.mockReset();
  mockS3Send.mockReset();
  resetCachesFn();
});

  it('normalizes knowledge paths consistently', () => {
    expect(normalizePathFn()).toBe('knowledge');
    expect(normalizePathFn('  knowledge/foo/bar  ')).toBe('knowledge/foo/bar');
    expect(normalizePathFn('/foo/bar/')).toBe('knowledge/foo/bar');
    expect(normalizePathFn('knowledge')).toBe('knowledge');
  });

  it('extracts body content between body tags', () => {
    const html = '<html><body><section>Content</section></body></html>';
    expect(extractBodyContentFn(html)).toBe('<section>Content</section>');
    expect(extractBodyContentFn('<div>No body tags</div>')).toBe('<div>No body tags</div>');
  });

  it('fetches and caches knowledge pages with Dynamo metadata', async () => {
    const html = '<html><body><h1>Hello</h1></body></html>';
    mockS3Send.mockResolvedValue({
      Body: Buffer.from(html, 'utf-8'),
    });
    mockDynamoSend.mockResolvedValue({
      Item: {
        title: { S: 'FAQ' },
        description: { S: 'Desc' },
      },
    });

    const first = await getKnowledgePageFn('/faq/');
    expect(first).toEqual({
      bodyContent: '<h1>Hello</h1>',
      metadata: { title: 'FAQ', description: 'Desc' },
    });
    expect(mockS3Send).toHaveBeenCalledTimes(1);

    const second = await getKnowledgePageFn('/faq/');
    expect(second).toEqual(first);
    expect(mockS3Send).toHaveBeenCalledTimes(1);
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
  });

  it('throws when S3 fetch fails', async () => {
    mockS3Send.mockResolvedValue({ Body: undefined });
    await expect(getKnowledgePageFn('missing')).rejects.toThrow('Failed to fetch knowledge page: knowledge/missing');
  });

  it('fetches and caches child pages from DynamoDB', async () => {
    const response = {
      Item: {
        childPages: {
          S: JSON.stringify([{ pageUrl: 'docs/knowledge/faq', pageTitle: 'FAQ' }]),
        },
      },
    };
    mockDynamoSend.mockResolvedValue(response);

    const result = await getChildPagesFn('/faq');
    expect(result).toEqual([{ pageUrl: 'knowledge/faq', pageTitle: 'FAQ' }]);
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    const cached = await getChildPagesFn('/faq');
    expect(cached).toEqual(result);
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
  });

  it('returns empty list when DynamoDB has no childPages', async () => {
    mockDynamoSend.mockResolvedValue({});
    await expect(getChildPagesFn('unknown')).resolves.toEqual([]);
  });
});
