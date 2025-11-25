import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

jest.mock('../../../utils/networks-info.js', () => ({
  getBagsInfo: jest.fn(async (uniqueId) => ({
    networkName: `Network ${uniqueId}`,
    bagCounts: { thisMonth: 5, lastMonth: 3 }
  })),
  getAllNetworks: jest.fn(async () => [
    { uniqueId: 'net-1', districtId: 'dist-1' },
    { uniqueId: 'net-2', districtId: 'dist-1' }
  ]),
  getCurrentMemberCount: jest.fn(async () => 10),
  findNetworkById: jest.fn(async (uniqueId) => uniqueId === 'net-1' ? { uniqueId: 'net-1', districtId: 'dist-1' } : null),
  findNetworkByShortId: jest.fn(async () => null),
  findDistrictById: jest.fn(async () => ({ fullName: 'District 1' }))
}));

import statsRouter from '../../../routes/stats';

const app: Express = express();
app.use(express.json());
app.use('/stats', statsRouter);

describe('Stats Routes', () => {
  it('GET /stats/get-bags-info/:id returns bag info', async () => {
    const res = await request(app).get('/stats/get-bags-info/net-1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('networkName', 'Network net-1');
    expect(res.body.bagCounts).toHaveProperty('thisMonth', 5);
  });

  it('GET /stats/summary/:networkId returns summary data', async () => {
    const res = await request(app).get('/stats/summary/net-1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('memberCountNetwork');
    expect(res.body).toHaveProperty('numNetworksInDistrict', 2);
    expect(res.body).toHaveProperty('districtName', 'District 1');
  });

  it('GET /stats/get-bag-stats-json/:id returns bag counts only', async () => {
    const res = await request(app).get('/stats/get-bag-stats-json/net-1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ thisMonth: 5 }));
  });
});
