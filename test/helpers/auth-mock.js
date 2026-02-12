/**
 * auth-mock.js
 *
 * Reusable mock for authentication middleware in tests.
 * Requiring this module will globally patch the auth middleware cache.
 */

const authMock = {
  authenticate: (req, res, next) => {
    req.user = { id: 1, username: 'admin', role: 'admin', isAdmin: true };
    next();
  },
  authenticateApi: (req, res, next) => {
    req.user = { id: 1, username: 'admin', role: 'admin', isAdmin: true };
    next();
  },
  requireAdmin: (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.isAdmin)) {
      return next();
    }
    res.status(403).json({ error: 'Admin access required' });
  },
  requireUser: (req, res, next) => {
    if (req.user) return next();
    res.status(401).json({ error: 'User access required' });
  },
  requireViewer: (req, res, next) => {
    if (req.user) return next();
    res.status(401).json({ error: 'Viewer access required' });
  },
  ROLES: {
    ADMIN: 'admin',
    USER: 'user',
    VIEWER: 'viewer',
  },
};

// Patch require cache
const authPath = require.resolve('../../middleware/auth');
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: authMock,
};

module.exports = authMock;
