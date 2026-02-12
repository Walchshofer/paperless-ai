const assert = require('assert');

const {
  normalizeBoxObject,
  normalizeLegacyBoxArray,
  normalizeOverlayBoundingBox
} = require('../../services/visual-rag-client/overlayCoordinates');

describe('overlayCoordinates', function() {
  it('normalizes legacy box array as [xmin, ymin, xmax, ymax]', function() {
    const bbox = normalizeLegacyBoxArray([100, 500, 250, 520]);
    assert.ok(bbox);
    assert.strictEqual(bbox.x, 0.1);
    assert.strictEqual(bbox.y, 0.5);
    assert.strictEqual(bbox.width, 0.15);
    assert.strictEqual(bbox.height, 0.02);
  });

  it('normalizes 0-1000 box objects to 0..1', function() {
    const bbox = normalizeBoxObject({ x: 300, y: 200, width: 100, height: 50 });
    assert.ok(bbox);
    assert.strictEqual(bbox.x, 0.3);
    assert.strictEqual(bbox.y, 0.2);
    assert.strictEqual(bbox.width, 0.1);
    assert.strictEqual(bbox.height, 0.05);
  });

  it('prefers canonical box array over stale object coordinates', function() {
    const bbox = normalizeOverlayBoundingBox({
      box: [100, 500, 250, 520],
      boundingBox: { x: 500, y: 100, width: 20, height: 150 }
    });

    assert.ok(bbox);
    assert.strictEqual(bbox.x, 0.1);
    assert.strictEqual(bbox.y, 0.5);
    assert.strictEqual(bbox.width, 0.15);
    assert.strictEqual(bbox.height, 0.02);
  });
});
