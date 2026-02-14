/* eslint-env mocha */
const express = require('express');

const AUTH_MODULE_PATH = require.resolve('../../middleware/auth');

const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer',
};

function createAuthExports(user, overrides = {}) {
  const authUser = user
    ? {
        id: user.id,
        username: user.username,
        role: user.role || ROLES.USER,
        isAdmin: Boolean(user.isAdmin || user.role === ROLES.ADMIN),
      }
    : null;

  const authenticate = (req, res, next) => {
    if (!authUser) return res.redirect('/login');
    req.user = authUser;
    return next();
  };

  const authenticateApi = (req, res, next) => {
    if (!authUser) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No valid authentication token provided',
      });
    }
    req.user = authUser;
    return next();
  };

  const requireRole = (requiredRole) => (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
    }

    const userRole = req.user.role || ROLES.USER;
    const roleOrder = {
      [ROLES.ADMIN]: 100,
      [ROLES.USER]: 50,
      [ROLES.VIEWER]: 10,
    };
    if ((roleOrder[userRole] || 0) < (roleOrder[requiredRole] || 0)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires ${requiredRole} role or higher`,
      });
    }

    return next();
  };

  const authExports = {
    authenticate,
    authenticateApi,
    requireRole,
    requireAdmin: requireRole(ROLES.ADMIN),
    requireUser: requireRole(ROLES.USER),
    requireViewer: requireRole(ROLES.VIEWER),
    protectPage: (role = ROLES.USER) => [authenticate, requireRole(role)],
    protectApi: (role = ROLES.USER) => [authenticateApi, requireRole(role)],
    ROLES,
    PUBLIC_ROUTES: ['/login', '/logout', '/setup', '/health'],
    ADMIN_ROUTES: ['/setup', '/api/settings'],
    extractToken: () => null,
    verifyToken: () => ({ valid: Boolean(authUser), decoded: authUser || {} }),
    hasRolePermission: (userRole, requiredRole) => {
      const roleOrder = {
        [ROLES.ADMIN]: 100,
        [ROLES.USER]: 50,
        [ROLES.VIEWER]: 10,
      };
      return (roleOrder[userRole] || 0) >= (roleOrder[requiredRole] || 0);
    },
  };

  return { ...authExports, ...overrides };
}

function createScopedRouteApp(options) {
  const {
    routePath,
    mountPath,
    user = null,
    authOverrides = {},
    jsonOptions = { limit: '50mb' },
    setupApp = null,
  } = options || {};

  if (!routePath || !mountPath) {
    throw new Error('routePath and mountPath are required');
  }

  const originalAuthModule = require.cache[AUTH_MODULE_PATH];
  const authExports = createAuthExports(user, authOverrides);

  require.cache[AUTH_MODULE_PATH] = {
    id: AUTH_MODULE_PATH,
    filename: AUTH_MODULE_PATH,
    loaded: true,
    exports: authExports,
  };
  delete require.cache[routePath];

  let routeModule;
  try {
    routeModule = require(routePath);
  } finally {
    if (originalAuthModule) {
      require.cache[AUTH_MODULE_PATH] = originalAuthModule;
    } else {
      delete require.cache[AUTH_MODULE_PATH];
    }
  }

  const app = express();
  if (typeof setupApp === 'function') {
    setupApp(app);
  }
  app.use(express.json(jsonOptions));
  app.use(mountPath, routeModule);
  return app;
}

module.exports = {
  createScopedRouteApp,
};

