const assert = require('assert');
const { QdrantClient } = require('@qdrant/js-client-rest');

describe('Distance Metric Lock - Alpha-9', function () {
  this.timeout(10000);

  it('verifies visual_pages uses Dot product and 320 dimensions', async function () {
    const client = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333' });

    const info = await client.getCollection('visual_pages');
    const params = info.config.params.vectors || {};
    const size = params.size || params.default?.size;
    const distance = params.distance || params.default?.distance;

    assert.strictEqual(size, 320, 'visual_pages should be 320 dimensions');
    assert.strictEqual(distance, 'Dot', 'visual_pages should use Dot product distance');
  });

  it('verifies document_embeddings and visual_overlays configs', async function () {
    const client = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333' });

    const docInfo = await client.getCollection('document_embeddings');
    const docParams = docInfo.config.params.vectors || {};
    const docSize = docParams.size || docParams.default?.size;

    assert.strictEqual(docSize, 384);

    const overlayInfo = await client.getCollection('visual_overlays');
    const overlayParams = overlayInfo.config.params.vectors || {};
    const overlayDistance = overlayParams.distance || overlayParams.default?.distance;
    const overlaySize = overlayParams.size || overlayParams.default?.size;

    assert.strictEqual(overlaySize, 320);
    assert.strictEqual(overlayDistance, 'Cosine');
  });
});