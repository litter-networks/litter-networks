import { sendRequest, getJson, newsController, resetMocks } from './helpers/appFixture';

describe('News routes', () => {
  beforeEach(resetMocks);

  it('returns JSON feed', async () => {
    const res = await sendRequest('GET', '/news/get-press-cuttings-json');
    expect(res.statusCode).toBe(200);
    expect(getJson(res)).toEqual([{ uniqueId: 'n1', title: 'News' }]);
  });

  it('returns error when controller fails', async () => {
    newsController.fetchNextNewsItems.mockResolvedValueOnce(null);
    const res = await sendRequest('GET', '/news/get-press-cuttings-json');
    expect(res.statusCode).toBe(500);
  });

  it('serves legacy CSV', async () => {
    const res = await sendRequest('GET', '/news/get-press-cuttings-csv');
    expect(res.statusCode).toBe(200);
    expect(res._getData()).toContain('scope,scopeId');
  });
});
