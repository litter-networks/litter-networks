// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

export {};

const { createRequest, createResponse } = require('node-mocks-http');
const { setCacheControl, setNoCache } = require('../../../utils/cache-control');

describe('cache-control middleware', () => {
  it('sets Cache-Control header for GET requests', () => {
    const req = createRequest({ method: 'GET' });
    const res = createResponse();
    const next = jest.fn();
    const middleware = setCacheControl({ maxAge: '60', sMaxAge: '120' });
    middleware(req, res, next);
    expect(res.getHeader('Cache-Control')).toBe('public, max-age=60, s-maxage=120');
    expect(next).toHaveBeenCalled();
  });

  it('ignores non-GET/HEAD methods', () => {
    const req = createRequest({ method: 'POST' });
    const res = createResponse();
    const next = jest.fn();
    setCacheControl({ maxAge: 30 })(req, res, next);
    expect(res.getHeader('Cache-Control')).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('skips invalid duration values', () => {
    const req = createRequest({ method: 'GET' });
    const res = createResponse();
    setCacheControl({ maxAge: -10, sMaxAge: 'not-a-number' })(req, res, jest.fn());
    expect(res.getHeader('Cache-Control')).toBeUndefined();
  });

  it('setNoCache disables caching for GET and HEAD', () => {
    const req = createRequest({ method: 'HEAD' });
    const res = createResponse();
    const next = jest.fn();
    setNoCache()(req, res, next);
    expect(res.getHeader('Cache-Control')).toContain('no-store');
    expect(res.getHeader('Pragma')).toBe('no-cache');
    expect(res.getHeader('Expires')).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});
