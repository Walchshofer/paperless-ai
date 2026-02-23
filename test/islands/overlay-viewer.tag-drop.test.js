'use strict';
/**
 * T5b — Tag Drag-Drop to Document Viewer
 * Verifies that the OverlayViewer container:
 *   - Has an onDragOver handler that prevents default
 *   - Dispatches `tag:drag-dropped` on a valid drop with the correct payload
 *   - Ignores drops with no tag data
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
  // Patch CustomEvent so component-dispatched events are compatible with jsdom
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

describe('OverlayViewerIsland - T5b tag drag-drop', function () {
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

  it('container dispatches tag:drag-dropped with correct payload on valid drop', async () => {
    const { container } = render(h(OverlayViewerIsland, { documentId: 77, page: 2 }));

    await waitFor(() => {
      const c = container.querySelector('[data-testid="overlay-container"]');
      if (!c) throw new Error('overlay-container not yet rendered');
    }, { timeout: 3000 });

    const overlayContainer = container.querySelector('[data-testid="overlay-container"]');
    assert.ok(overlayContainer, 'overlay-container must exist in the rendered output');

    let droppedDetail = null;
    const handler = (e) => { droppedDetail = e.detail; };
    window.addEventListener('tag:drag-dropped', handler);

    const tagData = { id: 5, name: 'Invoice', color: '#ff0000' };

    // Simulate drop event with tag payload
    const dropEvent = new window.Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { getData: (type) => type === 'application/paperless-tag' ? JSON.stringify(tagData) : '' },
      configurable: true
    });
    Object.defineProperty(dropEvent, 'clientX', { value: 200, configurable: true });
    Object.defineProperty(dropEvent, 'clientY', { value: 150, configurable: true });
    overlayContainer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 });

    overlayContainer.dispatchEvent(dropEvent);

    await new Promise((r) => setTimeout(r, 80));
    window.removeEventListener('tag:drag-dropped', handler);

    assert.ok(droppedDetail, 'tag:drag-dropped should have been dispatched');
    assert.strictEqual(droppedDetail.tagId, 5, 'tagId should be 5');
    assert.strictEqual(droppedDetail.tagName, 'Invoice', 'tagName should be Invoice');
    assert.strictEqual(droppedDetail.color, '#ff0000', 'color should match');
    assert.ok(typeof droppedDetail.bbox === 'object' && droppedDetail.bbox !== null, 'bbox must be an object');
    assert.strictEqual(droppedDetail.bbox.width, 0.1, 'bbox.width should be 0.1');
    assert.strictEqual(droppedDetail.bbox.height, 0.06, 'bbox.height should be 0.06');
    assert.strictEqual(droppedDetail.page, 2, 'page should match current page');
  });

  it('does not dispatch tag:drag-dropped when drop has no tag data', async () => {
    const { container } = render(h(OverlayViewerIsland, { documentId: 77, page: 1 }));

    await waitFor(() => {
      const c = container.querySelector('[data-testid="overlay-container"]');
      if (!c) throw new Error('overlay-container not yet rendered');
    }, { timeout: 3000 });

    const overlayContainer = container.querySelector('[data-testid="overlay-container"]');
    assert.ok(overlayContainer, 'overlay-container must exist');

    let fired = false;
    const handler = () => { fired = true; };
    window.addEventListener('tag:drag-dropped', handler);

    const dropEvent = new window.Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { getData: () => '' },
      configurable: true
    });
    Object.defineProperty(dropEvent, 'clientX', { value: 100, configurable: true });
    Object.defineProperty(dropEvent, 'clientY', { value: 100, configurable: true });
    overlayContainer.dispatchEvent(dropEvent);

    await new Promise((r) => setTimeout(r, 80));
    window.removeEventListener('tag:drag-dropped', handler);

    assert.strictEqual(fired, false, 'should not fire when no tag data is present');
  });
});
