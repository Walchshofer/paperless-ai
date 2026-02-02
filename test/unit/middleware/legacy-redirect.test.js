const assert = require('assert');
const legacyRedirectMiddleware = require('../../../middleware/legacy-redirect');
const metrics = require('../../../services/metrics/PrometheusMetrics');

describe('legacyRedirectMiddleware', function () {
  let origPhase;
  let metricsCalled;

  beforeEach(function () {
    origPhase = process.env.LEGACY_REDIRECT_PHASE;
    metricsCalled = false;
    // Simple stub without sinon
    metrics._originalRecordLegacyRouteHit = metrics.metricsCollector.recordLegacyRouteHit;
    metrics.metricsCollector.recordLegacyRouteHit = function () { metricsCalled = true; };
  });

  afterEach(function () {
    process.env.LEGACY_REDIRECT_PHASE = origPhase;
    // restore
    if (metrics._originalRecordLegacyRouteHit) {
      metrics.metricsCollector.recordLegacyRouteHit = metrics._originalRecordLegacyRouteHit;
      delete metrics._originalRecordLegacyRouteHit;
    }
  });

  it('should call next for non-legacy routes', function (done) {
    const req = { path: '/foo' };
    const res = {};
    legacyRedirectMiddleware(req, res, function () {
      done();
    });
  });

  it('Phase A sets banner locals and calls metrics', function (done) {
    process.env.LEGACY_REDIRECT_PHASE = 'A';
    const req = { path: '/manual', cookies: {}, user: null, get: () => 'ua' };
    const res = { locals: {} };
    legacyRedirectMiddleware(req, res, function () {
      assert.strictEqual(res.locals.showLegacyBanner, true);
      assert.strictEqual(res.locals.legacyBannerDismissed, false);
      assert.strictEqual(metricsCalled, true);
      done();
    });
  });

  it('Phase B redirects anonymous users with 302', function () {
    process.env.LEGACY_REDIRECT_PHASE = 'B';
    const req = { path: '/manual', cookies: {}, user: null, get: () => 'ua' };
    let redirected = null;
    const res = { redirect: (code, target) => { redirected = { code, target }; } };
    legacyRedirectMiddleware(req, res, function () {
      // Should not call next in this case
    });
    assert.deepStrictEqual(redirected, { code: 302, target: process.env.LEGACY_REDIRECT_TARGET || '/workspace' });
  });

  it('Phase C hard redirects with 301', function () {
    process.env.LEGACY_REDIRECT_PHASE = 'C';
    const req = { path: '/manual', cookies: {}, user: null, get: () => 'ua' };
    let redirected = null;
    const res = { redirect: (code, target) => { redirected = { code, target }; } };
    legacyRedirectMiddleware(req, res, function () {});
    assert.deepStrictEqual(redirected, { code: 301, target: process.env.LEGACY_REDIRECT_TARGET || '/workspace' });
  });
});