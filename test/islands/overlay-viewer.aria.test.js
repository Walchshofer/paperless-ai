const { JSDOM } = require('jsdom');
const assert = require('assert');

const { mountIslands } = require('../../src/islands/runtime');

describe('island runtime - Overlay Viewer ARIA', function () {
  let dom, document, window;

  beforeEach(() => {
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

  it('toggles aria-pressed on draw mode button', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'overlay-viewer-island');
    anchor.setAttribute('data-testid', 'overlay-viewer-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 123 }));
    document.body.appendChild(anchor);

    mountIslands(document);

    const draw = anchor.querySelector('[data-testid="red-pen-toggle"]');
    assert.ok(draw, 'expected draw mode button');

    // initial
    assert.strictEqual(draw.getAttribute('aria-pressed'), 'false');

    // click toggles
    draw.click();
    assert.strictEqual(draw.getAttribute('aria-pressed'), 'true');

    draw.click();
    assert.strictEqual(draw.getAttribute('aria-pressed'), 'false');
  });

  it('toggles aria-pressed on pan mode button independently', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'overlay-viewer-island');
    anchor.setAttribute('data-testid', 'overlay-viewer-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 123 }));
    document.body.appendChild(anchor);

    mountIslands(document);

    const pan = anchor.querySelector('[data-testid="overlay-pan-toggle"]');
    assert.ok(pan, 'expected pan button');

    // initial
    assert.strictEqual(pan.getAttribute('aria-pressed'), 'false');

    // click toggles
    pan.click();
    assert.strictEqual(pan.getAttribute('aria-pressed'), 'true');

    // ensure draw still independent
    const draw = anchor.querySelector('[data-testid="red-pen-toggle"]');
    assert.strictEqual(draw.getAttribute('aria-pressed'), 'false');
  });
});