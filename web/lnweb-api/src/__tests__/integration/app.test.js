const request = require('supertest');

jest.mock('../../routes/index', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test-route', (req, res) => {
    res.status(200).json({ message: 'Test route' });
  });
  router.get('/error-route', (req, res, next) => next(new Error('Test error')));
  return router;
});

// Import app initializer after mocking dependencies
const initializeApp = require('../../app');
let app;

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
