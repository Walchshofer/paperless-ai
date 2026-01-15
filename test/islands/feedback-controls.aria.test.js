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

  it('renders controls for multiple components and emits confirmed event', (done) => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'feedback-controls-island');
    anchor.setAttribute('data-testid', 'feedback-controls-island');
    anchor.setAttribute('data-props', JSON.stringify({ availableComponents: ['tags','correspondent'], documentId: 42 }));
    document.body.appendChild(anchor);

    const updatedEvents = [];
    const confirmedEvents = [];

    document.addEventListener('feedback:updated', (e) => { updatedEvents.push(e.detail); });
    document.addEventListener('feedback:confirmed', (e) => { confirmedEvents.push(e.detail); });

    mountIslands(document);

    const upTags = anchor.querySelector('[data-testid="thumbs-up-tags"]');
    const upCorr = anchor.querySelector('[data-testid="thumbs-up-correspondent"]');
    assert.ok(upTags && upCorr, 'expected multiple thumbs-up buttons');

    // click tags up
    upTags.click();
    setTimeout(()=>{
      assert.strictEqual(updatedEvents.length >= 1, true);
      assert.strictEqual(confirmedEvents.length >= 1, true);
      const lastUpdated = updatedEvents[updatedEvents.length-1];
      const lastConfirmed = confirmedEvents[confirmedEvents.length-1];
      assert.strictEqual(lastUpdated.component, 'tags');
      assert.strictEqual(lastUpdated.feedback_type, 'thumbs_up');
      assert.strictEqual(lastConfirmed.component, 'tags');
      assert.strictEqual(lastConfirmed.documentId, 42);

      // click correspondent up
      upCorr.click();
      setTimeout(()=>{
        const u = updatedEvents[updatedEvents.length-1];
        const c = confirmedEvents[confirmedEvents.length-1];
        assert.strictEqual(u.component, 'correspondent');
        assert.strictEqual(u.feedback_type, 'thumbs_up');
        assert.strictEqual(c.component, 'correspondent');
        assert.strictEqual(c.documentId, 42);
        done();
      }, 10);
    }, 10);
  });
});
