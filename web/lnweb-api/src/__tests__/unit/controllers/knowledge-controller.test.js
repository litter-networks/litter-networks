const mockDynamoSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({ send: mockDynamoSend })),
  GetItemCommand: jest.fn((input) => input),
}));

const {
  getKnowledgePage,
  getChildPages,
  normalizePath,
  extractMetadata,
  extractBodyContent,
  __resetCaches,
} = require('../../../controllers/knowledge-controller');

describe('knowledge-controller utilities', () => {
  beforeEach(() => {
    mockDynamoSend.mockReset();
    __resetCaches();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    delete global.fetch;
  });

  it('normalizes knowledge paths consistently', () => {
    expect(normalizePath()).toBe('knowledge');
    expect(normalizePath('  knowledge/foo/bar  ')).toBe('knowledge/foo/bar');
    expect(normalizePath('/foo/bar/')).toBe('knowledge/foo/bar');
    expect(normalizePath('knowledge')).toBe('knowledge');
  });

  it('extracts metadata from head tags', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Custom Title" />
          <meta property="og:description" content="Custom description." />
        </head>
        <body><p>Body</p></body>
      </html>`;
    expect(extractMetadata(html)).toEqual({
      'og:title': 'Custom Title',
      'og:description': 'Custom description.',
    });
  });

  it('extracts body content between body tags', () => {
    const html = '<html><body><section>Content</section></body></html>';
    expect(extractBodyContent(html)).toBe('<section>Content</section>');
    expect(extractBodyContent('<div>No body tags</div>')).toBe('<div>No body tags</div>');
  });

  it('fetches and caches knowledge pages', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="FAQ" />
          <meta property="og:description" content="Desc" />
        </head>
        <body><h1>Hello</h1></body>
      </html>`;
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () => html,
    });

    const first = await getKnowledgePage('/faq/');
    expect(first).toEqual({
      bodyContent: '<h1>Hello</h1>',
      metadata: { title: 'FAQ', description: 'Desc' },
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const second = await getKnowledgePage('/faq/');
    expect(second).toEqual(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when CDN fetch fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      text: async () => '',
    });
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
