const assert = require('assert');
const net = require('net');
const fetch = require('node-fetch');
const { URL } = require('url');
const { QdrantClient } = require('@qdrant/js-client-rest');

async function _isHostReachable(urlStr, timeout = 500) {
  try {
    const u = new URL(urlStr);
    return await new Promise((resolve) => {
      const s = net.createConnection({ host: u.hostname, port: Number(u.port || 80) }, () => { s.destroy(); resolve(true); });
      s.on('error', () => resolve(false));
      s.setTimeout(timeout, () => { s.destroy(); resolve(false); });
    });
  } catch (e) {
    return false;
  }
}

describe('Distance Metric Lock - Alpha-9', function () {
  this.timeout(10000);

  // Probe Qdrant reachability once and skip the whole suite early if not reachable in this
  // execution context. This avoids per-test races and long failure traces in CI where Qdrant
  // may not be accessible in certain test runs.
  const qUrlGlobal = process.env.QDRANT_URL || `http://${process.env.QDRANT_HOST || 'localhost'}:${process.env.QDRANT_PORT || 6333}`;
  before(async function() {
    if (!process.env.QDRANT_URL && !process.env.QDRANT_HOST) {
      this.skip();
      return;
    }
    const reachable = await _isHostReachable(qUrlGlobal, 300);
    if (!reachable) {
      this.skip();
      return;
    }
  });

  it('verifies visual_pages uses Dot product and 320 dimensions', async function () {
    const qUrl = process.env.QDRANT_URL || `http://${process.env.QDRANT_HOST || 'localhost'}:${process.env.QDRANT_PORT || 6333}`;
    // If no Qdrant host/url is provided for this run, skip the test to avoid expecting an external service in local runs
    if (!process.env.QDRANT_URL && !process.env.QDRANT_HOST) {
      this.skip();
      return;
    }

    // Check TCP reachability quickly to determine whether the Qdrant host is contactable in this
    // execution context. If not reachable, skip the test instead of failing.
    const reachable = await _isHostReachable(qUrl, 300);
    if (!reachable) {
      this.skip();
      return;
    }

    const client = new QdrantClient({ url: qUrl });

    // Perform a simple HTTP probe first; prefer skipping early if the Qdrant service is
    // unreachable rather than letting the OpenAPI client produce ambiguous errors.
    try {
      const probe = await fetch(`${qUrl}/collections`, { method: 'GET', timeout: 1000 });
      if (!probe.ok) {
        this.skip();
        return;
      }
    } catch (probeErr) {
      const msg = (probeErr && (probeErr.message || probeErr.toString())) || '';
      if (/ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg)) {
        this.skip();
        return;
      }
      this.skip();
      return;
    }

    let info;
    try {
      info = await client.getCollection('visual_pages');
    } catch (err) {
      const msg = (err && (err.message || err.toString())) || '';
      const causeMsg = (err && err.cause && (err.cause.message || err.cause.toString())) || '';
      if (/ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg + ' ' + causeMsg)) {
        this.skip();
        return;
      }
      throw err;
    }
    const params = info.config.params.vectors || {};
    const size = params.size || params.default?.size ||
      params.page_embedding?.size;
    const distance = params.distance || params.default?.distance ||
      params.page_embedding?.distance;

    assert.strictEqual(size, 320, 'visual_pages should be 320 dimensions');
    assert.strictEqual(distance, 'Dot', 'visual_pages should use Dot product distance');
  });

  it('verifies document_embeddings and visual_overlays configs', async function () {
    const qUrl = process.env.QDRANT_URL || `http://${process.env.QDRANT_HOST || 'localhost'}:${process.env.QDRANT_PORT || 6333}`;
    if (!process.env.QDRANT_URL && !process.env.QDRANT_HOST) {
      this.skip();
      return;
    }

    const reachable = await _isHostReachable(qUrl, 300);
    if (!reachable) {
      this.skip();
      return;
    }

    const client = new QdrantClient({ url: qUrl });

    let docInfo;
    try {
      docInfo = await client.getCollection('document_embeddings');
    } catch (err) {
      const msg = (err && (err.message || err.toString())) || '';
      const causeMsg = (err && err.cause && (err.cause.message || err.cause.toString())) || '';
      if (/ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg + ' ' + causeMsg)) {
        this.skip();
        return;
      }
      throw err;
    }
    const docParams = docInfo.config.params.vectors || {};
    const docSize = docParams.size || docParams.default?.size;

    assert.strictEqual(docSize, 384);

    const overlayInfo = await client.getCollection('visual_overlays');
    const overlayParams = overlayInfo.config.params.vectors || {};
    const overlayDistance = overlayParams.distance ||
      overlayParams.default?.distance;
    const overlaySize = overlayParams.size || overlayParams.default?.size;

    assert.strictEqual(overlaySize, 320);
    assert.strictEqual(overlayDistance, 'Cosine');
  });
});
