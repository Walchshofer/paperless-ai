require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
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

  it('accepts a nullable originalUrl for late hydration', () => {
    const data = { documentId: 1, originalUrl: null };
    const parsed = OverlayViewerSchema.parse(data);
    assert.strictEqual(parsed.originalUrl, null);
  });

  it('contract smoke: prefers snake_case original_url when provided (rendering behavior validated in integration/E2E)', (done) => {
    // This is a contract-level, minimal smoke test that ensures the schema and the island
    // are compatible with a payload that contains `original_url` (snake_case). The full
    // DOM behavior is tested in the E2E test; here we validate that the contract accepts it.
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`);
    const window = dom.window;
    const document = window.document;
    global.window = window;
    global.document = document;

    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'overlay-viewer-island');
    anchor.setAttribute('data-testid', 'overlay-viewer-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 999, page: 1, originalUrl: null }));
    document.body.appendChild(anchor);

    const { mountIslands } = require('../../src/islands/runtime');
    mountIslands(document);

    const root = anchor.querySelector('[data-testid="overlay-viewer-root"]');
    assert.ok(root, 'Expected overlay viewer root to be present');

    const testUrl = '/documents/999/download/original/';
    window.dispatchEvent(new window.CustomEvent('overlay:document-changed', { detail: { documentId: 999, page: 1, original_url: testUrl } }));

    setTimeout(() => {
      try {
        assert.ok(String(root.getAttribute('data-original-url') || '').includes(testUrl), `Expected data-original-url to include ${testUrl}`);
        done();
      } catch (err) { done(err); }
    }, 0);
  });
});
