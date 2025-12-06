// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import request from 'supertest';
import express from 'express';
import type { Express, Request, Response, Router } from 'express';

const app: Express = express();

// Mock the network info controller
jest.mock('../../../controllers/legacy/network-info-controller', () => ({
  getNetworksCsv: jest.fn((req: Request, res: Response) => res.status(200).send('networks csv mock')),
  getDistrictsCsv: jest.fn((req: Request, res: Response) => res.status(200).send('districts csv mock')),
  getDistrictsLocalInfoCsv: jest.fn((req: Request, res: Response) => res.status(200).send('districts local info csv mock'))
}));

// Use the actual routes
const infoRouter = require('../../../routes/info') as Router;
app.use('/info', infoRouter);

describe('Info Routes', () => {
  it('GET /info/get-networks-csv should return networks CSV data', async () => {
    const res = await request(app)
      .get('/info/get-networks-csv');
    
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('networks csv mock');
  });

  it('GET /info/get-districts-csv should return districts CSV data', async () => {
    const res = await request(app)
      .get('/info/get-districts-csv');
    
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('districts csv mock');
  });

  it('GET /info/get-districts-localinfo-csv should return districts local info CSV data', async () => {
    const res = await request(app)
      .get('/info/get-districts-localinfo-csv');
    
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('districts local info csv mock');
  });
});
