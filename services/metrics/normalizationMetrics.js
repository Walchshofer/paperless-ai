/**
 * services/metrics/normalizationMetrics.js
 *
 * Prometheus metrics for document normalization system.
 * Tracks normalization operations, latency, pending queue, and disk usage.
 *
 * Reference: docs/AUTOMATIC_NORMALIZATION_PLAN.md §1.5 (Monitoring thresholds)
 * Ticket: 7120d115-a0c0-4d52-89a2-8f84e67af453 (Phase 4)
 */

const { Counter, Histogram, Gauge } = require('prom-client');

/**
 * Total normalization operations (success/failed)
 * Labels:
 *   - status: success|failed
 *   - trigger: pipeline|batch|manual
 */
const normalizationTotal = new Counter({
  name: 'paperless_ai_normalization_total',
  help: 'Total normalization operations',
  labelNames: ['status', 'trigger']
});

/**
 * Normalization latency by stage
 * Labels:
 *   - stage: analysis|transformation|persistence
 */
const normalizationLatency = new Histogram({
  name: 'paperless_ai_normalization_latency_seconds',
  help: 'Normalization latency in seconds',
  labelNames: ['stage'],
  buckets: [0.5, 1, 2, 5, 10, 30]
});

/**
 * Documents pending normalization (gauge)
 */
const normalizationPending = new Gauge({
  name: 'paperless_ai_normalization_pending',
  help: 'Documents pending normalization'
});

/**
 * Disk usage for normalized images (MB)
 */
const normalizationDiskUsage = new Gauge({
  name: 'paperless_ai_normalization_disk_mb',
  help: 'Disk usage for normalized images (MB)'
});

module.exports = {
  normalizationTotal,
  normalizationLatency,
  normalizationPending,
  normalizationDiskUsage
};
