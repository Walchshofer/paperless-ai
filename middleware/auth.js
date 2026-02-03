/**
 * @fileoverview Centralized Authentication & Authorization Middleware
 * @description
 *   Provides JWT-based authentication and role-based access control for all routes.
 *   All protected routes must use these middleware functions.
 *
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * User roles hierarchy (higher includes lower permissions)
 * @readonly
 * @enum {string}
 */
const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer',
};

/**
 * Role hierarchy - each role includes permissions of roles below it
 * @type {Object<string, number>}
 */
const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 100,
  [ROLES.USER]: 50,
  [ROLES.VIEWER]: 10,
};

/**
 * Public routes that don't require authentication
 * @type {string[]}
 */
const PUBLIC_ROUTES = [
  '/login',
  '/logout',
  '/setup',
  '/health',
  '/api-docs',
  '/api-docs.json',
  '/api-docs/openapi.json',
];

/**
 * Routes that only require viewer-level access
 * @type {string[]}
 */
const _VIEWER_ROUTES = [
  '/thumb/',
  '/sampleData/',
];

/**
 * Routes that require admin-level access
 * @type {string[]}
 */
const ADMIN_ROUTES = [
  '/setup',
  '/api/settings',
];

/**
 * Extract JWT token from request (cookie or Authorization header)
 * @param {import('express').Request} req - Express request object
 * @returns {string|null} JWT token or null if not found
 */
function extractToken(req) {
  // Try cookie first
  if (req.cookies && req.cookies.jwt) {
    return req.cookies.jwt;
  }
  // Fallback to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

/**
 * Verify JWT token and decode payload
 * @param {string} token - JWT token string
 * @returns {{ valid: boolean, decoded?: object, error?: string }}
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Check if a route matches any pattern in the list
 * @param {string} path - Request path
 * @param {string[]} routes - List of route patterns
 * @returns {boolean}
 */
function matchesRoute(path, routes) {
  return routes.some(route => {
    if (route.endsWith('/')) {
      return path.startsWith(route);
    }
    return path === route || path.startsWith(route + '/') || path.startsWith(route + '?');
  });
}

/**
 * Check if user has sufficient role permissions
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Required role for access
 * @returns {boolean}
 */
function hasRolePermission(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Authentication middleware for page routes (redirects to login on failure)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authenticate(req, res, next) {
  // Skip auth for public routes
  if (matchesRoute(req.path, PUBLIC_ROUTES)) {
    return next();
  }

  const token = extractToken(req);

  if (!token) {
    console.log('[AUTH] No token found, redirecting to /login', { path: req.originalUrl });
    return res.redirect('/login');
  }

  const { valid, decoded, error } = verifyToken(token);

  if (!valid) {
    console.log('[AUTH] Token verification failed:', error, { path: req.originalUrl });
    res.clearCookie('jwt');
    return res.redirect('/login');
  }

  // Attach user to request
  req.user = {
    id: decoded.id,
    username: decoded.username,
    role: decoded.role || ROLES.USER, // Default to USER if no role specified
    isAdmin: decoded.role === ROLES.ADMIN || decoded.is_superuser || false,
  };

  next();
}

/**
 * Authentication middleware for API routes (returns JSON error on failure)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authenticateApi(req, res, next) {
  // Skip auth for public API routes
  if (matchesRoute(req.path, PUBLIC_ROUTES)) {
    return next();
  }

  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No valid authentication token provided',
    });
  }

  const { valid, decoded, error } = verifyToken(token);

  if (!valid) {
    return res.status(403).json({
      error: 'Invalid token',
      message: error || 'Token verification failed',
    });
  }

  // Attach user to request
  req.user = {
    id: decoded.id,
    username: decoded.username,
    role: decoded.role || ROLES.USER,
    isAdmin: decoded.role === ROLES.ADMIN || decoded.is_superuser || false,
  };

  next();
}

/**
 * Role-based authorization middleware factory
 * @param {string} requiredRole - Minimum role required for access
 * @returns {import('express').RequestHandler}
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
    }

    const userRole = req.user.role || ROLES.USER;

    if (!hasRolePermission(userRole, requiredRole)) {
      console.log('[AUTH] Insufficient permissions:', {
        user: req.user.username,
        userRole,
        requiredRole,
        path: req.originalUrl,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires ${requiredRole} role or higher`,
      });
    }

    next();
  };
}

/**
 * Admin-only middleware (convenience wrapper)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requireAdmin = requireRole(ROLES.ADMIN);

/**
 * User-level middleware (convenience wrapper)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requireUser = requireRole(ROLES.USER);

/**
 * Viewer-level middleware (convenience wrapper)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requireViewer = requireRole(ROLES.VIEWER);

/**
 * Combined authentication + role check for page routes
 * @param {string} role - Required role
 * @returns {import('express').RequestHandler[]}
 */
function protectPage(role = ROLES.USER) {
  return [authenticate, requireRole(role)];
}

/**
 * Combined authentication + role check for API routes
 * @param {string} role - Required role
 * @returns {import('express').RequestHandler[]}
 */
function protectApi(role = ROLES.USER) {
  return [authenticateApi, requireRole(role)];
}

module.exports = {
  // Core middleware
  authenticate,
  authenticateApi,

  // Role-based middleware
  requireRole,
  requireAdmin,
  requireUser,
  requireViewer,

  // Combined middleware
  protectPage,
  protectApi,

  // Constants
  ROLES,
  PUBLIC_ROUTES,
  ADMIN_ROUTES,

  // Utilities
  extractToken,
  verifyToken,
  hasRolePermission,
};
