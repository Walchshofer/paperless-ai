const logger = require('../services/logger');

function parseCidrs(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function isIPv4Address(ip) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip);
}

function ipToLong(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function cidrContains(cidr, ip) {
  // cidr: "A.B.C.D/N"
  const parts = cidr.split('/');
  if (parts.length !== 2) return false;
  const base = parts[0];
  const prefix = Number(parts[1]);
  if (!isIPv4Address(base) || !isIPv4Address(ip)) return false;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const baseLong = ipToLong(base) & mask;
  const ipLong = ipToLong(ip) & mask;
  return baseLong === ipLong;
}

function validateInternalMetricsConfig() {
  const internalOnly = String(process.env.METRICS_INTERNAL_ONLY || 'true').toLowerCase() === 'true';
  if (!internalOnly) return true; // Nothing to validate when internal-only disabled

  const raw = process.env.METRICS_ALLOWED_CIDRS;
  if (!raw || String(raw).trim() === '') {
    const msg = 'Startup failure: METRICS_INTERNAL_ONLY=true but METRICS_ALLOWED_CIDRS is missing or invalid. Set METRICS_ALLOWED_CIDRS to include your Prometheus network or set METRICS_INTERNAL_ONLY=false for tests.';
    logger.error(msg);
    throw new Error(msg);
  }

  const cidrs = parseCidrs(raw);
  if (cidrs.length === 0) {
    const msg = 'Startup failure: METRICS_INTERNAL_ONLY=true but METRICS_ALLOWED_CIDRS is empty. See docs/OBSERVABILITY_AND_TELEMETRY.md for guidance.';
    logger.error(msg);
    throw new Error(msg);
  }

  // Validate each entry is either a single IPv4 or a CIDR (A.B.C.D/N) or special token '::1'
  for (const entry of cidrs) {
    if (entry === '::1' || entry === '127.0.0.1') continue;
    if (entry.includes('/')) {
      const parts = entry.split('/');
      if (parts.length !== 2) {
        const msg = `Startup failure: METRICS_ALLOWED_CIDRS contains invalid entry: ${entry}`;
        logger.error(msg);
        throw new Error(msg);
      }
      const base = parts[0];
      const prefix = Number(parts[1]);
      if (!isIPv4Address(base) || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
        const msg = `Startup failure: METRICS_ALLOWED_CIDRS contains invalid CIDR: ${entry}`;
        logger.error(msg);
        throw new Error(msg);
      }
      continue;
    }
    // Single IP
    if (!isIPv4Address(entry)) {
      const msg = `Startup failure: METRICS_ALLOWED_CIDRS contains invalid IP: ${entry}`;
      logger.error(msg);
      throw new Error(msg);
    }
  }

  return true;
}

module.exports = { validateInternalMetricsConfig, cidrContains };
