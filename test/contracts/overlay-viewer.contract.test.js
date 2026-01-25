const assert = require('assert');
const { OverlayViewerSchema } = require('../../src/ui/contracts/OverlayViewer.contract');

describe('OverlayViewer contract', () => {
  it('accepts documentId, page and originalUrl', () => {
    const data = { documentId: 123, page: 2, originalUrl: 'https://example.com/doc/123/download/original/' };
    const parsed = OverlayViewerSchema.parse(data);
    assert.strictEqual(parsed.documentId, 123);
    assert.strictEqual(parsed.page, 2);
    assert.strictEqual(parsed.originalUrl, data.originalUrl);
  });

  it('allows nullable documentId and optional fields', () => {
    const data = { documentId: null };
    const parsed = OverlayViewerSchema.parse(data);
    assert.strictEqual(parsed.documentId, null);
  });
});