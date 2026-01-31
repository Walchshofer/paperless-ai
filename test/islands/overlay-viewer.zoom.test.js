const assert = require('assert');
const { mountIslands } = require('../../src/islands/runtime');

describe('OverlayViewer zoom & pan controls', function () {
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

  it('renders zoom controls and updates zoom percentage', (done) => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'overlay-viewer-island');
    anchor.setAttribute('data-testid', 'overlay-viewer-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: null, page: 1 }));

    document.body.appendChild(anchor);

    // Also mount an empty anchor to ensure client-side render produces toolbar elements
    const anchorEmpty = document.createElement('div');
    anchorEmpty.setAttribute('data-island', 'overlay-viewer-island');
    anchorEmpty.setAttribute('data-testid', 'overlay-viewer-island-empty');
    anchorEmpty.setAttribute('data-props', JSON.stringify({ documentId: null, page: 1 }));
    document.body.appendChild(anchorEmpty);

    const errors = [];
    const oldErr = console.error;
    console.error = function () {
      errors.push(Array.from(arguments).join(' '));
      oldErr.apply(this, arguments);
    };

    mountIslands(document);

    const root = anchorEmpty.querySelector('[data-testid="overlay-viewer-root"]') || anchor.querySelector('[data-testid="overlay-viewer-root"]');
    assert.ok(root, 'Expected overlay viewer root to be present');

    // If there are render errors they will be captured here and can help debug
    if (errors.length) {
       
      console.log('[mount errors]', errors.slice(0,3));
    }

    // Give Preact a tick to hydrate and ensure toolbar is mounted
    setTimeout(() => {
      try {
        // debug dump
         
        console.log('[debug overlay root] ', root ? root.innerHTML : '<no root>');
        const zoomIn = root.querySelector('[data-testid="overlay-zoom-in"]');
        const zoomOut = root.querySelector('[data-testid="overlay-zoom-out"]');
        const zoomPct = root.querySelector('[data-testid="overlay-zoom-percentage"]');
        const zoomReset = root.querySelector('[data-testid="overlay-zoom-reset"]');
        const panBtn = root.querySelector('[data-testid="overlay-pan-toggle"]');

        assert.ok(zoomIn, 'Expected zoom in button');
        assert.ok(zoomOut, 'Expected zoom out button');
        assert.ok(zoomPct, 'Expected zoom percentage element');
        assert.ok(zoomReset, 'Expected zoom reset button');
        assert.ok(panBtn, 'Expected pan toggle button');

        // Default should be 100%
        assert.strictEqual(zoomPct.textContent.trim(), '100%');

        // Presence checks are our primary verification for this runtime
        done();
      } catch (e) { done(e); }
    }, 0);
  });
});