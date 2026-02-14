/* eslint-env mocha */
const assert = require('assert');
const { h } = require('preact');
const { render, cleanup, fireEvent } = require('@testing-library/preact');

const ChatWorkspaceIsland = require('../../src/islands/ChatWorkspaceIsland').default;

describe('ChatWorkspaceIsland - model select availability', () => {
  const originalScrollIntoView = (
    global.window &&
    global.window.HTMLElement &&
    global.window.HTMLElement.prototype &&
    global.window.HTMLElement.prototype.scrollIntoView
  ) || null;

  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.marked = { parse: (text) => text };
      window.hljs = { highlightBlock: () => {} };
      if (window.HTMLElement && window.HTMLElement.prototype) {
        window.HTMLElement.prototype.scrollIntoView = () => {};
      }
      // Component reads global localStorage directly.
      global.localStorage = window.localStorage;
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    cleanup();
    delete global.fetch;
  });

  after(() => {
    if (
      typeof window !== 'undefined' &&
      window.HTMLElement &&
      window.HTMLElement.prototype
    ) {
      window.HTMLElement.prototype.scrollIntoView =
        originalScrollIntoView || (() => {});
    }
  });

  it('renders discovered Ollama models for ollama provider', async () => {
    global.fetch = async (url) => {
      if (url === '/api/visual-rag/health') {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      if (url === '/api/ollama/models') {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3.1:8b', 'qwen3-vl:8b'],
            expertModels: [],
            placeholderModels: [],
            defaultModel: 'llama3.1:8b',
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const { getByTestId } = render(h(ChatWorkspaceIsland, { aiProvider: 'ollama' }));
    await new Promise((resolve) => setTimeout(resolve, 120));

    const modelSelect = getByTestId('chat-model-select');
    const optionValues = Array.from(
      modelSelect.querySelectorAll('option')
    ).map((opt) => opt.value);

    assert.ok(optionValues.includes('llama3.1:8b'));
    assert.ok(optionValues.includes('qwen3-vl:8b'));
    assert.ok(!optionValues.includes(''));
  });

  it('filters configured models by current provider', async () => {
    global.fetch = async (url) => {
      if (url === '/api/visual-rag/health') {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const modelConfig = {
      providers: {
        openai: ['gpt-4o-mini'],
        ollama: ['llama3.1:8b'],
      },
      currentProvider: 'openai',
      expertModels: [],
    };

    const { getByTestId } = render(
      h(ChatWorkspaceIsland, { aiProvider: 'openai', modelConfig })
    );
    await new Promise((resolve) => setTimeout(resolve, 80));

    const modelSelect = getByTestId('chat-model-select');
    const optionValues = Array.from(
      modelSelect.querySelectorAll('option')
    ).map((opt) => opt.value);

    assert.ok(optionValues.includes('gpt-4o-mini'));
    assert.ok(!optionValues.includes('llama3.1:8b'));
  });

  it('does not surface expert entries for non-ollama providers', async () => {
    global.fetch = async (url) => {
      if (url === '/api/visual-rag/health') {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const modelConfig = {
      providers: {
        openai: ['gpt-4o-mini'],
      },
      currentProvider: 'openai',
      expertModels: [{ model: 'fino1-8b', label: 'financial · analysis' }],
    };

    const { getByTestId } = render(
      h(ChatWorkspaceIsland, { aiProvider: 'openai', modelConfig })
    );
    await new Promise((resolve) => setTimeout(resolve, 80));

    const modelSelect = getByTestId('chat-model-select');
    const optionValues = Array.from(
      modelSelect.querySelectorAll('option')
    ).map((opt) => opt.value);

    assert.ok(optionValues.includes('gpt-4o-mini'));
    assert.ok(!optionValues.includes('fino1-8b'));
  });

  it('filters dropdown models by active chat mode', async () => {
    global.fetch = async (url) => {
      if (url === '/api/visual-rag/health') {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      if (url === '/api/chat/status') {
        return {
          ok: true,
          json: async () => ({ rag: { available: true } }),
        };
      }
      if (String(url).startsWith('/workspace/api/doc/')) {
        return {
          ok: true,
          json: async () => ({ title: 'Doc 12', content: 'Preview' }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const modelConfig = {
      providers: {
        ollama: ['llama3.1:8b', 'qwen3-vl:8b'],
      },
      currentProvider: 'ollama',
      expertModels: [],
    };

    const { getByTestId } = render(
      h(ChatWorkspaceIsland, {
        aiProvider: 'ollama',
        modelConfig,
        openDocumentId: 12,
        documents: [{ id: 12, title: 'Doc 12' }],
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 120));

    const modelSelect = getByTestId('chat-model-select');
    const ragOptions = Array.from(
      modelSelect.querySelectorAll('option')
    ).map((opt) => opt.value);
    assert.ok(ragOptions.includes('llama3.1:8b'));
    assert.ok(ragOptions.includes('qwen3-vl:8b'));

    fireEvent.click(getByTestId('chat-mode-document'));
    await new Promise((resolve) => setTimeout(resolve, 80));

    const documentModeOptions = Array.from(
      modelSelect.querySelectorAll('option')
    ).map((opt) => opt.value);
    assert.ok(documentModeOptions.includes('qwen3-vl:8b'));
    assert.ok(!documentModeOptions.includes('llama3.1:8b'));
  });

  it('disables send when current mode has no valid model choices', async () => {
    global.fetch = async (url) => {
      if (url === '/api/visual-rag/health') {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      if (url === '/api/chat/status') {
        return {
          ok: true,
          json: async () => ({ rag: { available: true } }),
        };
      }
      if (String(url).startsWith('/workspace/api/doc/')) {
        return {
          ok: true,
          json: async () => ({ title: 'Doc 12', content: 'Preview' }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const modelConfig = {
      providers: {
        ollama: ['llama3.1:8b'],
      },
      currentProvider: 'ollama',
      defaultModels: { ollama: 'llama3.1:8b' },
      expertModels: [],
    };

    const { getByTestId } = render(
      h(ChatWorkspaceIsland, {
        aiProvider: 'ollama',
        modelConfig,
        openDocumentId: 12,
        documents: [{ id: 12, title: 'Doc 12' }],
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 120));

    const input = getByTestId('chat-input');
    fireEvent.input(input, { target: { value: 'run analysis' } });

    const sendButton = getByTestId('chat-send-button');
    assert.strictEqual(sendButton.disabled, false);

    fireEvent.click(getByTestId('chat-mode-document'));
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.strictEqual(sendButton.disabled, true);

    const modelSelect = getByTestId('chat-model-select');
    const optionValues = Array.from(
      modelSelect.querySelectorAll('option')
    ).map((opt) => opt.value);
    assert.deepStrictEqual(optionValues, ['']);
  });
});
