import request from 'supertest';
import express from 'express';
import type { Express, Router } from 'express';

const app: Express = express();
const routesPromise = require('../../../routes/index') as Router | Promise<Router>;

beforeAll(async () => {
  const router = await routesPromise;
  app.use('/', router);
});

describe('Index Routes', () => {
  it('GET / should return welcome message', async () => {
    const res = await request(app).get('/');
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Welcome to LNWeb-API!');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route');
    
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not found');
    expect(res.body).toHaveProperty('path', '/unknown-route');
  });
});
