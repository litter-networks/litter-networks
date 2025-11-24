import request from 'supertest';
import type { Application, Request, Response } from 'express';

jest.mock('../../routes/index', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test-route', (req: Request, res: Response) => {
    res.status(200).json({ message: 'Test route' });
  });
  router.get('/error-route', (req: Request, res: Response, next: (err?: Error) => void) => next(new Error('Test error')));
  return router;
});

// Import app initializer after mocking dependencies
const initializeApp = require('../../app') as () => Promise<Application>;
let app: Application;

beforeAll(async () => {
  app = await initializeApp();
});

describe('Express App', () => {
  it('should handle CORS', async () => {
    const res = await request(app)
      .get('/test-route')
      .set('Origin', 'https://local.litternetworks.org');
    
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://local.litternetworks.org');
  });

  it('should reject unauthorized origins', async () => {
    const res = await request(app)
      .get('/test-route')
      .set('Origin', 'https://unauthorized.example.com');
    
    expect(res.statusCode).toBe(500);
  });

  it('should handle server errors', async () => {
    const res = await request(app)
      .get('/error-route')
      .set('Origin', 'https://local.litternetworks.org');
    
    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('error', 'Test error');
  });
});
