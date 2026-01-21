const assert = require('assert');
const { allowInternalNetwork } = require('../../routes/internal-auth');

function makeReq(ip) {
  return { ip, connection: { remoteAddress: ip } };
}

function makeRes() {
  let statusCode = 200;
  let body = null;
  return {
    status(code) { statusCode = code; return this; },
    send(b) { body = b; return this; },
    _getStatus() { return statusCode; },
    _getBody() { return body; }
  };
}

describe('routes/internal-auth.allowInternalNetwork', function () {
  afterEach(() => {
    delete process.env.METRICS_INTERNAL_ONLY;
    delete process.env.METRICS_ALLOWED_CIDRS;
  });

  it('allows when METRICS_INTERNAL_ONLY=false', function (done) {
    process.env.METRICS_INTERNAL_ONLY = 'false';
    const req = makeReq('203.0.113.1');
    const res = makeRes();
    allowInternalNetwork(req, res, () => done());
  });

  it('allows when IP is in allowed CIDR', function (done) {
    process.env.METRICS_INTERNAL_ONLY = 'true';
    process.env.METRICS_ALLOWED_CIDRS = '127.0.0.1,172.18.0.0/16';
    const req = makeReq('172.18.0.5');
    const res = makeRes();
    allowInternalNetwork(req, res, () => done());
  });

  it('rejects when IP is not allowed', function () {
    process.env.METRICS_INTERNAL_ONLY = 'true';
    process.env.METRICS_ALLOWED_CIDRS = '127.0.0.1,172.18.0.0/16';
    const req = makeReq('203.0.113.5');
    const res = makeRes();
    allowInternalNetwork(req, res, () => {
      throw new Error('should not call next');
    });
    assert.strictEqual(res._getStatus(), 403);
  });
});
