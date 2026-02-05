/* eslint-env mocha */
const assert = require('assert');
const { h } = require('preact');
const { render, screen, fireEvent, waitFor, cleanup } = require(
  '@testing-library/preact'
);

const OverlayViewerIsland = require('../../src/islands/OverlayViewerIsland')
  .default;

describe('OverlayViewer toolbar enhancements (P1-T4)', function () {
  let originalFetch;
  let originalImage;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalImage = global.Image;
    originalCreateObjectURL = global.URL && global.URL.createObjectURL;
    originalRevokeObjectURL = global.URL && global.URL.revokeObjectURL;

    global.fetch = async (url) => {
      const asString = String(url);
      if (asString.includes('/api/annotations/')) {
        return {
          ok: true,
          json: async () => ({ annotations: [] }),
        };
      }
      if (asString.includes('/api/visual-rag/overlays/')) {
        return {
          ok: true,
          json: async () => ({ overlays: [] }),
        };
      }
      return {
        ok: true,
        blob: async () => new Blob(['x'], { type: 'image/png' }),
      };
    };

    global.Image = class MockImage {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.naturalWidth = 1200;
        this.naturalHeight = 1600;
      }

      set src(_value) {
        setTimeout(() => {
          if (typeof this.onload === 'function') {
            this.onload();
          }
        }, 0);
      }
    };

    if (!global.URL) {
      global.URL = {};
    }
    global.URL.createObjectURL = () => 'blob:mock';
    global.URL.revokeObjectURL = () => {};

    if (global.window) {
      global.window.CustomEvent = function CustomEvent(type, params) {
        const event = new global.window.Event(type, params);
        event.detail = params && params.detail ? params.detail : null;
        return event;
      };
      global.CustomEvent = global.window.CustomEvent;
      global.window.requestAnimationFrame = (cb) =>
        setTimeout(() => cb(Date.now()), 0);
      global.window.cancelAnimationFrame = (id) => clearTimeout(id);
    }
    global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    global.Image = originalImage;

    if (global.URL) {
      global.URL.createObjectURL = originalCreateObjectURL;
      global.URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('renders rotate/fit controls and rotates in 90-degree steps', async () => {
    render(h(OverlayViewerIsland, { documentId: 1, page: 1 }));

    await waitFor(() => {
      assert.ok(screen.getByTestId('overlay-rotate-cw'));
      assert.ok(screen.getByTestId('overlay-fit-width'));
      assert.ok(screen.getByTestId('overlay-fit-height'));
    });

    const rotate = screen.getByTestId('overlay-rotate-cw');
    const rotation = screen.getByTestId('overlay-rotation-degrees');
    const reset = screen.getByTestId('overlay-zoom-reset');

    assert.strictEqual(rotation.textContent.trim(), '0°');

    fireEvent.click(rotate);
    await waitFor(() => {
      assert.strictEqual(rotation.textContent.trim(), '90°');
    });

    fireEvent.click(rotate);
    await waitFor(() => {
      assert.strictEqual(rotation.textContent.trim(), '180°');
    });

    fireEvent.click(reset);
    await waitFor(() => {
      assert.strictEqual(rotation.textContent.trim(), '0°');
    });
  });

  it('enforces 25%-400% zoom bounds and supports fit width/height', async () => {
    render(h(OverlayViewerIsland, { documentId: 2, page: 1 }));

    const zoomIn = await waitFor(() => screen.getByTestId('overlay-zoom-in'));
    const zoomOut = screen.getByTestId('overlay-zoom-out');
    const zoomPct = screen.getByTestId('overlay-zoom-percentage');
    const fitWidth = screen.getByTestId('overlay-fit-width');
    const fitHeight = screen.getByTestId('overlay-fit-height');
    const container = screen.getByTestId('overlay-container');
    const image = screen.getByTestId('overlay-document-image');

    Object.defineProperty(container, 'clientWidth', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(container, 'clientHeight', {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(image, 'naturalWidth', {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(image, 'naturalHeight', {
      configurable: true,
      value: 1600,
    });

    for (let idx = 0; idx < 100; idx += 1) {
      fireEvent.click(zoomIn);
    }
    await waitFor(() => {
      assert.strictEqual(zoomPct.textContent.trim(), '400%');
    });

    for (let idx = 0; idx < 200; idx += 1) {
      fireEvent.click(zoomOut);
    }
    await waitFor(() => {
      assert.strictEqual(zoomPct.textContent.trim(), '25%');
    });

    fireEvent.click(fitWidth);
    await waitFor(() => {
      const value = Number(zoomPct.textContent.replace('%', '').trim());
      assert.ok(value >= 150, 'fit width should increase zoom for tall pages');
    });

    fireEvent.click(fitHeight);
    await waitFor(() => {
      assert.strictEqual(zoomPct.textContent.trim(), '100%');
    });
  });
});
