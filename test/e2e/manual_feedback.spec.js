const { JSDOM } = require('jsdom');
const assert = require('assert');
const { mountIslands } = require('../../src/islands/runtime');

// Ensure mocha-style globals exist when running this file outside of a test
// runner (for example, when executed directly with node).
if (typeof describe === 'undefined') {
  global.describe = function (name, fn) { fn(); };
  global.it = function (name, fn) {
    try {
      if (fn.length) {
        // callback-style test
        fn(function (err) { if (err) throw err; });
      } else {
        // promise/async-style test
        const res = fn();
        if (res && typeof res.then === 'function') res.catch(err => { throw err; });
      }
    } catch (err) { console.error(err); }
  };
  global.beforeEach = function (fn) { fn(); };
  global.afterEach = function (fn) { fn(); };
}

describe('Manual Feedback UI - E2E', function () {
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

  it('manual save emits payload:ready with documentId and fields', function (done) {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'manual-editor-island');
    anchor.setAttribute('data-testid', 'manual-editor-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 42 }));
    document.body.appendChild(anchor);

    mountIslands(document);

    const title = anchor.querySelector('[data-testid="manual-title-input"]');
    const content = anchor.querySelector('[data-testid="manual-content-input"]');
    const fname = anchor.querySelector('[data-testid="field-name-0"]');
    const fval = anchor.querySelector('[data-testid="field-value-0"]');
    const save = anchor.querySelector('[data-testid="manual-save-btn"]');

    title.value = 'E2E Doc';
    content.value = 'Some content';
    fname.value = 'invoice';
    fval.value = 'A-123';

    function listener(e) {
      try {
        document.removeEventListener('payload:ready', listener);
        const payload = e.detail;
        assert.strictEqual(payload.documentId, 42);
        assert.strictEqual(payload.metadata.title, 'E2E Doc');
        assert.strictEqual(payload.content, 'Some content');
        assert.ok(Array.isArray(payload.fields));
        assert.strictEqual(payload.fields[0].name, 'invoice');
        assert.strictEqual(payload.fields[0].value, 'A-123');
        done();
      } catch (err) { done(err); }
    }

    document.addEventListener('payload:ready', listener);
    save.click();
  });

  it('feedback controls emit confirmed and updated with documentId when on same page', function (done) {
    const feedbackAnchor = document.createElement('div');
    feedbackAnchor.setAttribute('data-island', 'feedback-controls-island');
    feedbackAnchor.setAttribute('data-testid', 'feedback-controls-island');
    feedbackAnchor.setAttribute('data-props', JSON.stringify({ documentId: 42, availableComponents: ['tags','correspondent'] }));

    document.body.appendChild(feedbackAnchor);
    mountIslands(document);

    const ups = Array.from(feedbackAnchor.querySelectorAll('[data-testid^="thumbs-up-"]'));
    const target = ups.find(u => u.getAttribute('data-testid') === 'thumbs-up-tags');
    assert.ok(target, 'thumbs-up-tags should exist');

    let gotUpdated = false;

    function onUpdated(e) {
      try {
        const d = e.detail;
        assert.strictEqual(d.component, 'tags');
        assert.strictEqual(d.feedback_type, 'thumbs_up');
        gotUpdated = true;
      } catch (err) { cleanup(err); }
    }

    function onConfirmed(e) {
      try {
        const d = e.detail;
        assert.strictEqual(d.component, 'tags');
        assert.strictEqual(d.documentId, 42);
        document.removeEventListener('feedback:updated', onUpdated);
        document.removeEventListener('feedback:confirmed', onConfirmed);
        // ensure updated fired as well
        assert.strictEqual(gotUpdated, true);
        done();
      } catch (err) { cleanup(err); }
    }

    function cleanup(err) {
      document.removeEventListener('feedback:updated', onUpdated);
      document.removeEventListener('feedback:confirmed', onConfirmed);
      done(err);
    }

    document.addEventListener('feedback:updated', onUpdated);
    document.addEventListener('feedback:confirmed', onConfirmed);

    target.click();
  });
});
