const {
  sendRequest,
  getJson,
  resetMocks,
  getAreaInfo,
  mockSsmSend,
  mockFetch,
} = require('./helpers/appFixture');

describe('Maps routes', () => {
  beforeEach(resetMocks);

  it('returns cached area info', async () => {
    const res = await sendRequest('GET', '/maps/area-info');
    expect(res.statusCode).toBe(200);
    expect(getJson(res)).toHaveProperty('areaInfo');
  });

  it('propagates area failures', async () => {
    getAreaInfo.mockRejectedValueOnce(new Error('boom'));
    const res = await sendRequest('GET', '/maps/area-info');
    expect(res.statusCode).toBe(500);
    expect(getJson(res)).toEqual({ error: 'Unable to fetch area info' });
  });

  it('proxies snap-route via OpenRouteService', async () => {
    mockSsmSend.mockResolvedValueOnce({ Parameter: { Value: 'key' } });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ snapped: true }),
    });
    const res = await sendRequest('POST', '/maps/snap-route', { body: { coordinates: [[0, 0]] } });
    expect(res.statusCode).toBe(200);
    expect(getJson(res)).toEqual({ snapped: true });
  });

  it('returns 503 when API key missing', async () => {
    mockSsmSend.mockResolvedValueOnce({});
    const res = await sendRequest('POST', '/maps/snap-route', { body: {} });
    expect(res.statusCode).toBe(503);
    expect(getJson(res)).toEqual({ error: 'Routing service temporarily unavailable' });
  });

  it('fails when OpenRoute returns error', async () => {
    mockSsmSend.mockResolvedValueOnce({ Parameter: { Value: 'key' } });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const res = await sendRequest('POST', '/maps/snap-route', { body: {} });
    expect(res.statusCode).toBe(500);
    expect(getJson(res)).toEqual({ error: 'Failed to process request' });
  });
});
