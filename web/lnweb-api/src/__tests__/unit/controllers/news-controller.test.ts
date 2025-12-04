// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

export {};

jest.mock('@aws-sdk/client-dynamodb', () => {
  const sendMock = jest.fn();
  return {
    DynamoDBClient: jest.fn(() => ({ send: sendMock })),
    QueryCommand: jest.fn((input) => ({ input })),
    __mockSend: sendMock
  };
});

jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => {
    const store = new Map();
    return {
      get: jest.fn((key) => store.get(key)),
      set: jest.fn((key, value) => {
        store.set(key, value);
        return true;
      })
    };
  });
});

describe('News Controller', () => {
  let newsController;
  let mockSend;

  beforeEach(() => {
    jest.resetModules();
    const dynamoModule = require('@aws-sdk/client-dynamodb');
    mockSend = dynamoModule.__mockSend;
    newsController = require('../../../controllers/news-controller');
  });

  it('fetchNextNewsItems should map DynamoDB items to plain objects', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        {
          uniqueId: { S: 'abc' },
          zero: { S: '0' },
          title: { S: 'Story' },
          imageUrl: { S: 'https://example.com/img.png' }
        }
      ]
    });

    const result = await newsController.fetchNextNewsItems(5, null, 'https://cdn.test');

    expect(mockSend).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      uniqueId: 'abc',
      title: 'Story'
    });
    expect(result[0].imageUrl).toContain('https://cdn.test/proc/images/news/');
  });

  it('should return cached results on subsequent calls with same arguments', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await newsController.fetchNextNewsItems(2, null, 'https://cdn.test');
    await newsController.fetchNextNewsItems(2, null, 'https://cdn.test');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns null when Dynamo query fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('dynamo down'));
    const result = await newsController.fetchNextNewsItems(2, null, 'https://cdn.test');
    expect(result).toBeNull();
  });
});
