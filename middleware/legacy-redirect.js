/**
 * Legacy Route Redirect Middleware
 *
 * Implements a phased deprecation strategy for legacy routes:
 * - Phase A (default): Show deprecation banner only
 * - Phase B: Soft 302 redirect for anonymous users
 * - Phase C: Hard 301 redirect for all users
 *
 * Control via LEGACY_REDIRECT_PHASE environment variable ('A', 'B', or 'C')
 */

const LEGACY_ROUTES = ['/chat', '/manual', '/rag'];

/**
 * Checks if the current path is a legacy route
 * @param {string} path - Request path
 * @returns {boolean}
 */
function isLegacyRoute(path) {
  return LEGACY_ROUTES.some(r => path === r || path.startsWith(`${r}/`));
}

/**
 * Legacy redirect middleware
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

  // Log for metrics
  console.log(JSON.stringify({
    event: 'legacy_route_access',
    path,
    user: req.user?.username || 'anonymous',
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  }));

  // Phase check via env var
  const phase = process.env.LEGACY_REDIRECT_PHASE || 'A';

  if (phase === 'C') {
    // Hard redirect (301)
    return res.redirect(301, '/workspace');
  } else if (phase === 'B' && !req.user) {
    // Soft redirect for anonymous (302)
    return res.redirect(302, '/workspace');
  }

  // Phase A: Continue to legacy route (with banner)
  // Check if banner was dismissed via cookie
  res.locals.legacyBannerDismissed = req.cookies?.legacy_banner_dismissed === '1';
  res.locals.showLegacyBanner = true;
  next();
}

module.exports = legacyRedirectMiddleware;
module.exports.LEGACY_ROUTES = LEGACY_ROUTES;
module.exports.isLegacyRoute = isLegacyRoute;
