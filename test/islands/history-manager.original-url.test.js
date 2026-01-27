const { JSDOM } = require('jsdom');
const assert = require('assert');

const tsNodeService = require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    jsx: 'react-jsx',
    jsxImportSource: 'preact',
  },
});

const { h, render } = require('preact');
const HistoryManagerIsland = require(
  '../../src/islands/HistoryManagerIsland.tsx'
).default;


const ORIGINAL_URL = 'http://paperless.test/documents/42/download/original/';
const NORMALIZED_URL = '/api/visual-rag/normalized/42';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('HistoryManagerIsland - original image wiring', function () {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    // Defensive canvas stub for JSDOM environments without test setup hooks.
    if (!global.HTMLCanvasElement) {
      global.HTMLCanvasElement = window.HTMLCanvasElement;
    }
    if (global.HTMLCanvasElement) {
      // JSDOM may define getContext but throw "not implemented", so override.
      global.HTMLCanvasElement.prototype.getContext = () => ({
        clearRect() {},
        drawImage() {},
        getImageData() {
          return { data: new Uint8ClampedArray(4) };
        }
      });
    }

    // OverlayViewerIsland uses global Image() for preloading.
    global.Image = class FakeImage {
      constructor() {
        this._src = '';
        this.crossOrigin = 'anonymous';
        this.naturalWidth = 1000;
        this.naturalHeight = 1000;
        this.onload = null;
        this.onerror = null;
      }

      set src(value) {
        this._src = value;
        setTimeout(() => {
          if (typeof this.onload === 'function') {
            this.onload();
          }
        }, 0);
      }

      get src() {
        return this._src;
      }
    };

    const row = {
      document_id: 42,
      title: 'Invoice 42',
      created_at: new Date('2025-01-01T12:00:00Z').toISOString(),
      tags: [],
      correspondent: null
    };

    global.fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.startsWith('/api/history')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [row],
            recordsTotal: 1,
            recordsFiltered: 1
          })
        };
      }

      if (url.startsWith('/api/visual-rag/overlays/42')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ overlays: [] })
        };
      }

      if (url.startsWith('/manual/preview/42')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            normalized_original_url: NORMALIZED_URL,
            original_url: ORIGINAL_URL,
            pageCount: 3,
          })
        };
      }

      if (url.startsWith('/api/document/42/page-count')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pageCount: 3 })
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({})
      };
    };
  });

  afterEach(async () => {
    // Allow any pending island timers to flush before teardown.
    await delay(25);
    delete global.window;
    delete global.document;
    delete global.fetch;
    delete global.Image;
  });

  it('passes manual preview original_url into the overlay viewer modal', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(h(HistoryManagerIsland, {}), root);

    // Allow initial history load + overlay summary effect.
    await delay(120);

    const visualBtn = root.querySelector('[data-testid="history-visual-42"]');
    assert.ok(visualBtn, 'visual button should render for row 42');

    visualBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    // Allow preview fetch + modal render + nested island effects.
    await delay(320);

    const overlayRoot = root.querySelector('[data-testid="overlay-viewer-root"]');
    assert.ok(overlayRoot, 'overlay viewer root should mount in modal');

    const resolvedOriginal = overlayRoot.getAttribute('data-original-url');
    assert.strictEqual(
      resolvedOriginal,
      NORMALIZED_URL,
      'overlay viewer should prefer manual preview normalized_original_url'
    );
  });
});
