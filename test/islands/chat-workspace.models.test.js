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

  it('renders provider-aware model groups and shows Text-RAG unavailable badge', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const modelConfig = {
      providers: {
        openai: ['gpt-4', 'gpt-4o'],
        ollama: ['gpt-oss:latest']
      },
      expertModels: [{ model: 'fino1-8b', label: 'Financial reasoning' }],
      currentProvider: 'openai'
    };

    render(h(ChatWorkspaceIsland, { aiProvider: 'openai', modelConfig, textRagStatus: { available: false, circuitBreakerState: 'OPEN' } }), root);

    // allow effects to run
    await new Promise((r) => setTimeout(r, 80));

    const modelSelect = root.querySelector('[data-testid="chat-model-select"]');
    assert.ok(modelSelect, 'model select should render');

    // Should contain an option for gpt-4 and gpt-oss
    assert.ok(modelSelect.querySelector('option[value="gpt-4"]'), 'openai model present');
    assert.ok(modelSelect.querySelector('option[value="gpt-oss:latest"]'), 'ollama model present');

    // Expert models group should contain fino1-8b
    assert.ok(modelSelect.querySelector('option[value="fino1-8b"]'), 'expert model present');

    // Text-RAG badge should show as unavailable
    const badge = root.querySelector('[data-testid="chat-text-rag-status"]');
    assert.ok(badge, 'text-rag status badge should render');
    assert.ok(String(badge.textContent).includes('Unavailable') || String(badge.textContent).includes('unavailable'), 'badge should indicate unavailability');
  });

  it('hydrates persisted history returned from /chat/init', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    // Mock fetch for initialize and preview
    global.fetch = async (url) => {
      if (url.startsWith('/chat/init/')) {
        return { ok: true, json: async () => ({
          documentTitle: 'Doc 42',
          initialized: true,
          history: [
            { role: 'system', content: 'system message' },
            { role: 'user', content: 'persisted question' },
            { role: 'assistant', content: 'persisted answer' }
          ]
        }) };
      }
      if (url.startsWith('/manual/preview/')) {
        return { ok: true, json: async () => ({ title: 'Doc 42', content: 'preview' }) };
      }
      return { ok: false, json: async () => ({}) };
    };

    // Provide a safe stub for scrollIntoView in the JSDOM environment
    const originalScroll = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = () => {};

    render(h(ChatWorkspaceIsland, { documents: [{ id: 42, title: 'Doc 42' }], aiProvider: 'ollama' }), root);

    // Simulate selecting a document
    const select = root.querySelector('[data-testid="chat-document-select"]');
    select.value = '42';
    select.dispatchEvent(new window.Event('change'));

    await new Promise((r) => setTimeout(r, 120));

    // restore
    window.HTMLElement.prototype.scrollIntoView = originalScroll;

    // After init, chatMessages should include persisted messages
    const chatContainer = root.querySelector('[data-testid="chat-workspace-root"]');
    const _messages = chatContainer.querySelectorAll('.chat-message, .system-message, .assistant-message, .user-message');

    // Basic assertion: the persisted contents are present somewhere in the document
    const html = root.innerHTML;
    assert.ok(html.includes('persisted question'));
    assert.ok(html.includes('persisted answer'));

    delete global.fetch;
  });
});
