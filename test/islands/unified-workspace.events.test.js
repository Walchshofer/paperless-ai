const { JSDOM } = require('jsdom');
const assert = require('assert');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', jsx: 'react-jsx', jsxImportSource: 'preact' } });
const { h, render } = require('preact');
const UnifiedWorkspaceIsland = require('../../src/islands/UnifiedWorkspaceIsland.tsx').default;

describe('UnifiedWorkspaceIsland - workspace dirty-state orchestration', function () {
  let dom, document, window;

  beforeEach(() => {
    dom = new JSDOM(`<!doctype html><html><body></body></html>`);
    window = dom.window;
    document = window.document;
    global.document = document;
    global.window = window;
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
  });

  it('sets global workspace state and emits workspace:state-change on workspace:dirty', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(h(UnifiedWorkspaceIsland, { documentId: 123, visual: {} }), root);
    await new Promise((r) => setTimeout(r, 100));

    let seen = null;
    window.addEventListener('workspace:state-change', (e) => { seen = e.detail; });

    window.dispatchEvent(new window.CustomEvent('workspace:dirty', { detail: { documentId: 123 } }));
    await new Promise((r) => setTimeout(r, 50));

    assert.ok(window.__workspaceState, 'workspace state container exists');
    assert.ok(window.__workspaceState[123].isDirty === true, 'document marked dirty in global state');
    // also expose a last_workspace_state_change helper for tests
    assert.deepStrictEqual(window.__last_workspace_state_change, { documentId: 123, isDirty: true });

    const badge = root.querySelector('[data-testid="workspace-state-badge"]');
    assert.ok(badge, 'workspace badge exists');
    assert.strictEqual(badge.getAttribute('data-state'), 'unsaved');
  });

  it('clears dirty state and emits workspace:state-change on sync:success', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(h(UnifiedWorkspaceIsland, { documentId: 456, visual: {} }), root);
    await new Promise((r) => setTimeout(r, 50));

    // mark dirty first
    window.dispatchEvent(new window.CustomEvent('workspace:dirty', { detail: { documentId: 456 } }));
    await new Promise((r) => setTimeout(r, 50));

    // now simulate successful save
    let seen = null;
    window.addEventListener('workspace:state-change', (e) => { seen = e.detail; });

    window.dispatchEvent(new window.CustomEvent('sync:success', { detail: { documentId: 456 } }));
    await new Promise((r) => setTimeout(r, 50));

    assert.ok(window.__workspaceState, 'workspace state container exists');
    assert.ok(window.__workspaceState[456].isDirty === false, 'document marked clean in global state');
    assert.deepStrictEqual(window.__last_workspace_state_change, { documentId: 456, isDirty: false });

    const badge = root.querySelector('[data-testid="workspace-state-badge"]');
    assert.ok(badge, 'workspace badge exists');
    assert.strictEqual(badge.getAttribute('data-state'), 'clean');
  });
});
