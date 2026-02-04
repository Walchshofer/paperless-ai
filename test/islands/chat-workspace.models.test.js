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
      url: 'http://localhost/workspace/doc/1?tab=chat',
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

    // Should contain an option for gpt-4 (current provider is openai)
    // but should NOT contain ollama model (filtered out)
    assert.ok(modelSelect.querySelector('option[value="gpt-4"]'), 'openai model present');

    // Expert models group should contain fino1-8b (expert models shown for all providers)
    assert.ok(modelSelect.querySelector('option[value="fino1-8b"]'), 'expert model present');

    // Text-RAG badge should show as unavailable
    const badge = root.querySelector('[data-testid="chat-text-rag-status"]');
    assert.ok(badge, 'text-rag status badge should render');
    assert.ok(String(badge.textContent).includes('Unavailable') || String(badge.textContent).includes('unavailable'), 'badge should indicate unavailability');
  });

  it('filters models by active provider - ollama', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const modelConfig = {
      providers: {
        openai: ['gpt-4', 'gpt-3.5-turbo'],
        ollama: ['llama3.1:8b', 'mistral:7b'],
        anthropic: ['claude-3-sonnet']
      },
      expertModels: [{ model: 'medllama3:8b', label: 'Medical' }],
      currentProvider: 'ollama'
    };

    render(h(ChatWorkspaceIsland, { aiProvider: 'ollama', modelConfig }), root);
    await new Promise((r) => setTimeout(r, 80));

    const modelSelect = root.querySelector('[data-testid="chat-model-select"]');
    assert.ok(modelSelect, 'model select should render');

    // Ollama models should be present
    assert.ok(modelSelect.querySelector('option[value="llama3.1:8b"]'), 'ollama model llama3.1:8b present');
    assert.ok(modelSelect.querySelector('option[value="mistral:7b"]'), 'ollama model mistral:7b present');

    // OpenAI models should NOT be present (filtered out)
    assert.ok(!modelSelect.querySelector('option[value="gpt-4"]'), 'openai model gpt-4 should be filtered out');
    assert.ok(!modelSelect.querySelector('option[value="gpt-3.5-turbo"]'), 'openai model gpt-3.5-turbo should be filtered out');

    // Anthropic models should NOT be present (filtered out)
    assert.ok(!modelSelect.querySelector('option[value="claude-3-sonnet"]'), 'anthropic model should be filtered out');

    // Expert models should always be present
    assert.ok(modelSelect.querySelector('option[value="medllama3:8b"]'), 'expert model should be present');
  });

  it('displays provider indicator with current provider', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const modelConfig = {
      providers: { openai: ['gpt-4'] },
      currentProvider: 'openai'
    };

    render(h(ChatWorkspaceIsland, { aiProvider: 'openai', modelConfig }), root);
    await new Promise((r) => setTimeout(r, 80));

    const providerIndicator = root.querySelector('[data-testid="chat-provider-indicator"]');
    assert.ok(providerIndicator, 'provider indicator should render');
    assert.ok(String(providerIndicator.textContent).includes('openai'), 'provider indicator shows openai');
  });

  it('shows empty state message with provider name when no models available', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const modelConfig = {
      providers: { anthropic: ['claude-3'] },  // Only anthropic models
      currentProvider: 'openai'  // But openai is selected
    };

    render(h(ChatWorkspaceIsland, { aiProvider: 'openai', modelConfig }), root);
    await new Promise((r) => setTimeout(r, 80));

    const modelSelect = root.querySelector('[data-testid="chat-model-select"]');
    assert.ok(modelSelect, 'model select should render');

    // Should show "No models available for openai"
    const emptyOption = modelSelect.querySelector('option[value=""]');
    assert.ok(emptyOption, 'empty option should exist');
    assert.ok(
      String(emptyOption.textContent).includes('No models available') &&
      String(emptyOption.textContent).includes('openai'),
      'empty option shows provider-specific message'
    );
  });

  it('sets status message when a document is selected', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    // Mock fetch for status and preview
    global.fetch = async (url) => {
      if (url === '/api/chat/status') {
        return { ok: true, json: async () => ({ rag: { available: true } }) };
      }
      if (url.startsWith('/workspace/api/doc/')) {
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

    // After init, chatMessages should include status message
    const chatContainer = root.querySelector('[data-testid="chat-workspace-root"]');
    const _messages = chatContainer.querySelectorAll('.chat-message, .system-message, .assistant-message, .user-message');

    const html = root.innerHTML;
    assert.ok(html.includes('Chat ready for Doc 42.'));

    delete global.fetch;
  });
});
