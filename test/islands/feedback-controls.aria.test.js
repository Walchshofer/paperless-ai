const { JSDOM } = require('jsdom');
const assert = require('assert');

const { mountIslands } = require('../../src/islands/runtime');

describe('island runtime - Feedback Controls ARIA', function () {
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

  it('toggles aria-pressed on thumbs up/down buttons', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'feedback-controls-island');
    anchor.setAttribute('data-testid', 'feedback-controls-island');
    anchor.setAttribute('data-props', JSON.stringify({}));
    document.body.appendChild(anchor);

    mountIslands(document);

    const up = anchor.querySelector('[data-testid="thumbs-up-tags"]');
    const down = anchor.querySelector('[data-testid="thumbs-down-tags"]');
    assert.ok(up && down, 'expected thumbs up/down buttons');

    // Initial states
    assert.strictEqual(up.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(down.getAttribute('aria-pressed'), 'false');

    // Click up
    up.click();
    assert.strictEqual(up.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(down.getAttribute('aria-pressed'), 'false');

    // Click up again to toggle off
    up.click();
    assert.strictEqual(up.getAttribute('aria-pressed'), 'false');

    // Click down
    down.click();
    assert.strictEqual(down.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(up.getAttribute('aria-pressed'), 'false');
  });
});
