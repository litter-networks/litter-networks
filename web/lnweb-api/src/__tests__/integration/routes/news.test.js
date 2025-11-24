const request = require('supertest');
const express = require('express');
const app = express();

// Mock the news controller
jest.mock('../../../controllers/news-controller', () => ({
  fetchNextNewsItems: jest.fn().mockResolvedValue([
    { id: 1, title: 'Test News 1', content: 'Content 1' },
    { id: 2, title: 'Test News 2', content: 'Content 2' }
  ])
}));

// Use the actual routes
app.use(express.json());
app.use('/news', require('../../../routes/news'));

describe('News Routes', () => {
  describe('GET /news/get-press-cuttings-json', () => {
    it('should return news data', async () => {
      const res = await request(app).get('/news/get-press-cuttings-json');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('title', 'Test News 1');
    });
  });
});
