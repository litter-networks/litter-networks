const request = require('supertest');
const express = require('express');
const app = express();

// Mock the auth module
jest.mock('../../../auth', () => ({
  sessionMiddleware: jest.fn((req, res, next) => {
    req.session = {};
    next();
  }),
  getClient: jest.fn().mockResolvedValue({
    authorizationUrl: jest.fn(() => 'https://mock-auth-url.com'),
    callbackParams: jest.fn(() => ({ code: '123', state: 'abc' })),
    callback: jest.fn().mockResolvedValue({
      claims: () => ({ 
        sub: '123', 
        email: 'test@example.com',
        name: 'Test User' 
      })
    })
  }),
  thisDomainName: 'test.domain'
}));

// Mock generators
jest.mock('openid-client', () => ({
  generators: {
    nonce: jest.fn(() => 'mock-nonce'),
    state: jest.fn(() => 'mock-state')
  }
}));

// Use the actual routes
app.use(express.json());
app.use('/user', require('../../../routes/user'));

describe('User Routes', () => {
  describe('GET /user/login', () => {
    it('should redirect to the auth URL', async () => {
      const res = await request(app).get('/user/login');
      
      // Should redirect to the mock auth URL
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('https://mock-auth-url.com');
    });
  });
  
  describe('GET /user/status', () => {
    it('should return unauthorized when not authenticated', async () => {
      const res = await request(app).get('/user/status');
      
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ isAuthenticated: false });
    });
    
    it('should return user info when authenticated', async () => {
      // Create app with pre-authenticated session
      const authenticatedApp = express();
      authenticatedApp.use((req, res, next) => {
        req.session = { 
          userInfo: { 
            id: '123', 
            email: 'test@example.com', 
            name: 'Test User' 
          } 
        };
        next();
      });
      authenticatedApp.use('/user', require('../../../routes/user'));
      
      const res = await request(authenticatedApp).get('/user/status');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('isAuthenticated', true);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('name', 'Test User');
    });
  });
});