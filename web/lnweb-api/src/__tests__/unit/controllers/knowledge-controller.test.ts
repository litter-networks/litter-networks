export {};

const mockDynamoSend = jest.fn();
const mockS3Send = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({ send: mockDynamoSend })),
  GetItemCommand: jest.fn((input) => input),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  GetObjectCommand: jest.fn((input) => input),
}));

const {
  getKnowledgePage,
  getChildPages,
  normalizePath,
  extractBodyContent,
  __resetCaches,
} = require('../../../controllers/knowledge-controller');

describe('knowledge-controller utilities', () => {
beforeEach(() => {
  mockDynamoSend.mockReset();
  mockS3Send.mockReset();
  __resetCaches();
});

  it('normalizes knowledge paths consistently', () => {
    expect(normalizePath()).toBe('knowledge');
    expect(normalizePath('  knowledge/foo/bar  ')).toBe('knowledge/foo/bar');
    expect(normalizePath('/foo/bar/')).toBe('knowledge/foo/bar');
    expect(normalizePath('knowledge')).toBe('knowledge');
  });

  it('extracts body content between body tags', () => {
    const html = '<html><body><section>Content</section></body></html>';
    expect(extractBodyContent(html)).toBe('<section>Content</section>');
    expect(extractBodyContent('<div>No body tags</div>')).toBe('<div>No body tags</div>');
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

    const first = await getKnowledgePage('/faq/');
    expect(first).toEqual({
      bodyContent: '<h1>Hello</h1>',
      metadata: { title: 'FAQ', description: 'Desc' },
    });
    expect(mockS3Send).toHaveBeenCalledTimes(1);

    const second = await getKnowledgePage('/faq/');
    expect(second).toEqual(first);
    expect(mockS3Send).toHaveBeenCalledTimes(1);
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
  });

  it('throws when S3 fetch fails', async () => {
    mockS3Send.mockResolvedValue({ Body: undefined });
    await expect(getKnowledgePage('missing')).rejects.toThrow('Failed to fetch knowledge page: knowledge/missing');
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

    const result = await getChildPages('/faq');
    expect(result).toEqual([{ pageUrl: 'knowledge/faq', pageTitle: 'FAQ' }]);
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    const cached = await getChildPages('/faq');
    expect(cached).toEqual(result);
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
  });

  it('returns empty list when DynamoDB has no childPages', async () => {
    mockDynamoSend.mockResolvedValue({});
    await expect(getChildPages('unknown')).resolves.toEqual([]);
  });
});
