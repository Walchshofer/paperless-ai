/**
 * Legacy Route Retired Middleware
 *
 * Legacy UI routes are permanently retired in favor of /workspace.
 * Any access to legacy UI paths returns HTTP 410 (Gone).
 */

const LEGACY_ROUTES = ['/chat', '/manual', '/rag'];

/**
 * Checks if the current path is a legacy route
 * @param {string} path - Request path
 * @returns {boolean}
 */
function isLegacyRoute(path) {
  // Never retire API routes
  if (path.startsWith('/api/')) return false;
  return LEGACY_ROUTES.some(r => path === r || path.startsWith(`${r}/`));
}

const { metricsCollector } = require('../services/metrics/PrometheusMetrics');

/**
 * Legacy retired middleware
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function legacyRedirectMiddleware(req, res, next) {
  const path = req.path;

  // Check if this is a legacy route
  if (!isLegacyRoute(path)) {
    return next();
  }

  // Log for metrics (console fallback)
  try {
    if (metricsCollector && typeof metricsCollector.recordLegacyRouteHit === 'function') {
      const phase = process.env.LEGACY_REDIRECT_PHASE || 'A';
      const userType = req.user ? 'authed' : 'anonymous';
      metricsCollector.recordLegacyRouteHit(path, phase, userType);
    }
  } catch (err) {
    console.debug('Failed to record legacy route hit metric', err?.message || err);
  }

  console.log(JSON.stringify({
    event: 'legacy_route_access',
    path,
    user: req.user?.username || 'anonymous',
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  }));

  const details = 'Legacy UI routes were retired. Use /workspace instead.';
  if (req.accepts('html')) {
    return res.status(410).render('error', {
      status: 410,
      message: 'Legacy route retired',
      details
    });
  }
  return res.status(410).json({
    error: 'Legacy route retired',
    message: details
  });
}

module.exports = legacyRedirectMiddleware;
module.exports.LEGACY_ROUTES = LEGACY_ROUTES;
module.exports.isLegacyRoute = isLegacyRoute;
