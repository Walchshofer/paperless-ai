const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('VisualOverlays contract', function() {
  it('contract file exists', function() {
    const p = path.resolve(__dirname, '../../src/ui/contracts/VisualOverlays.contract.ts');
    assert.ok(fs.existsSync(p), 'VisualOverlays contract file should exist');
  });

  it('parses a sample images + overlaysByImage payload', function() {
    const { ImagesSchema, OverlaysByImageSchema } = require('../../src/ui/contracts/VisualOverlays.contract.ts');

    const sampleImages = [
      { id: 'img-1', originalSrc: 'https://example.com/img1.png', width: 1200, height: 800 }
    ];

    const sampleOverlays = {
      'img-1': [
        { id: 'ov-1', bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, label: 'Invoice', score: 0.98 }
      ]
    };

    // should not throw
    ImagesSchema.parse(sampleImages);
    OverlaysByImageSchema.parse(sampleOverlays);
  });
});