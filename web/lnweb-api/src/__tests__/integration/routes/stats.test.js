const request = require('supertest');
const express = require('express');
const app = express();

// Mock any controllers used by stats
jest.mock('../../../controllers/stats-controller', () => ({
  getStats: jest.fn((req, res) => res.status(200).json({
    totalUsers: 100,
    activeNetworks: 25,
    totalLitterPicks: 500
  }))
}), { virtual: true });

// Use the actual routes
app.use(express.json());
app.use('/stats', require('../../../routes/stats'));

describe('Stats Routes', () => {
  describe('GET /stats', () => {
    it('should return statistics data', async () => {
      const res = await request(app).get('/stats');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('totalUsers');
      expect(res.body).toHaveProperty('activeNetworks');
      expect(res.body).toHaveProperty('totalLitterPicks');
    });
  });
});