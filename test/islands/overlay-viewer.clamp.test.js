const assert = require('assert');
const { clampTranslate } = require('../../src/islands/overlay-utils');

describe('clampTranslate helper', function () {
  it('centers content when image is smaller than container', function () {
    // image nat smaller than container and scale 1 => centered
    const containerW = 800;
    const containerH = 600;
    const imgW = 400;
    const imgH = 300;
    const s = 1;

    const res = clampTranslate(0, 0, s, containerW, containerH, imgW, imgH, 'contain');
    // content size should be image * scaleBase = 400x300 -> centered = (400 centered in 800 => left = 200)
    assert.strictEqual(res.x, (containerW - res.contentW) / 2);
    assert.strictEqual(res.y, (containerH - res.contentH) / 2);
  });

  it('allows panning when content larger than container and clamps out-of-bounds', function () {
    const containerW = 800;
    const containerH = 600;
    const imgW = 1600; // very large image
    const imgH = 1200;
    const s = 1; // base scales down to fit but content may still be > container

    const res = clampTranslate(-1000, -1000, s, containerW, containerH, imgW, imgH, 'contain');
    // minX should be containerW - contentW and res.x should not be less than that
    assert.ok(res.x >= containerW - res.contentW);
    assert.ok(res.x <= 0);
    assert.ok(res.y >= containerH - res.contentH);
    assert.ok(res.y <= 0);
  });

  it('handles scale > 1, clamping to expanded content', function () {
    const containerW = 800;
    const containerH = 600;
    const imgW = 1000;
    const imgH = 800;
    const s = 2; // zoomed

    const res = clampTranslate(-10000, -10000, s, containerW, containerH, imgW, imgH, 'contain');
    assert.ok(res.x >= containerW - res.contentW);
    assert.ok(res.x <= 0);
    assert.ok(res.y >= containerH - res.contentH);
    assert.ok(res.y <= 0);
  });
});