const assert = require('assert');
const { mountIslands } = require('../../src/islands/runtime');

describe('OverlayViewer wheel zoom', function () {
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

  it.skip('increments scale on wheel and respects Ctrl/Cmd fine mode (skipped in unit tests; covered in E2E)', function (done) {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'overlay-viewer-island');
    anchor.setAttribute('data-testid', 'overlay-viewer-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: null, page: 1 }));
    document.body.appendChild(anchor);

    // Append a second anchor to match runtime fallback behavior
    const anchorEmpty = document.createElement('div');
    anchorEmpty.setAttribute('data-island', 'overlay-viewer-island');
    anchorEmpty.setAttribute('data-testid', 'overlay-viewer-island-empty');
    anchorEmpty.setAttribute('data-props', JSON.stringify({ documentId: null, page: 1 }));
    document.body.appendChild(anchorEmpty);

    mountIslands(document);

    setTimeout(() => {
      try {
        const root = anchorEmpty.querySelector('[data-testid="overlay-viewer-root"]') || anchor.querySelector('[data-testid="overlay-viewer-root"]');
        assert.ok(root, 'Expected overlay viewer root to be present');

        const container = root.querySelector('[data-testid="overlay-container"]');
        const zoomPct = root.querySelector('[data-testid="overlay-zoom-percentage"]');
        let viewport = root.querySelector('[data-testid="overlay-viewport"]');
        if (!viewport) viewport = container; // fallback

        assert.ok(container && zoomPct, 'Expected container and zoom percentage elements');

        const beforePct = Number((zoomPct.textContent || '100%').replace('%', ''));

        // Dispatch a coarse wheel (scroll up meaning deltaY negative) to zoom in
        const wheelEv = new window.WheelEvent('wheel', { deltaY: -100, clientX: 10, clientY: 10, bubbles: true, cancelable: true });
        container.dispatchEvent(wheelEv);

        setTimeout(() => {
          try {
            const afterPct = Number((zoomPct.textContent || '100%').replace('%', ''));
            assert.ok(afterPct > beforePct, 'Coarse wheel should increase zoom');

            const coarseDelta = afterPct - beforePct;

            // Now use Ctrl/Cmd fine wheel (ctrlKey true)
            const beforeFine = afterPct;
            const fineWheel = new window.WheelEvent('wheel', { deltaY: -100, clientX: 20, clientY: 20, ctrlKey: true, bubbles: true, cancelable: true });
            container.dispatchEvent(fineWheel);

            setTimeout(() => {
              try {
                const afterFine = Number((zoomPct.textContent || '100%').replace('%', ''));
                const fineDelta = afterFine - beforeFine;
                assert.ok(fineDelta > 0, 'Fine wheel should increase zoom (but by smaller step)');
                assert.ok(fineDelta < coarseDelta + 1e-6, 'Fine wheel delta should be smaller than coarse wheel delta');

                // Ensure viewport translate changed due to pointer-anchored zoom
                const style = viewport.getAttribute('style') || '';
                assert.ok(/translate\(/.test(style), 'Viewport should have translate transform applied after wheel zoom');

                done();
              } catch (e) { done(e); }
            }, 0);
          } catch (e) { done(e); }
        }, 0);
      } catch (e) { done(e); }
    }, 0);
  });
});