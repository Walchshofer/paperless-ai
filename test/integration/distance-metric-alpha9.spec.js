const assert = require('assert');
const { QdrantClient } = require('@qdrant/js-client-rest');

describe('Distance Metric Lock - Alpha-9', function () {
  this.timeout(10000);

  it('verifies visual_pages uses Dot product and 320 dimensions', async function () {
    const client = new QdrantClient({ url: process.env.QDRANT_URL || `http://${process.env.QDRANT_HOST || 'localhost'}:${process.env.QDRANT_PORT || 6333}` });

    let info;
    try {
      info = await client.getCollection('visual_pages');
    } catch (err) {
      if (/ECONNREFUSED|ENOTFOUND/i.test(err.message)) {
        // Qdrant not reachable in this environment — skip this test
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
    const client = new QdrantClient({ url: process.env.QDRANT_URL || `http://${process.env.QDRANT_HOST || 'localhost'}:${process.env.QDRANT_PORT || 6333}` });

    let docInfo;
    try {
      docInfo = await client.getCollection('document_embeddings');
    } catch (err) {
      if (/ECONNREFUSED|ENOTFOUND/i.test(err.message)) {
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
