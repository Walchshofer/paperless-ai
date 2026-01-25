const assert = require('assert');
const { mountIslands } = require('../../src/islands/runtime');

describe('island runtime - OverlayViewer props and initial state', function () {
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

  it('respects initial originalUrl prop and page', (done) => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'overlay-viewer-island');
    anchor.setAttribute('data-testid', 'overlay-viewer-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: null, page: 2, originalUrl: '/documents/777/download/original/' }));

    document.body.appendChild(anchor);

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="overlay-viewer-root"]');
    assert.ok(root, 'Expected overlay viewer root to be present');

    // Should expose original URL as a test-visible attribute
    assert.strictEqual(String(root.getAttribute('data-original-url') || ''), '/documents/777/download/original/');

    // Page indicator should show the provided page
    const spans = Array.from(root.querySelectorAll('span'));
    const pageTextEl = spans.find(s => s.textContent && s.textContent.includes('Page 2'));
    assert.ok(pageTextEl, 'Expected page text element showing Page 2');

    done();
  });
});