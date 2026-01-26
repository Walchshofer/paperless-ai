const assert = require('assert');

describe('View contracts include Visual Overlays fields', function() {
  it('OverlayViewer accepts images and overlaysByImage', function() {
    const { OverlayViewerSchema } = require('../../src/ui/contracts/OverlayViewer.contract.ts');

    const payload = {
      documentId: 123,
      images: [{ id: 'img-1', originalSrc: 'https://example.com/1.png', width: 800, height: 600 }],
      overlaysByImage: { 'img-1': [ { id: 'ov-1', bbox: { x: 0, y: 0, width: 1, height: 1 }, label: 'test' } ] }
    };

    OverlayViewerSchema.parse(payload);
  });

  it('ManualEditor accepts images and overlaysByImage', function() {
    const { ManualEditorSchema } = require('../../src/ui/contracts/ManualEditor.contract.ts');

    const payload = {
      documentId: 55,
      images: [{ id: 'img-a', originalSrc: 'https://example.com/a.png' }],
      overlaysByImage: { 'img-a': [ { id: 'ov-a', bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 } } ] }
    };

    ManualEditorSchema.parse(payload);
  });

  it('Playground accepts images and overlaysByImage', function() {
    const { PlaygroundSchema } = require('../../src/ui/contracts/Playground.contract.ts');

    const payload = {
      mode: 'visual-debug',
      images: [{ id: 'img-p', originalSrc: 'https://example.com/p.png' }],
      overlaysByImage: { 'img-p': [ { id: 'ov-p', bbox: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 } } ] }
    };

    PlaygroundSchema.parse(payload);
  });
});