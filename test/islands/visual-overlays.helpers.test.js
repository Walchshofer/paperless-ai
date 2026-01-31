const assert = require('assert');
// We test the source directly using ts-node via mocha
const { ms, normalizeBoxToPixels, getVisibleImageIds } = require('../../src/islands/VisualOverlaysIsland');

describe('VisualOverlaysIsland Helpers', function () {
  describe('ms() fallback parser', function () {
    it('should parse ms strings', function () {
      assert.strictEqual(ms('100ms'), 100);
      assert.strictEqual(ms('100'), 100);
    });
    it('should parse seconds', function () {
      assert.strictEqual(ms('1s'), 1000);
    });
    it('should parse minutes', function () {
      assert.strictEqual(ms('1m'), 60000);
    });
    it('should return number as-is', function () {
      assert.strictEqual(ms(500), 500);
    });
  });

  describe('normalizeBoxToPixels()', function () {
    it('should scale 0..1 coordinates to pixels', function () {
      const bbox = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };
      const pixels = normalizeBoxToPixels(bbox, 1000, 2000);
      assert.strictEqual(pixels.left, 100);
      assert.strictEqual(pixels.top, 400);
      assert.strictEqual(pixels.width, 500);
      assert.strictEqual(pixels.height, 800);
    });
  });

  describe('getVisibleImageIds()', function () {
    it('should extract ids from intersecting entries', function () {
      const entries = [
        { isIntersecting: true, target: { dataset: { imageId: 'img1' } } },
        { isIntersecting: false, intersectionRatio: 0.1, target: { dataset: { imageId: 'img2' } } },
        { isIntersecting: false, intersectionRatio: 0, target: { dataset: { imageId: 'img3' } } }
      ];
      const ids = getVisibleImageIds(entries);
      assert.deepStrictEqual(ids, ['img1', 'img2']);
    });
  });
});
