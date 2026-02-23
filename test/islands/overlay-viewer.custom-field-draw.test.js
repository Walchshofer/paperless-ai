'use strict';
/**
 * T6 — Draw-to-Custom-Field
 * Verifies that OverlayViewerIsland:
 *   - Activates draw mode when custom-field:draw-request is dispatched with a tempFieldId
 *   - Does NOT activate draw mode when tempFieldId is absent
 *
 * Uses @testing-library/preact; CSS modules are mocked via test/ts-node-register.js.
 * CustomEvent is patched to be compatible with the jsdom window (same pattern as
 * overlay-viewer.toolbar-enhancements.test.js).
 */
const assert = require('assert');
const { h } = require('preact');
const { render, waitFor, cleanup } = require('@testing-library/preact');

const OverlayViewerIsland = require('../../src/islands/OverlayViewerIsland').default;

function patchGlobalsForJsdom() {
  if (global.window) {
    global.window.CustomEvent = function CustomEvent(type, params) {
      const event = new global.window.Event(type, params || {});
      event.detail = (params && params.detail !== undefined) ? params.detail : null;
      return event;
    };
    global.CustomEvent = global.window.CustomEvent;
    global.window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    global.window.cancelAnimationFrame = (id) => clearTimeout(id);
  }
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
}

describe('OverlayViewerIsland - T6 custom-field draw request', function () {
  this.timeout(10000);

  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = async () => ({ ok: false, json: async () => ({}) });

    patchGlobalsForJsdom();

    if (!global.URL) global.URL = {};
    if (!global.URL.createObjectURL) global.URL.createObjectURL = () => 'blob:mock';
    if (!global.URL.revokeObjectURL) global.URL.revokeObjectURL = () => {};
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  it('activates draw mode when custom-field:draw-request fires with a valid tempFieldId', async () => {
    const { container } = render(h(OverlayViewerIsland, { documentId: 10, page: 1, mode: 'draw' }));

    await waitFor(() => {
      const c = container.querySelector('[data-testid="overlay-container"]');
      if (!c) throw new Error('overlay-container not yet rendered');
    }, { timeout: 3000 });

    const overlayContainer = container.querySelector('[data-testid="overlay-container"]');
    assert.ok(overlayContainer, 'overlay-container must exist');

    // Before the event, draw mode should be inactive
    assert.strictEqual(
      overlayContainer.getAttribute('data-draw-mode'),
      'inactive',
      'draw mode should be inactive initially'
    );

    // Dispatch the draw request
    window.dispatchEvent(new window.CustomEvent('custom-field:draw-request', {
      detail: { tempFieldId: 'tmp_field_001' }
    }));

    // Wait for Preact state update to propagate to the DOM attribute
    await waitFor(() => {
      const dm = overlayContainer.getAttribute('data-draw-mode');
      if (dm !== 'active') throw new Error(`Expected data-draw-mode="active", got "${dm}"`);
    }, { timeout: 3000 });

    assert.strictEqual(
      overlayContainer.getAttribute('data-draw-mode'),
      'active',
      'draw mode should be active after custom-field:draw-request'
    );
  });

  it('does not activate draw mode when custom-field:draw-request has no tempFieldId', async () => {
    const { container } = render(h(OverlayViewerIsland, { documentId: 10, page: 1, mode: 'draw' }));

    await waitFor(() => {
      const c = container.querySelector('[data-testid="overlay-container"]');
      if (!c) throw new Error('overlay-container not yet rendered');
    }, { timeout: 3000 });

    const overlayContainer = container.querySelector('[data-testid="overlay-container"]');
    assert.ok(overlayContainer, 'overlay-container must exist');

    // Dispatch draw request without tempFieldId
    window.dispatchEvent(new window.CustomEvent('custom-field:draw-request', {
      detail: {}
    }));

    await new Promise((r) => setTimeout(r, 200));

    assert.strictEqual(
      overlayContainer.getAttribute('data-draw-mode'),
      'inactive',
      'draw mode should remain inactive when tempFieldId is missing'
    );
  });
});
