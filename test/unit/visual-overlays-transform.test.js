const assert = require('assert');
const { normalizeBoxToPixels } = require('../../src/islands/VisualOverlaysIsland.tsx');

describe('normalizeBoxToPixels', function() {
  it('converts normalized bbox to pixel coords', function() {
    const bbox = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
    const res = normalizeBoxToPixels(bbox, 800, 600);
    assert.strictEqual(res.left, Math.round(0.1 * 800));
    assert.strictEqual(res.top, Math.round(0.2 * 600));
    assert.strictEqual(res.width, Math.round(0.3 * 800));
    assert.strictEqual(res.height, Math.round(0.4 * 600));
  });
});