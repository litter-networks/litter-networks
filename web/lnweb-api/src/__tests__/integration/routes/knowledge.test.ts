// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import request from 'supertest';
import express from 'express';
import type { Express, Router } from 'express';

jest.mock('../../../controllers/knowledge-controller', () => ({
  getKnowledgePage: jest.fn(),
  getChildPages: jest.fn(),
}));

type KnowledgeControllerMock = {
  getKnowledgePage: jest.Mock;
  getChildPages: jest.Mock;
};

const controller = require('../../../controllers/knowledge-controller') as KnowledgeControllerMock;

describe('Knowledge Routes', () => {
  let app: Express;
  let knowledgeRouter: Router;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    knowledgeRouter = require('../../../routes/knowledge') as Router;
    app.use('/knowledge', knowledgeRouter);
  });

  it('returns page data from the controller', async () => {
    const payload = { bodyContent: '<p>hello</p>', metadata: { title: 'Title', description: 'Desc' } };
    controller.getKnowledgePage.mockResolvedValue(payload);

    const res = await request(app).get('/knowledge/page?path=how-to');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(payload);
    expect(controller.getKnowledgePage).toHaveBeenCalledWith('how-to');
  });

  it('handles errors when getKnowledgePage rejects', async () => {
    controller.getKnowledgePage.mockRejectedValue(new Error('boom'));

    const res = await request(app).get('/knowledge/page?path=bad');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Unable to fetch knowledge page' });
  });

  it('returns child page listings', async () => {
    const childPages = [{ pageUrl: 'knowledge/foo', pageTitle: 'Foo' }];
    controller.getChildPages.mockResolvedValue(childPages);

    const res = await request(app).get('/knowledge/child-pages?path=foo');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ childPages });
    expect(controller.getChildPages).toHaveBeenCalledWith('foo');
  });

  it('handles errors when getChildPages rejects', async () => {
    controller.getChildPages.mockRejectedValue(new Error('dynamo broken'));

    const res = await request(app).get('/knowledge/child-pages?path=foo');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Unable to fetch knowledge contents' });
  });
});
