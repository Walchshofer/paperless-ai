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

describe('ChatWorkspaceIsland - model placeholders', function () {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'http://localhost/chat',
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    window.marked = { parse: (text) => text };
    window.hljs = { highlightBlock: () => {} };

    global.fetch = async (url) => {
      if (url === '/api/ollama/models') {
        return {
          ok: true,
          json: async () => ({
            models: [],
            expertModels: [],
            placeholderModels: ['qwen3:8b'],
            providerMismatch: true,
            defaultModel: '',
          }),
        };
      }
      return {
        ok: false,
        json: async () => ({}),
      };
    };
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.fetch;
  });

  it('renders configured placeholder models when installed models are missing', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(h(ChatWorkspaceIsland, { aiProvider: 'ollama' }), root);
    await new Promise((r) => setTimeout(r, 80));

    const modelSelect = root.querySelector('[data-testid="chat-model-select"]');
    assert.ok(modelSelect, 'model select should render');

    const placeholderOption = modelSelect.querySelector('option[value="qwen3:8b"]');
    assert.ok(placeholderOption, 'placeholder model should be present');
    assert.ok(
      String(placeholderOption.textContent).includes('lazy load'),
      'placeholder option should indicate lazy load'
    );
  });
});
