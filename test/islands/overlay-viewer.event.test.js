const assert = require('assert');
const { mountIslands } = require('../../src/islands/runtime');

describe('island runtime - OverlayViewer reacts to overlay:document-changed', function () {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    const { JSDOM } = require('jsdom');
    dom = new JSDOM(`<!doctype html><html><body></body></html>`);
    window = dom.window;
    document = window.document;
    global.document = document;
    global.window = window;
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
  });

  it('updates page in-place when overlay:document-changed is dispatched', (done) => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'overlay-viewer-island');
    anchor.setAttribute('data-testid', 'overlay-viewer-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: null, page: 1 }));

    document.body.appendChild(anchor);

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="overlay-viewer-root"]');
    assert.ok(root, 'Expected overlay viewer root to be present');

    // Check initial page text (search for any span containing the page label)
    const spans = Array.from(root.querySelectorAll('span'));
    const pageTextEl = spans.find(s => s.textContent && s.textContent.includes('Page 1'));
    assert.ok(pageTextEl, 'Expected page text element showing Page 1');

    // Dispatch overlay change to page 3
    window.dispatchEvent(new window.CustomEvent('overlay:document-changed', { detail: { documentId: 123, page: 3, originalUrl: null } }));

    // give Preact a tick to update state
    setTimeout(() => {
      try {
        const updatedSpans = Array.from(root.querySelectorAll('span'));
        const updated = updatedSpans.find(s => s.textContent && s.textContent.includes('Page 3'));
        assert.ok(updated, `Expected updated page to be 3 but none of the spans contained it`);

        // Also assert that original url attribute is empty when none provided (trimmed to avoid invisible whitespace)
        assert.strictEqual(String(root.getAttribute('data-original-url') || '').trim(), '', 'Expected data-original-url to be empty string when no original URL provided');
        done();
      } catch (err) { done(err); }
    }, 0);
  });

  it('updates originalUrl when overlay:document-changed contains camelCase originalUrl', (done) => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'overlay-viewer-island');
    anchor.setAttribute('data-testid', 'overlay-viewer-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: null, page: 1 }));

    document.body.appendChild(anchor);

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="overlay-viewer-root"]');

    const testUrl = '/documents/123/download/original/';

    window.dispatchEvent(new window.CustomEvent('overlay:document-changed', { detail: { documentId: 123, page: 1, originalUrl: testUrl } }));

    setTimeout(() => {
      try {
        assert.ok(String(root.getAttribute('data-original-url') || '').includes(testUrl), `Expected data-original-url to include ${testUrl} but was ${String(root.getAttribute('data-original-url') || '')}`);
        done();
      } catch (err) { done(err); }
    }, 0);
  });

  it('updates originalUrl when overlay:document-changed contains snake_case original_url', (done) => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'overlay-viewer-island');
    anchor.setAttribute('data-testid', 'overlay-viewer-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: null, page: 1 }));

    document.body.appendChild(anchor);

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="overlay-viewer-root"]');

    const testUrl = '/documents/456/download/original/';

    window.dispatchEvent(new window.CustomEvent('overlay:document-changed', { detail: { documentId: 456, page: 2, original_url: testUrl } }));

    setTimeout(() => {
      try {
        assert.ok(String(root.getAttribute('data-original-url') || '').includes(testUrl), `Expected data-original-url to include ${testUrl} but was ${String(root.getAttribute('data-original-url') || '')}`);
        done();
      } catch (err) { done(err); }
    }, 0);
  });
});