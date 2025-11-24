import { sendRequest, getJson, resetMocks, mockNetworksInfo } from './helpers/appFixture';

describe('Join-in routes', () => {
  beforeEach(resetMocks);

  it('returns local info for district', async () => {
    const res = await sendRequest('GET', '/join-in/districts/dist-1/local-info');
    expect(res.statusCode).toBe(200);
    expect(getJson(res)).toHaveProperty('disposeEmail', 'council@example.org');
  });

  it('returns 404 when district info missing', async () => {
    mockNetworksInfo.getAllDistrictLocalInfos.mockResolvedValueOnce([]);
    const res = await sendRequest('GET', '/join-in/districts/unknown/local-info');
    expect(res.statusCode).toBe(404);
    expect(getJson(res)).toEqual({ error: 'District local info not found' });
  });
});
