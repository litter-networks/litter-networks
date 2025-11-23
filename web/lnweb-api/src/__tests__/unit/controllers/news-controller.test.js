const newsController = require('../../../controllers/news-controller');
const mockResponse = require('node-mocks-http').createResponse;
const mockRequest = require('node-mocks-http').createRequest;

// Mock any external dependencies
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue(JSON.stringify({
      items: [
        { id: 1, title: 'Test News 1', content: 'Content 1', date: '2023-01-01' },
        { id: 2, title: 'Test News 2', content: 'Content 2', date: '2023-01-02' }
      ]
    }))
  }
}));

describe('News Controller', () => {
  let req;
  let res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn().mockReturnThis();
  });

  describe('getNews', () => {
    it('should return news items sorted by date', async () => {
      await newsController.getNews(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      // Verify that the news items were returned
      const responseData = res.json.mock.calls[0][0];
      expect(responseData).toHaveProperty('items');
      expect(responseData.items).toBeInstanceOf(Array);
    });

    it('should handle errors gracefully', async () => {
      // Mock readFile to throw an error for this test
      require('fs').promises.readFile.mockRejectedValueOnce(new Error('File not found'));
      
      await newsController.getNews(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String)
      }));
    });
  });
});