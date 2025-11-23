const { sessionMiddleware } = require('../../auth');

// Mock express-session
jest.mock('express-session', () => {
  return jest.fn(() => (req, res, next) => {
    req.session = {};
    next();
  });
});

describe('Auth Module', () => {
  describe('sessionMiddleware', () => {
    it('should be a function', () => {
      expect(typeof sessionMiddleware).toBe('function');
    });

    it('should call next', () => {
      const req = {};
      const res = {};
      const next = jest.fn();
      
      sessionMiddleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });
});