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

  it('returns 410 HTML for legacy routes and calls metrics', function () {
    const req = {
      path: '/manual',
      cookies: {},
      user: null,
      get: () => 'ua',
      accepts: (type) => (type === 'html' ? 'html' : false),
    };
    let statusCode = null;
    let rendered = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      render(view, locals) {
        rendered = { view, locals };
      },
    };

    legacyRedirectMiddleware(req, res, function () {});

    assert.strictEqual(statusCode, 410);
    assert.strictEqual(rendered?.view, 'error');
    assert.strictEqual(rendered?.locals?.status, 410);
    assert.strictEqual(metricsCalled, true);
  });

  it('returns 410 JSON when HTML is not accepted', function () {
    const req = {
      path: '/chat',
      cookies: {},
      user: null,
      get: () => 'ua',
      accepts: () => false,
    };
    let statusCode = null;
    let payload = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        payload = body;
      },
    };

    legacyRedirectMiddleware(req, res, function () {});

    assert.strictEqual(statusCode, 410);
    assert.ok(payload && payload.error);
  });
});
