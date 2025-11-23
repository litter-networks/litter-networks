const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('express-session', () => {
  return jest.fn(() => (req, res, next) => {
    req.session = {};
    next();
  });
});

jest.mock('../../routes/index', () => {
  const router = express.Router();
  router.get('/test-route', (req, res) => {
    res.status(200).json({ message: 'Test route' });
  });
  return router;
});

// Import app after mocking dependencies
const app = require('../../app');

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
    // Create a route that throws an error
    app._router.stack.push({
      route: {
        path: '/error-route',
        stack: [{
          method: 'get',
          handle: (req, res, next) => {
            next(new Error('Test error'));
          }
        }]
      },
      handle: (req, res, next) => {
        if (req.path === '/error-route' && req.method === 'GET') {
          req.route = { stack: [{ method: 'get' }] };
          app._router.handle(req, res, next);
        } else {
          next();
        }
      }
    });

    const res = await request(app)
      .get('/error-route')
      .set('Origin', 'https://local.litternetworks.org');
    
    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('error', 'Test error');
  });
});