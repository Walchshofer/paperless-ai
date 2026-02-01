const assert = require('assert');
// Fix: ensure globals are set for tests that don't go through mocha's require chain correctly
if (typeof global.window === 'undefined') {
  const jsdom = require('jsdom');
  const dom = new jsdom.JSDOM('<!doctype html><html><body></body></html>', { 
    url: 'http://localhost',
    pretendToBeVisual: true 
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  global.CustomEvent = dom.window.CustomEvent;
  // Ensure confirm exists
  if (!global.window.confirm) {
    global.window.confirm = () => true;
  }
}

const { h } = require('preact');
const { render } = require('@testing-library/preact');
const DocumentContextBarIsland = require('../../src/islands/DocumentContextBarIsland.tsx').default;

describe('DocumentContextBarIsland - navigation blocking when dirty', () => {
  let originalConfirm;
  beforeEach(() => {
    // reset workspace state
    if (!global.window.__workspaceState) global.window.__workspaceState = {};
    else Object.keys(global.window.__workspaceState).forEach(k => delete global.window.__workspaceState[k]);
    
    originalConfirm = global.window.confirm;
  });

  afterEach(() => {
    global.window.confirm = originalConfirm;
  });

  it('opens modal and cancels navigation when user clicks Cancel', () => {
    const props = { 
      documentId: 1, 
      title: 'Doc1', 
      availableDocuments: [{ id: 1, title: 'Doc1' }, { id: 2, title: 'Doc2' }] 
    };
    const { container, getByTestId } = render(h(DocumentContextBarIsland, props));

    // Mark doc 1 as dirty
    global.window.__workspaceState['1'] = { isDirty: true };

    // Spy on location change
    try { global.window.location = { href: '' }; } catch (e) {}

    // Open the selector dropdown explicitly so options are present
    const trigger = container.querySelector('[data-testid="document-selector-trigger"]');
    trigger.click();

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
    const props = { 
      documentId: 1, 
      title: 'Doc1', 
      availableDocuments: [{ id: 1, title: 'Doc1' }, { id: 2, title: 'Doc2' }] 
    };
    const { container, getByTestId } = render(h(DocumentContextBarIsland, props));

    // Mark doc 1 as dirty
    global.window.__workspaceState['1'] = { isDirty: true };

    // Spy on location change
    try { global.window.location = { href: '' }; } catch (e) {}

    // Open selector dropdown
    const trigger = container.querySelector('[data-testid="document-selector-trigger"]');
    trigger.click();

    const btn = container.querySelector('[data-testid="document-option-2"]');
    btn.click();

    const discardBtn = getByTestId('nav-confirm-discard');
    discardBtn.click();

    assert.strictEqual(global.window.location.href, '/document/2');
  });

  it('saves before navigating when Save is clicked', (done) => {
    const props = { 
      documentId: 1, 
      title: 'Doc1', 
      availableDocuments: [{ id: 1, title: 'Doc1' }, { id: 2, title: 'Doc2' }] 
    };
    const { container, getByTestId } = render(h(DocumentContextBarIsland, props));

    // Mark doc 1 as dirty
    global.window.__workspaceState['1'] = { isDirty: true };

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

    // Open selector dropdown
    const trigger = container.querySelector('[data-testid="document-selector-trigger"]');
    trigger.click();

    const btn = container.querySelector('[data-testid="document-option-2"]');
    btn.click();

    const saveBtn = getByTestId('nav-confirm-save');
    assert.ok(saveBtn, 'save button should exist');
    saveBtn.click();

    // Give a tick for handlers to run
    setTimeout(() => {
      assert.strictEqual(global.window.location.href, '/document/2');
      done();
    }, 10);
  });

  it('forces selector open when documentId is null', () => {
    const props = { 
      documentId: null, 
      title: null, 
      availableDocuments: [{ id: 1, title: 'Doc1' }] 
    };
    const { getByTestId } = render(h(DocumentContextBarIsland, props));
    
    // Selector should be open (dropdown visible)
    const dropdown = getByTestId('document-selector-dropdown');
    assert.ok(dropdown, 'Dropdown should be open by default when documentId is null');
    
    // Should show search input
    const searchInput = getByTestId('document-search-input');
    assert.ok(searchInput, 'Search input should be visible');
  });
});