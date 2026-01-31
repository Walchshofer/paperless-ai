const assert = require('assert');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', jsx: 'react-jsx', jsxImportSource: 'preact' } });
const { h } = require('preact');
const { render } = require('@testing-library/preact');
const DocumentContextBarIsland = require('../../src/islands/DocumentContextBarIsland.tsx').default;

describe('DocumentContextBarIsland - navigation blocking when dirty', () => {
  let originalConfirm;
  beforeEach(() => {
    global.window = global.window || {};
    // reset workspace state
    global.window.__workspaceState = {};
    originalConfirm = global.window.confirm;
  });

  afterEach(() => {
    global.window.confirm = originalConfirm;
    delete global.window.__workspaceState;
  });

  it('opens modal and cancels navigation when user clicks Cancel', () => {
    const props = { documentId: 1, title: 'Doc1', availableDocuments: [{ id: 1, title: 'Doc1' }, { id: 2, title: 'Doc2' }] };
    const { container, getByTestId } = render(h(DocumentContextBarIsland, props));

    // Mark doc 1 as dirty
    global.window.__workspaceState = { '1': { isDirty: true } };

    // Spy on location change
    try { global.window.location = { href: '' }; } catch (e) {}

    const btn = container.querySelector('[data-testid="document-option-2"]');
    assert.ok(btn, 'document option should exist');
    btn.click();

    // Modal should be visible
    const modal = getByTestId('nav-confirm-modal');
    assert.ok(modal, 'modal should be visible');

    // Click cancel
    const cancelBtn = getByTestId('nav-confirm-cancel');
    cancelBtn.click();
    assert.strictEqual(global.window.location.href, '');
  });

  it('discards changes and navigates when Discard is clicked', () => {
    const props = { documentId: 1, title: 'Doc1', availableDocuments: [{ id: 1, title: 'Doc1' }, { id: 2, title: 'Doc2' }] };
    const { container, getByTestId } = render(h(DocumentContextBarIsland, props));

    // Mark doc 1 as dirty
    global.window.__workspaceState = { '1': { isDirty: true } };

    // Spy on location change
    try { global.window.location = { href: '' }; } catch (e) {}

    const btn = container.querySelector('[data-testid="document-option-2"]');
    btn.click();

    const discardBtn = getByTestId('nav-confirm-discard');
    discardBtn.click();

    assert.strictEqual(global.window.location.href, '/document/2');
  });

  it('saves before navigating when Save is clicked', (done) => {
    const props = { documentId: 1, title: 'Doc1', availableDocuments: [{ id: 1, title: 'Doc1' }, { id: 2, title: 'Doc2' }] };
    const { container, getByTestId } = render(h(DocumentContextBarIsland, props));

    // Mark doc 1 as dirty
    global.window.__workspaceState = { '1': { isDirty: true } };

    // Spy on location change
    try { global.window.location = { href: '' }; } catch (e) {}

    // Listen for save request event
    function onSaveReq(e) {
      try {
        assert.strictEqual(e.detail.documentId, 1);
        // Simulate coordinator-driven success
        window.dispatchEvent(new CustomEvent('workspace:save-complete', { detail: { documentId: 1 } }));
      } finally {
        window.removeEventListener('workspace:save-request', onSaveReq);
      }
    }
    window.addEventListener('workspace:save-request', onSaveReq);

    const btn = container.querySelector('[data-testid="document-option-2"]');
    btn.click();

    const saveBtn = getByTestId('nav-confirm-save');
    assert.ok(saveBtn, 'save button should exist');
    saveBtn.click();

    // Give a tick for sync:success handler to run and navigate
    setTimeout(() => {
      assert.strictEqual(global.window.location.href, '/document/2');
      done();
    }, 0);
  });
});