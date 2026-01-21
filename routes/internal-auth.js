const logger = require('../services/logger');
const { cidrContains } = require('../metrics/validateInternalMetricsConfig');

function parseAllowedCidrs() {
  const raw = process.env.METRICS_ALLOWED_CIDRS || '';
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeIp(ip) {
  // Express req.ip may include IPv4-mapped IPv6, strip prefix ::ffff:
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) return ip.split('::ffff:')[1];
  return ip;
}

function allowInternalNetwork(req, res, next) {
  const internalOnly = String(process.env.METRICS_INTERNAL_ONLY || 'true').toLowerCase() === 'true';
  if (!internalOnly) return next();

  const allowed = parseAllowedCidrs();
  const remote = normalizeIp(req.ip || req.connection.remoteAddress || '');

  // If request has no IP we reject
  if (!remote) {
    logger.warn({ event: 'metrics_access_denied', reason: 'no_remote_ip' });
    return res.status(403).send('Forbidden');
  }

  // Loop through allowed entries
  for (const entry of allowed) {
    if (!entry) continue;
    if (entry === '::1' || entry === '127.0.0.1') {
      if (remote === '::1' || remote === '127.0.0.1') return next();
      continue;
    }
    if (entry.includes('/')) {
      if (cidrContains(entry, remote)) return next();
      continue;
    }
    // exact match
    if (remote === entry) return next();
  }

  logger.warn({ event: 'metrics_access_denied', remote });
  return res.status(403).send('Forbidden');
}

module.exports = { allowInternalNetwork };
