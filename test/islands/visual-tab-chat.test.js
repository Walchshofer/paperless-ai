/* eslint-env mocha */
const { JSDOM } = require('jsdom');
const assert = require('assert');

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    jsx: 'react-jsx',
    jsxImportSource: 'preact',
  },
});

const { h, render } = require('preact');
const VisualTabIsland = require('../../src/islands/VisualTabIsland.tsx').default;

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submitQuery(rootNode, win, text) {
  const input = rootNode.querySelector('[data-testid="visual-chat-input"]');
  assert.ok(input, 'visual chat input should render');
  input.value = text;
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  await wait(10);

  const searchButton = rootNode.querySelector('[data-testid="visual-chat-search-btn"]');
  assert.ok(searchButton, 'visual chat search button should render');
  assert.strictEqual(searchButton.disabled, false, 'search button should be enabled');
  searchButton.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
}

describe('VisualTabIsland - visual chat', function () {
  let dom;
  let window;
  let document;
  let root;
  let searchPayload;
  const initialOverlays = [
    {
      id: 'ov-1',
      label: 'Invoice Total',
      pageNumber: 1,
      confidence: 0.94,
      bbox: { x: 0.2, y: 0.3, width: 0.25, height: 0.1 },
    },
  ];
  const initialFields = [
    {
      id: 'invoice_total',
      label: 'Invoice Total',
      isMapped: true,
      overlayId: 'ov-1',
    },
  ];

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'http://localhost/workspace/doc/1?tab=visual',
    });
    window = dom.window;
    document = window.document;
    root = document.createElement('div');
    document.body.appendChild(root);

    global.window = window;
    global.document = document;
    global.CustomEvent = window.CustomEvent;
    global.alert = () => {};
    global.confirm = () => true;
    searchPayload = null;

    class MockFileReader {
      constructor() {
        this.result = 'data:image/png;base64,ZmFrZQ==';
        this.onload = null;
        this.onerror = null;
      }
      readAsDataURL() {
        if (this.onload) {
          this.onload(new window.Event('load'));
        }
      }
    }

    global.FileReader = MockFileReader;

    global.fetch = async (url, options = {}) => {
      if (url.startsWith('/api/visual-overlays/missing-fields/')) {
        return jsonResponse({
          fields: initialFields,
        });
      }

      if (url.startsWith('/api/visual-overlays/document/')) {
        return jsonResponse({
          overlays: initialOverlays,
        });
      }

      if (url === '/api/visual-rag/search') {
        searchPayload = JSON.parse(options.body || '{}');
        return jsonResponse({
          results: [
            {
              docId: 1,
              title: 'Invoice 2026-001',
              pageNum: 1,
              score: 0.92,
              source: 'hybrid',
              content: 'Invoice Total: $1,234.56',
              overlays: [
                {
                  bbox: { x: 0.2, y: 0.3, width: 0.25, height: 0.1 },
                },
              ],
            },
          ],
        });
      }

      if (url === '/api/visual-rag/search/visual') {
        return jsonResponse({ results: [] });
      }

      return jsonResponse({}, 404);
    };
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.CustomEvent;
    delete global.alert;
    delete global.confirm;
    delete global.fetch;
    delete global.FileReader;
  });

  it('attaches overlay and runs hybrid search with overlay context', async () => {
    render(h(VisualTabIsland, {
      documentId: 1,
      fields: initialFields,
      overlays: initialOverlays,
    }), root);
    await wait(60);

    const attachButton = root.querySelector('[data-testid="attach-overlay-ov-1"]');
    assert.ok(attachButton, 'overlay attach button should be present');
    attachButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    await wait(0);
    const attachmentChip = root.querySelector(
      '[data-testid="visual-chat-overlay-attachment-ov-1"]'
    );
    assert.ok(attachmentChip, 'overlay attachment chip should render');

    await submitQuery(root, window, 'Find the invoice total');

    await wait(100);

    assert.ok(searchPayload, 'hybrid search should be called');
    assert.ok(
      String(searchPayload.query).includes('Overlay context: Invoice Total'),
      'query should include overlay context'
    );

    const html = root.textContent || '';
    assert.ok(html.includes('Found 1 matching result'), 'assistant result should render');
    assert.ok(html.includes('Source: Hybrid'), 'source attribution should render');
  });

  it('dispatches highlight event for Show in Document', async () => {
    render(h(VisualTabIsland, {
      documentId: 1,
      fields: initialFields,
      overlays: initialOverlays,
    }), root);
    await wait(60);

    await submitQuery(root, window, 'Find the invoice total');

    await wait(100);

    let highlightDetail = null;
    window.addEventListener(
      'overlay:highlight-region',
      (event) => {
        highlightDetail = event.detail;
      },
      { once: true }
    );

    const showButton = root.querySelector(
      '[data-testid^="visual-chat-show-document-"]'
    );
    assert.ok(showButton, 'show in document button should render');
    showButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    await wait(0);
    assert.ok(highlightDetail, 'highlight event should fire');
    assert.strictEqual(highlightDetail.page, 1, 'highlight event should target page');
    assert.ok(highlightDetail.bbox, 'highlight event should include bbox');
  });

  it('persists chat history in session for the active document', async () => {
    render(h(VisualTabIsland, {
      documentId: 1,
      fields: initialFields,
      overlays: initialOverlays,
    }), root);
    await wait(60);

    await submitQuery(root, window, 'Find the invoice total');
    await wait(100);

    const storageKey = 'paperless:visual-chat:1';
    const stored = window.sessionStorage.getItem(storageKey);
    assert.ok(stored, 'session storage should contain visual chat history');

    render(null, root);
    render(h(VisualTabIsland, {
      documentId: 1,
      fields: initialFields,
      overlays: initialOverlays,
    }), root);
    await wait(120);

    const restoredText = root.textContent || '';
    assert.ok(
      restoredText.includes('Find the invoice total'),
      'restored history should include previous user message'
    );
  });

  it('adds image attachment through file picker', async () => {
    render(h(VisualTabIsland, {
      documentId: 1,
      fields: initialFields,
      overlays: initialOverlays,
    }), root);
    await wait(60);

    const input = root.querySelector('[data-testid="visual-chat-file-input"]');
    assert.ok(input, 'file input should exist');

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ name: 'receipt.png' }],
    });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await wait(10);

    const attachmentContainer = root.querySelector(
      '[data-testid="visual-chat-attachments"]'
    );
    assert.ok(attachmentContainer, 'attachment container should be visible');
    assert.ok(
      String(attachmentContainer.textContent).includes('receipt.png'),
      'image attachment chip should render file name'
    );
  });
});
