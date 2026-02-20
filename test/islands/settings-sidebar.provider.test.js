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

const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SettingsSidebarIsland - navigation sync', function () {
  let dom;
  let window;
  let document;
  let root;

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

    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.localStorage;
  });

  it('keeps developer categories hidden when developer mode is off', async () => {
    render(h(SettingsSidebarIsland, {}), root);
    await wait();

    assert.strictEqual(
      root.querySelector('[data-testid="category-developer"]'),
      null
    );
    assert.strictEqual(
      root.querySelector('[data-testid="category-prompts"]'),
      null
    );
  });

  it('dispatches prompts category even when prompts is already active', async () => {
    window.localStorage.setItem('settings:developerMode', 'true');
    window.localStorage.setItem('settings:lastCategory', 'prompts');

    const seenCategories = [];
    const listener = (e) => {
      seenCategories.push(e?.detail?.category || null);
    };
    document.addEventListener('settings:category-changed', listener);

    render(h(SettingsSidebarIsland, {}), root);
    await wait();

    const promptsButton = root.querySelector('[data-testid="category-prompts"]');
    assert.ok(promptsButton, 'Expected prompts category button to be visible');

    seenCategories.length = 0;
    promptsButton.dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true })
    );
    await wait();
    document.removeEventListener('settings:category-changed', listener);

    assert.ok(
      seenCategories.includes('prompts'),
      'Expected first prompts click to emit category change'
    );
    assert.strictEqual(window.location.hash, '#prompts');
  });

  it('normalizes nested prompts hash to prompts category state', async () => {
    window.localStorage.setItem('settings:developerMode', 'true');
    window.history.replaceState({}, '', '/settings#prompts/fin_extract_v1');

    const seenCategories = [];
    const listener = (e) => {
      seenCategories.push(e?.detail?.category || null);
    };
    document.addEventListener('settings:category-changed', listener);

    render(h(SettingsSidebarIsland, {}), root);
    await wait();
    document.removeEventListener('settings:category-changed', listener);

    const promptsButton = root.querySelector('[data-testid="category-prompts"]');
    assert.ok(promptsButton, 'Expected prompts category to be rendered');
    assert.ok(
      (promptsButton.getAttribute('class') || '').includes('bg-cyan-500/10'),
      'Expected prompts category to be active'
    );
    assert.strictEqual(
      window.localStorage.getItem('settings:lastCategory'),
      'prompts'
    );
    assert.ok(
      seenCategories.includes('prompts'),
      'Expected nested prompts hash to resolve to prompts category'
    );
  });

  it('falls back to overview for prompts hash when developer mode is off', async () => {
    window.localStorage.setItem('settings:developerMode', 'false');
    window.history.replaceState({}, '', '/settings#prompts');

    const seenCategories = [];
    const listener = (e) => {
      seenCategories.push(e?.detail?.category || null);
    };
    document.addEventListener('settings:category-changed', listener);

    render(h(SettingsSidebarIsland, {}), root);
    await wait();
    document.removeEventListener('settings:category-changed', listener);

    const overviewButton = root.querySelector('[data-testid="category-overview"]');
    assert.ok(overviewButton, 'Expected overview category to be rendered');
    assert.ok(
      (overviewButton.getAttribute('class') || '').includes('bg-cyan-500/10'),
      'Expected overview category to be active fallback'
    );
    assert.strictEqual(
      window.localStorage.getItem('settings:lastCategory'),
      'overview'
    );
    assert.strictEqual(window.location.hash, '#overview');
    assert.ok(
      seenCategories.includes('overview'),
      'Expected fallback category change to overview'
    );
  });
});
