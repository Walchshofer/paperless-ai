const MS_PER_HOUR = 60 * 60 * 1000;
const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_RETENTION_HOURS = 24;
const DEFAULT_MAX_EVENTS = 5000;
const KNOWN_DOMAINS = ['financial', 'medical', 'legal', 'general'];

function clampWindowHours(hours) {
  if (!Number.isFinite(hours)) return DEFAULT_WINDOW_HOURS;
  return Math.max(1, Math.min(168, Math.round(hours)));
}

function toRate(part, total) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return Number((part / total).toFixed(4));
}

function computePercentile(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  const bounded = Math.max(0, Math.min(index, sorted.length - 1));
  return Number(sorted[bounded].toFixed(2));
}

function normalizeDomain(value) {
  const next = String(value || 'general').trim().toLowerCase();
  if (KNOWN_DOMAINS.includes(next)) return next;
  return 'general';
}

function normalizeQuery(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

class VisualQueryAnalyticsService {
  constructor(options = {}) {
    const retentionHours = Number.parseInt(
      process.env.VISUAL_QUERY_ANALYTICS_RETENTION_HOURS,
      10
    );
    const maxEvents = Number.parseInt(
      process.env.VISUAL_QUERY_ANALYTICS_MAX_EVENTS,
      10
    );

    this.retentionMs = (
      Number.isFinite(retentionHours)
        ? retentionHours
        : options.retentionHours || DEFAULT_RETENTION_HOURS
    ) * MS_PER_HOUR;
    this.maxEvents = Number.isFinite(maxEvents)
      ? maxEvents
      : options.maxEvents || DEFAULT_MAX_EVENTS;

    this.queryEvents = [];
    this.fallbackEvents = [];
  }

  _prune(now = Date.now()) {
    const cutoff = now - this.retentionMs;
    this.queryEvents = this.queryEvents.filter((event) => event.ts >= cutoff);
    this.fallbackEvents = this.fallbackEvents.filter(
      (event) => event.ts >= cutoff
    );

    if (this.queryEvents.length > this.maxEvents) {
      this.queryEvents = this.queryEvents.slice(-this.maxEvents);
    }
    if (this.fallbackEvents.length > this.maxEvents) {
      this.fallbackEvents = this.fallbackEvents.slice(-this.maxEvents);
    }
  }

  recordQueryEvent(event = {}) {
    const latencyMs = Number(event.latencyMs);
    if (!Number.isFinite(latencyMs) || latencyMs < 0) {
      return false;
    }

    const ts = Number.isFinite(Number(event.ts)) ? Number(event.ts) : Date.now();
    this.queryEvents.push({
      ts,
      query: normalizeQuery(event.query),
      domain: normalizeDomain(event.domain),
      success: Boolean(event.success),
      latencyMs: Number(latencyMs.toFixed(2)),
      errorType: event.errorType ? String(event.errorType) : null,
    });
    this._prune(ts);
    return true;
  }

  recordFallbackEvent(event = {}) {
    const from = String(event.from || '').trim().toLowerCase();
    const to = String(event.to || '').trim().toLowerCase();
    if (!from || !to) {
      return false;
    }
    const ts = Number.isFinite(Number(event.ts)) ? Number(event.ts) : Date.now();
    this.fallbackEvents.push({
      ts,
      from,
      to,
      reason: event.reason ? String(event.reason) : null,
      domain: normalizeDomain(event.domain),
    });
    this._prune(ts);
    return true;
  }

  _buildTrend(events, windowStartMs, windowHours) {
    const bucketCount = Math.min(windowHours, 24);
    const bucketSizeMs = Math.max(
      1,
      Math.floor((windowHours * MS_PER_HOUR) / bucketCount)
    );
    const trend = [];

    for (let i = 0; i < bucketCount; i += 1) {
      const bucketStart = windowStartMs + (i * bucketSizeMs);
      const bucketEnd = bucketStart + bucketSizeMs;
      const bucketEvents = events.filter(
        (event) => event.ts >= bucketStart && event.ts < bucketEnd
      );
      const latencies = bucketEvents.map((event) => event.latencyMs);

      trend.push({
        slot: new Date(bucketStart).toISOString(),
        count: bucketEvents.length,
        p50: computePercentile(latencies, 50),
        p95: computePercentile(latencies, 95),
        p99: computePercentile(latencies, 99),
      });
    }

    return trend;
  }

  getSnapshot(options = {}) {
    const windowHours = clampWindowHours(Number(options.windowHours));
    const now = Number.isFinite(Number(options.now))
      ? Number(options.now)
      : Date.now();
    this._prune(now);

    const windowStartMs = now - (windowHours * MS_PER_HOUR);
    const events = this.queryEvents.filter((event) => event.ts >= windowStartMs);
    const fallbackEvents = this.fallbackEvents.filter(
      (event) => event.ts >= windowStartMs
    );
    const latencies = events.map((event) => event.latencyMs);

    const totalQueries = events.length;
    const successfulQueries = events.filter((event) => event.success).length;
    const failedQueries = totalQueries - successfulQueries;

    const accuracyByDomain = {};
    KNOWN_DOMAINS.forEach((domain) => {
      const domainEvents = events.filter((event) => event.domain === domain);
      const domainSuccess = domainEvents.filter((event) => event.success).length;
      accuracyByDomain[domain] = {
        total: domainEvents.length,
        successful: domainSuccess,
        accuracy: toRate(domainSuccess, domainEvents.length),
      };
    });

    const fallbackVisualToText = fallbackEvents.filter(
      (event) => event.from === 'visual' && event.to === 'text'
    ).length;
    const fallbackVisualToOcr = fallbackEvents.filter(
      (event) => event.from === 'visual' && event.to === 'ocr'
    ).length;

    const queryCounts = new Map();
    events.forEach((event) => {
      const key = event.query || '<empty>';
      queryCounts.set(key, (queryCounts.get(key) || 0) + 1);
    });
    const topQueries = [...queryCounts.entries()]
      .sort((a, b) => {
        if (b[1] === a[1]) {
          return a[0].localeCompare(b[0]);
        }
        return b[1] - a[1];
      })
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return {
      generatedAt: new Date(now).toISOString(),
      windowHours,
      counts: {
        totalQueries,
        successfulQueries,
        failedQueries,
      },
      latency: {
        p50Ms: computePercentile(latencies, 50),
        p95Ms: computePercentile(latencies, 95),
        p99Ms: computePercentile(latencies, 99),
      },
      errorRate: toRate(failedQueries, totalQueries),
      accuracyByDomain,
      fallbackRates: {
        visualToText: toRate(fallbackVisualToText, totalQueries),
        visualToOcr: toRate(fallbackVisualToOcr, totalQueries),
      },
      fallbackCounts: {
        visualToText: fallbackVisualToText,
        visualToOcr: fallbackVisualToOcr,
      },
      topQueries,
      trend: this._buildTrend(events, windowStartMs, windowHours),
    };
  }

  buildCsv(snapshot) {
    const rows = [
      ['generated_at', snapshot.generatedAt],
      ['window_hours', snapshot.windowHours],
      ['total_queries', snapshot.counts.totalQueries],
      ['successful_queries', snapshot.counts.successfulQueries],
      ['failed_queries', snapshot.counts.failedQueries],
      ['error_rate', snapshot.errorRate],
      ['latency_p50_ms', snapshot.latency.p50Ms],
      ['latency_p95_ms', snapshot.latency.p95Ms],
      ['latency_p99_ms', snapshot.latency.p99Ms],
      ['fallback_visual_to_text_rate', snapshot.fallbackRates.visualToText],
      ['fallback_visual_to_ocr_rate', snapshot.fallbackRates.visualToOcr],
      [],
      ['accuracy_by_domain'],
      ['domain', 'total', 'successful', 'accuracy'],
    ];

    Object.entries(snapshot.accuracyByDomain).forEach(([domain, stats]) => {
      rows.push([domain, stats.total, stats.successful, stats.accuracy]);
    });

    rows.push([], ['top_queries'], ['query', 'count']);
    snapshot.topQueries.forEach((entry) => {
      rows.push([entry.query, entry.count]);
    });

    rows.push(
      [],
      ['trend'],
      ['slot', 'count', 'p50_ms', 'p95_ms', 'p99_ms']
    );
    snapshot.trend.forEach((point) => {
      rows.push([point.slot, point.count, point.p50, point.p95, point.p99]);
    });

    return rows
      .map((row) => row.map((value) => `"${String(value || '')}"`).join(','))
      .join('\n');
  }

  reset() {
    this.queryEvents = [];
    this.fallbackEvents = [];
  }
}

const visualQueryAnalyticsService = new VisualQueryAnalyticsService();

module.exports = visualQueryAnalyticsService;
module.exports.VisualQueryAnalyticsService = VisualQueryAnalyticsService;
