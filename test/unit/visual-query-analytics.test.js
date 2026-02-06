/**
 * Visual Query Analytics Service Tests
 *
 * Tests for the VisualQueryAnalyticsService including:
 * - Event recording (query events, fallback events)
 * - Snapshot generation
 * - CSV export
 * - Percentile calculations
 * - Data retention and pruning
 */

const assert = require('assert');
const { VisualQueryAnalyticsService } = require('../../services/analytics/VisualQueryAnalyticsService');

describe('VisualQueryAnalyticsService', function() {
  let service;

  beforeEach(function() {
    service = new VisualQueryAnalyticsService({
      retentionHours: 24,
      maxEvents: 100
    });
  });

  describe('recordQueryEvent', function() {
    it('should record valid query events', function() {
      const result = service.recordQueryEvent({
        query: 'test query',
        domain: 'financial',
        success: true,
        latencyMs: 150
      });

      assert.strictEqual(result, true);
      const snapshot = service.getSnapshot({ windowHours: 1 });
      assert.strictEqual(snapshot.counts.totalQueries, 1);
      assert.strictEqual(snapshot.counts.successfulQueries, 1);
    });

    it('should reject events without latencyMs', function() {
      const result = service.recordQueryEvent({
        query: 'test query',
        domain: 'financial',
        success: true
      });

      assert.strictEqual(result, false);
    });

    it('should reject events with negative latencyMs', function() {
      const result = service.recordQueryEvent({
        query: 'test query',
        latencyMs: -100
      });

      assert.strictEqual(result, false);
    });

    it('should normalize domain to known values', function() {
      service.recordQueryEvent({
        query: 'test',
        domain: 'unknown_domain',
        success: true,
        latencyMs: 100
      });

      const snapshot = service.getSnapshot({ windowHours: 1 });
      assert.strictEqual(snapshot.accuracyByDomain.general.total, 1);
    });
  });

  describe('recordFallbackEvent', function() {
    it('should record valid fallback events', function() {
      const result = service.recordFallbackEvent({
        from: 'visual',
        to: 'text',
        reason: 'confidence too low',
        domain: 'financial'
      });

      assert.strictEqual(result, true);
    });

    it('should reject events without from/to', function() {
      const result = service.recordFallbackEvent({
        from: 'visual'
      });

      assert.strictEqual(result, false);
    });
  });

  describe('getSnapshot', function() {
    it('should return correct latency percentiles', function() {
      // Record 100 events with known latencies
      for (let i = 1; i <= 100; i++) {
        service.recordQueryEvent({
          query: 'test',
          domain: 'general',
          success: true,
          latencyMs: i * 10 // 10, 20, 30, ... 1000
        });
      }

      const snapshot = service.getSnapshot({ windowHours: 24 });

      // P50 should be around 500ms
      assert.ok(snapshot.latency.p50Ms >= 490 && snapshot.latency.p50Ms <= 510,
        `P50 should be around 500, got ${snapshot.latency.p50Ms}`);

      // P95 should be around 950ms
      assert.ok(snapshot.latency.p95Ms >= 940 && snapshot.latency.p95Ms <= 960,
        `P95 should be around 950, got ${snapshot.latency.p95Ms}`);

      // P99 should be around 990ms
      assert.ok(snapshot.latency.p99Ms >= 980 && snapshot.latency.p99Ms <= 1000,
        `P99 should be around 990, got ${snapshot.latency.p99Ms}`);
    });

    it('should calculate error rate correctly', function() {
      // Record 10 events: 7 success, 3 failed
      for (let i = 0; i < 7; i++) {
        service.recordQueryEvent({
          query: 'test',
          domain: 'general',
          success: true,
          latencyMs: 100
        });
      }
      for (let i = 0; i < 3; i++) {
        service.recordQueryEvent({
          query: 'test',
          domain: 'general',
          success: false,
          latencyMs: 100
        });
      }

      const snapshot = service.getSnapshot({ windowHours: 24 });
      assert.strictEqual(snapshot.errorRate, 0.3);
    });

    it('should track accuracy by domain', function() {
      // Financial: 8/10 success = 80%
      for (let i = 0; i < 8; i++) {
        service.recordQueryEvent({ query: 'fin', domain: 'financial', success: true, latencyMs: 100 });
      }
      for (let i = 0; i < 2; i++) {
        service.recordQueryEvent({ query: 'fin', domain: 'financial', success: false, latencyMs: 100 });
      }

      // Medical: 9/10 success = 90%
      for (let i = 0; i < 9; i++) {
        service.recordQueryEvent({ query: 'med', domain: 'medical', success: true, latencyMs: 100 });
      }
      service.recordQueryEvent({ query: 'med', domain: 'medical', success: false, latencyMs: 100 });

      const snapshot = service.getSnapshot({ windowHours: 24 });
      assert.strictEqual(snapshot.accuracyByDomain.financial.accuracy, 0.8);
      assert.strictEqual(snapshot.accuracyByDomain.medical.accuracy, 0.9);
    });

    it('should track fallback rates', function() {
      // Record 10 queries
      for (let i = 0; i < 10; i++) {
        service.recordQueryEvent({ query: 'test', domain: 'general', success: true, latencyMs: 100 });
      }

      // 3 visual→text fallbacks, 2 visual→ocr fallbacks
      for (let i = 0; i < 3; i++) {
        service.recordFallbackEvent({ from: 'visual', to: 'text' });
      }
      for (let i = 0; i < 2; i++) {
        service.recordFallbackEvent({ from: 'visual', to: 'ocr' });
      }

      const snapshot = service.getSnapshot({ windowHours: 24 });
      assert.strictEqual(snapshot.fallbackRates.visualToText, 0.3);
      assert.strictEqual(snapshot.fallbackRates.visualToOcr, 0.2);
    });

    it('should track top queries', function() {
      // Record queries with different frequencies
      for (let i = 0; i < 5; i++) {
        service.recordQueryEvent({ query: 'popular query', domain: 'general', success: true, latencyMs: 100 });
      }
      for (let i = 0; i < 3; i++) {
        service.recordQueryEvent({ query: 'medium query', domain: 'general', success: true, latencyMs: 100 });
      }
      service.recordQueryEvent({ query: 'rare query', domain: 'general', success: true, latencyMs: 100 });

      const snapshot = service.getSnapshot({ windowHours: 24 });
      assert.strictEqual(snapshot.topQueries[0].query, 'popular query');
      assert.strictEqual(snapshot.topQueries[0].count, 5);
      assert.strictEqual(snapshot.topQueries[1].query, 'medium query');
      assert.strictEqual(snapshot.topQueries[1].count, 3);
    });

    it('should respect time window', function() {
      const now = Date.now();
      const twoHoursAgo = now - (2 * 60 * 60 * 1000);

      // Record event from 2 hours ago
      service.recordQueryEvent({
        query: 'old query',
        domain: 'general',
        success: true,
        latencyMs: 100,
        ts: twoHoursAgo
      });

      // Record recent event
      service.recordQueryEvent({
        query: 'new query',
        domain: 'general',
        success: true,
        latencyMs: 100,
        ts: now
      });

      // 1-hour window should only include recent event
      const snapshot1h = service.getSnapshot({ windowHours: 1, now });
      assert.strictEqual(snapshot1h.counts.totalQueries, 1);

      // 24-hour window should include both
      const snapshot24h = service.getSnapshot({ windowHours: 24, now });
      assert.strictEqual(snapshot24h.counts.totalQueries, 2);
    });
  });

  describe('buildCsv', function() {
    it('should generate valid CSV format', function() {
      service.recordQueryEvent({ query: 'test', domain: 'general', success: true, latencyMs: 100 });
      service.recordFallbackEvent({ from: 'visual', to: 'text' });

      const snapshot = service.getSnapshot({ windowHours: 24 });
      const csv = service.buildCsv(snapshot);

      assert.ok(csv.includes('generated_at'));
      assert.ok(csv.includes('total_queries'));
      assert.ok(csv.includes('latency_p50_ms'));
      assert.ok(csv.includes('accuracy_by_domain'));
      assert.ok(csv.includes('top_queries'));
      assert.ok(csv.includes('trend'));
    });
  });

  describe('reset', function() {
    it('should clear all events', function() {
      service.recordQueryEvent({ query: 'test', domain: 'general', success: true, latencyMs: 100 });
      service.recordFallbackEvent({ from: 'visual', to: 'text' });

      service.reset();

      const snapshot = service.getSnapshot({ windowHours: 24 });
      assert.strictEqual(snapshot.counts.totalQueries, 0);
      assert.strictEqual(snapshot.fallbackCounts.visualToText, 0);
    });
  });

  describe('data retention', function() {
    it('should prune old events beyond retention period', function() {
      const smallService = new VisualQueryAnalyticsService({
        retentionHours: 1,
        maxEvents: 100
      });

      const now = Date.now();
      const twoHoursAgo = now - (2 * 60 * 60 * 1000);

      // Record old event
      smallService.recordQueryEvent({
        query: 'old',
        domain: 'general',
        success: true,
        latencyMs: 100,
        ts: twoHoursAgo
      });

      // Record new event (triggers pruning)
      smallService.recordQueryEvent({
        query: 'new',
        domain: 'general',
        success: true,
        latencyMs: 100,
        ts: now
      });

      const snapshot = smallService.getSnapshot({ windowHours: 24, now });
      // Old event should be pruned
      assert.strictEqual(snapshot.counts.totalQueries, 1);
    });

    it('should respect maxEvents limit', function() {
      const smallService = new VisualQueryAnalyticsService({
        retentionHours: 24,
        maxEvents: 10
      });

      // Record 15 events
      for (let i = 0; i < 15; i++) {
        smallService.recordQueryEvent({
          query: `query-${i}`,
          domain: 'general',
          success: true,
          latencyMs: 100
        });
      }

      const snapshot = smallService.getSnapshot({ windowHours: 24 });
      // Should only keep 10 most recent
      assert.ok(snapshot.counts.totalQueries <= 10,
        `Expected at most 10 events, got ${snapshot.counts.totalQueries}`);
    });
  });
});
