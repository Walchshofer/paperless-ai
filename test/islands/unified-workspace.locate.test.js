'use strict';
/**
 * T7 — Locate + Page Navigation
 * Verifies that UnifiedWorkspaceIsland:
 *  1. Dispatches overlay:navigate-to-page alongside overlay:highlight-region.
 *  2. resolveLocateTarget uses direct field.bbox as fallback when overlay lookup fails.
 */
const { JSDOM } = require('jsdom');
const assert = require('assert');
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', jsx: 'react-jsx', jsxImportSource: 'preact' }
});
const { h, render } = require('preact');
const UnifiedWorkspaceIsland = require('../../src/islands/UnifiedWorkspaceIsland.tsx').default;

// ---- Unit test: resolveLocateTarget direct-bbox fallback ----
// We extract the pure-function behavior indirectly by testing the event chain.

describe('UnifiedWorkspaceIsland - T7 locate + page navigation', function () {
  let dom, document, window;

  beforeEach(() => {
    dom = new JSDOM(`<!doctype html><html><body></body></html>`);
    window = dom.window;
    document = window.document;
    global.document = document;
    global.window = window;
    // Expose jsdom's CustomEvent globally so component code that calls
    // `new CustomEvent(...)` creates events compatible with the jsdom window.
    global.CustomEvent = window.CustomEvent;
    // Stub fetch to avoid network calls in tests
    global.fetch = async () => ({ ok: false });
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
    delete global.CustomEvent;
    delete global.fetch;
  });

  it('dispatches overlay:navigate-to-page when field resolves via overlay bbox', async () => {
    const overlays = [
      {
        id: 'overlay_1',
        overlayId: 'overlay_1',
        label: 'amount',
        bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
        pageNumber: 2
      }
    ];
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(h(UnifiedWorkspaceIsland, {
      document: { id: 99 },
      visual: { overlays, fields: [] }
    }), root);
    await new Promise((r) => setTimeout(r, 80));

    const navigateEvents = [];
    const highlightEvents = [];
    window.addEventListener('overlay:navigate-to-page', (e) => navigateEvents.push(e.detail));
    window.addEventListener('overlay:highlight-region', (e) => highlightEvents.push(e.detail));

    window.dispatchEvent(new window.CustomEvent('metadata:locate-field', {
      detail: { fieldId: 'amount' }
    }));

    await new Promise((r) => setTimeout(r, 80));

    assert.strictEqual(highlightEvents.length, 1, 'overlay:highlight-region should fire once');
    assert.strictEqual(navigateEvents.length, 1, 'overlay:navigate-to-page should fire once');
    assert.strictEqual(navigateEvents[0].page, 2, 'page should be 2 from overlay');
    assert.strictEqual(navigateEvents[0].documentId, 99, 'documentId should be 99');
  });

  it('dispatches overlay:navigate-to-page when field resolves via direct field.bbox (T7 fallback)', async () => {
    // Field has bbox directly but no overlay entry and no overlayId
    const fields = [
      {
        id: 'custom_field_total',
        name: 'total',
        bbox: { x: 0.05, y: 0.5, width: 0.4, height: 0.04 },
        page: 3
      }
    ];
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(h(UnifiedWorkspaceIsland, {
      document: { id: 55 },
      visual: { overlays: [], fields }
    }), root);
    await new Promise((r) => setTimeout(r, 80));

    const navigateEvents = [];
    const highlightEvents = [];
    window.addEventListener('overlay:navigate-to-page', (e) => navigateEvents.push(e.detail));
    window.addEventListener('overlay:highlight-region', (e) => highlightEvents.push(e.detail));

    window.dispatchEvent(new window.CustomEvent('metadata:locate-field', {
      detail: { fieldId: 'total' }
    }));

    await new Promise((r) => setTimeout(r, 80));

    assert.strictEqual(highlightEvents.length, 1, 'overlay:highlight-region should fire via direct bbox');
    assert.strictEqual(navigateEvents.length, 1, 'overlay:navigate-to-page should fire via direct bbox');
    assert.strictEqual(navigateEvents[0].page, 3, 'page should be 3 from field.page');
    assert.deepStrictEqual(
      highlightEvents[0].bbox,
      { x: 0.05, y: 0.5, width: 0.4, height: 0.04 },
      'bbox should match field.bbox'
    );
  });

  it('does not dispatch navigate event when field cannot be resolved', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(h(UnifiedWorkspaceIsland, {
      document: { id: 10 },
      visual: { overlays: [], fields: [] }
    }), root);
    await new Promise((r) => setTimeout(r, 80));

    const navigateEvents = [];
    window.addEventListener('overlay:navigate-to-page', (e) => navigateEvents.push(e.detail));

    window.dispatchEvent(new window.CustomEvent('metadata:locate-field', {
      detail: { fieldId: 'nonexistent_field_xyz' }
    }));

    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(navigateEvents.length, 0, 'should not navigate when field unresolvable');
  });
});
