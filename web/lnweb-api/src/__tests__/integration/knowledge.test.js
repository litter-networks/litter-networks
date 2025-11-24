const { sendRequest, getJson, knowledgeController, resetMocks } = require('./helpers/appFixture');

describe('Knowledge routes', () => {
  beforeEach(resetMocks);

  it('returns page and children payloads', async () => {
    const pageRes = await sendRequest('GET', '/knowledge/page?path=foo');
    expect(pageRes.statusCode).toBe(200);
    expect(getJson(pageRes)).toHaveProperty('metadata');
    expect(knowledgeController.getKnowledgePage).toHaveBeenCalledWith('foo');

    const childRes = await sendRequest('GET', '/knowledge/child-pages?path=foo');
    expect(childRes.statusCode).toBe(200);
    expect(getJson(childRes)).toHaveProperty('childPages');
  });

  it('returns 500 when controller fails', async () => {
    knowledgeController.getKnowledgePage.mockRejectedValueOnce(new Error('fail'));
    const res = await sendRequest('GET', '/knowledge/page?path=foo');
    expect(res.statusCode).toBe(500);
    expect(getJson(res)).toEqual({ error: 'Unable to fetch knowledge page' });
  });
});
