/* eslint-env mocha */
const assert = require('assert');
const { render, cleanup } = require('@testing-library/preact');
const { h } = require('preact');
const UnifiedWorkspaceIsland = require('../../src/islands/UnifiedWorkspaceIsland').default;

// Ensure a JSDOM document exists for @testing-library to mount into
const { JSDOM } = require('jsdom');
let _dom;
function ensureDom() {
  if (typeof global.document !== 'undefined') return;
  _dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = _dom.window;
  global.document = _dom.window.document;
  global.navigator = _dom.window.navigator;
  // Make sure Event constructors are available globally as some islands call `new CustomEvent(...)`
  global.CustomEvent = _dom.window.CustomEvent;
  global.Event = _dom.window.Event;
}

describe('UnifiedWorkspaceIsland - metadata:locate-field', () => {
  afterEach(() => {
    try { cleanup(); } catch (e) {}
    try { delete window.__last_metadata_locate; } catch (e) {}
    if (_dom) {
      try { _dom.window.close(); } catch (e) {}
      _dom = null;
      delete global.window;
      delete global.document;
      delete global.navigator;
    }
  });

  it('resolves field that has direct bbox on field', (done) => {
    const visual = {
      overlays: [],
      fields: [
        { id: 'total_amount', bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 }, pageNumber: 2 }
      ]
    };

    ensureDom();
    render(h(UnifiedWorkspaceIsland, { visual }));

    window.addEventListener('overlay:highlight-region', function handler(e) {
      try {
        const d = e.detail;
        assert.deepStrictEqual(d.bbox, visual.fields[0].bbox);
        assert.strictEqual(d.page, 2);
        window.removeEventListener('overlay:highlight-region', handler);
        done();
      } catch (err) { done(err); }
    });

    window.dispatchEvent(new window.CustomEvent('metadata:locate-field', { detail: { fieldId: 'total_amount' } }));
  });

  it('resolves overlay by paperlessMapping', (done) => {
    const visual = {
      overlays: [ { id: 'ov1', bbox: { x:0.2, y:0.2, width:0.1, height:0.1 }, page: 1, paperlessMapping: 'inv_total' } ],
      fields: []
    };

    ensureDom();
    render(h(UnifiedWorkspaceIsland, { visual }));

    window.addEventListener('overlay:highlight-region', function handler(e) {
      try {
        const d = e.detail;
        assert.deepStrictEqual(d.bbox, visual.overlays[0].bbox);
        assert.strictEqual(d.page, 1);
        window.removeEventListener('overlay:highlight-region', handler);
        done();
      } catch (err) { done(err); }
    });

    window.dispatchEvent(new window.CustomEvent('metadata:locate-field', { detail: { fieldId: 'inv_total' } }));
  });

  it('emits handled:false when no mapping found', async () => {
    const visual = { overlays: [], fields: [] };
    ensureDom();
    render(h(UnifiedWorkspaceIsland, { visual }));

    delete window.__last_metadata_locate;
    window.dispatchEvent(new window.CustomEvent('metadata:locate-field', { detail: { fieldId: 'not_found' } }));
    // small tick for handler to run
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(window.__last_metadata_locate, 'expected __last_metadata_locate set');
    assert.strictEqual(window.__last_metadata_locate.handled, false);
  });
});
