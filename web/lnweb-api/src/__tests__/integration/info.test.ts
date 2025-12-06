// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { sendRequest, getJson, mockNetworksInfo, resetMocks } from './helpers/appFixture';

describe('Info routes', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns networks list with cache headers', async () => {
    const res = await sendRequest('GET', '/info/networks');
    expect(res.statusCode).toBe(200);
    expect(getJson(res)).toHaveLength(2);
    expect(mockNetworksInfo.getAllNetworks).toHaveBeenCalled();
    expect(res.getHeader('Cache-Control')).toBe('public, max-age=300, s-maxage=86400');
  });

  it('returns nearby networks data', async () => {
    const res = await sendRequest('GET', '/info/networks/net-1/nearby');
    expect(res.statusCode).toBe(200);
    expect(getJson(res)[0]).toMatchObject({ uniqueId: 'net-2' });
    expect(mockNetworksInfo.getNearbyNetworks).toHaveBeenCalledWith('net-1');
  });
});
