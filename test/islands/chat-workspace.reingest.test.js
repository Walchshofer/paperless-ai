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
const ChatWorkspaceIsland = require(
  '../../src/islands/ChatWorkspaceIsland.tsx'
).default;

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: {
      get() {
        return 'application/json';
      },
    },
  };
}

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ChatWorkspaceIsland - text reingest', function () {
  let dom;
  let window;
  let document;
  let root;
  let reingestRequest;
  let resolveReingest;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'http://localhost/workspace/doc/42?tab=chat',
    });
    window = dom.window;
    document = window.document;
    root = document.createElement('div');
    document.body.appendChild(root);

    global.window = window;
    global.document = document;
    global.CustomEvent = window.CustomEvent;
    global.localStorage = window.localStorage;
    window.marked = { parse: (text) => text };
    window.hljs = { highlightBlock: () => {} };
    window.confirm = () => true;
    window.HTMLElement.prototype.scrollIntoView = () => {};

    reingestRequest = null;
    resolveReingest = null;

    global.fetch = async (url, options = {}) => {
      if (url === '/api/visual-rag/health') {
        return jsonResponse({ status: 'ok', model_loaded: true });
      }
      if (url === '/api/ollama/models') {
        return jsonResponse({
          models: ['qwen3:8b'],
          expertModels: [],
          placeholderModels: [],
          defaultModel: 'qwen3:8b',
        });
      }
      if (url === '/api/chat/status') {
        return jsonResponse({ rag: { available: true } });
      }
      if (url === '/workspace/api/doc/42') {
        return jsonResponse({
          title: 'Doc 42',
          content: 'Example preview',
          tags: [],
          pageCount: 1,
        });
      }
      if (url === '/api/rag/reingest/42') {
        reingestRequest = {
          url,
          method: options.method,
        };
        return new Promise((resolve) => {
          resolveReingest = () => {
            resolve(
              jsonResponse({
                success: true,
                message: 'Text reingest started for document 42',
              })
            );
          };
        });
      }
      return jsonResponse({}, 404);
    };
  });

  afterEach(() => {
    render(null, root);
    delete global.window;
    delete global.document;
    delete global.CustomEvent;
    delete global.localStorage;
    delete global.fetch;
  });

  it('runs text reingest with loading and success status', async () => {
    render(h(ChatWorkspaceIsland, {
      aiProvider: 'ollama',
      openDocumentId: 42,
      documents: [{ id: 42, title: 'Doc 42' }],
    }), root);

    await wait(120);

    const button = root.querySelector('[data-testid="chat-reingest-text-btn"]');
    assert.ok(button, 'text reingest button should render');
    assert.strictEqual(button.disabled, false, 'button should be enabled');

    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await wait(10);

    assert.ok(
      String(button.textContent).includes('Reingesting...'),
      'button should show loading text while request is pending'
    );
    assert.ok(reingestRequest, 'reingest endpoint should be called');
    assert.strictEqual(reingestRequest.url, '/api/rag/reingest/42');
    assert.strictEqual(reingestRequest.method, 'POST');

    assert.ok(resolveReingest, 'reingest resolver should be captured');
    resolveReingest();
    await wait(30);

    const status = root.querySelector(
      '[data-testid="chat-reingest-text-status"]'
    );
    assert.ok(status, 'status should be rendered');
    assert.ok(
      String(status.textContent).includes('Text reingest started'),
      'status should show success message'
    );
  });

  it('disables text reingest when no document is selected', async () => {
    render(h(ChatWorkspaceIsland, {
      aiProvider: 'ollama',
      documents: [],
    }), root);

    await wait(100);

    const button = root.querySelector('[data-testid="chat-reingest-text-btn"]');
    assert.ok(button, 'text reingest button should render in rag mode');
    assert.strictEqual(button.disabled, true, 'button should be disabled');
  });
});
