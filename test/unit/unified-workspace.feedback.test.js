const assert = require('assert');
const { render, cleanup } = require('@testing-library/preact');
const { h } = require('preact');
const UnifiedWorkspaceIsland = require('../../src/islands/UnifiedWorkspaceIsland').default;

// JSDOM setup helper
const { JSDOM } = require('jsdom');
let _dom;
function ensureDom() {
  if (typeof global.document !== 'undefined') return;
  _dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = _dom.window;
  global.document = _dom.window.document;
  global.navigator = _dom.window.navigator;
  global.CustomEvent = _dom.window.CustomEvent;
}

afterEach(() => {
  try { cleanup(); } catch (e) {}
  if (_dom) {
    try { _dom.window.close(); } catch (e) {}
    _dom = null;
    delete global.window;
    delete global.document;
    delete global.navigator;
  }
});

describe('UnifiedWorkspaceIsland - feedback:vote handler', () => {
  it('posts to /api/feedback/field-vote when feedback:vote dispatched', async () => {
    ensureDom();

    const calls = [];
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    };

    render(h(UnifiedWorkspaceIsland, { document: { id: 42 } }));

    window.dispatchEvent(new window.CustomEvent('feedback:vote', { detail: { fieldId: 'invoice_total', vote: 'up' } }));

    // wait a tick for async handler
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(calls.length, 1, 'expected one fetch call');
    assert.strictEqual(calls[0].url, '/api/feedback/field-vote');

    const body = JSON.parse(calls[0].opts.body);
    assert.strictEqual(body.documentId, 42);
    assert.strictEqual(body.fieldId, 'invoice_total');
    assert.strictEqual(body.vote, 'up');
  });
});