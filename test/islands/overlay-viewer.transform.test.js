const assert = require('assert');
const { computeUnscaledFromRaw } = require('../../src/islands/overlay-utils');

describe('OverlayViewer transform helpers', function () {
  it('computeUnscaledFromRaw should invert scale/translate correctly', function () {
    const rawX = 150;
    const rawY = 100;
    const tx = -20;
    const ty = -10;
    const s = 2;

    const un = computeUnscaledFromRaw(rawX, rawY, tx, ty, s);
    // Now re-apply transform: raw = unscaled * s + tx
    const reX = un.x * s + tx;
    const reY = un.y * s + ty;

    assert.strictEqual(Math.round(reX), rawX);
    assert.strictEqual(Math.round(reY), rawY);
  });
});