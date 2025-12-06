// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { sendRequest, getJson, mockNetworksInfo, resetMocks } from './helpers/appFixture';

describe('Stats routes', () => {
  beforeEach(resetMocks);

  it('returns bag info for known network', async () => {
    const res = await sendRequest('GET', '/stats/get-bags-info/net-1');
    expect(res.statusCode).toBe(200);
    expect(getJson(res)).toMatchObject({ networkName: 'Network One' });
  });

  it('returns summary aggregation', async () => {
    const res = await sendRequest('GET', '/stats/summary/net-1');
    expect(res.statusCode).toBe(200);
    expect(getJson(res).memberCountNetwork).toBe(10);
  });

  it('returns 500 when summary fails', async () => {
    mockNetworksInfo.getAllNetworks.mockRejectedValueOnce(new Error('fail'));
    const res = await sendRequest('GET', '/stats/summary/net-1');
    expect(res.statusCode).toBe(500);
    expect(getJson(res)).toEqual({ error: 'An error occurred while fetching the stats summary' });
  });
});
