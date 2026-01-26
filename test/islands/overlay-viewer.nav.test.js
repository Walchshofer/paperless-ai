const { mountIslands } = require('../../src/islands/runtime');
const assert = require('assert');

describe('OverlayViewer navigation controls', function () {
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

  it('prev/next buttons change page and preserve originalUrl', (done) => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'overlay-viewer-island');
    anchor.setAttribute('data-testid', 'overlay-viewer-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 42, page: 1, pageCount: 2, originalUrl: '/documents/42/download/original/' }));

    document.body.appendChild(anchor);

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="overlay-viewer-root"]');
    assert.ok(root, 'Expected overlay viewer root to be present');

    // initial page 1
    setTimeout(() => {
      try {
        const pageTextEl = Array.from(root.querySelectorAll('span')).find(s => s.textContent && s.textContent.includes('Page 1'));
        assert.ok(pageTextEl, 'Expected Page 1 initially');

        const nextBtn = root.querySelector('[data-testid="overlay-next-page"]');
        const prevBtn = root.querySelector('[data-testid="overlay-prev-page"]');

        if (!nextBtn) console.log('[debug] overlay root HTML:', root ? root.outerHTML : '<no root>');

        assert.ok(nextBtn, 'Expected next button');
        assert.ok(prevBtn, 'Expected prev button');

        // click next
        nextBtn.click();

        setTimeout(() => {
          try {
            const page2 = Array.from(root.querySelectorAll('span')).find(s => s.textContent && s.textContent.includes('Page 2'));
            assert.ok(page2, 'Expected Page 2 after clicking next');

            // original URL preserved
            assert.ok(String(root.getAttribute('data-original-url') || '').includes('/documents/42/download/original/'));

            // click prev
            prevBtn.click();

            setTimeout(() => {
              try {
                const page1 = Array.from(root.querySelectorAll('span')).find(s => s.textContent && s.textContent.includes('Page 1'));
                assert.ok(page1, 'Expected Page 1 after clicking prev');
                done();
              } catch (e) { done(e); }
            }, 0);
          } catch (e) { done(e); }
        }, 0);
      } catch (e) { done(e); }
    }, 0);
  });
});