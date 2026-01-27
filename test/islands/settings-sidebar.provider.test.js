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
const SettingsSidebarIsland = require(
  '../../src/islands/SettingsSidebarIsland.tsx'
).default;

describe('SettingsSidebarIsland - provider gating', function () {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'http://localhost/settings',
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;
    window.localStorage.clear();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.localStorage;
  });

  it('hides expert models when provider is not ollama', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(h(SettingsSidebarIsland, { aiProvider: 'openai' }), root);
    await new Promise((r) => setTimeout(r, 200));

    const expertButton = root.querySelector(
      '[data-testid="category-expert-models"]'
    );
    assert.strictEqual(expertButton, null);
  });

  it('redirects expert category to ai-provider when provider is not ollama', async () => {
    window.localStorage.setItem('settings:lastCategory', 'expert-models');

    let seenCategory = null;
    const listener = (e) => {
      seenCategory = e?.detail?.category || null;
    };
    document.addEventListener('settings:category-changed', listener);

    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(SettingsSidebarIsland, { aiProvider: 'openai' }), root);

    await new Promise((r) => setTimeout(r, 200));
    document.removeEventListener('settings:category-changed', listener);

    assert.strictEqual(seenCategory, 'ai-provider');
    assert.strictEqual(
      window.localStorage.getItem('settings:lastCategory'),
      'ai-provider'
    );
  });
});
