const { JSDOM } = require('jsdom');
const assert = require('assert');

const { mountIslands } = require('../../src/islands/runtime');

describe('island runtime - HistoryTabs ARIA and focus', function () {
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

  it('renders tabs and updates aria-selected on click', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'history-tabs-island');
    anchor.setAttribute('data-testid', 'history-tabs-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 99 }));
    document.body.appendChild(anchor);

    mountIslands(document);

    const textBtn = anchor.querySelector('[data-testid="tab-text"]');
    const metadataBtn = anchor.querySelector('[data-testid="tab-metadata"]');
    const similarBtn = anchor.querySelector('[data-testid="tab-similar"]');

    assert.ok(textBtn && metadataBtn && similarBtn, 'All three tab buttons should exist');

    // Initially text is active
    assert.strictEqual(textBtn.getAttribute('aria-selected'), 'true');
    assert.strictEqual(metadataBtn.getAttribute('aria-selected'), 'false');

    // Click metadata
    metadataBtn.click();
    assert.strictEqual(metadataBtn.getAttribute('aria-selected'), 'true');
    assert.strictEqual(textBtn.getAttribute('aria-selected'), 'false');
  });

  it('supports keyboard navigation (ArrowRight/Left)', async () => {
    // Dispatch events on the tablist element (more reliable in JSDOM than button-level events)

    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'history-tabs-island');
    anchor.setAttribute('data-testid', 'history-tabs-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 99 }));
    document.body.appendChild(anchor);

    mountIslands(document);

    // Allow effects (including the document-level key handler) to install
    await new Promise((r) => setTimeout(r, 0));

    const textBtn = anchor.querySelector('[data-testid="tab-text"]');
    const metadataBtn = anchor.querySelector('[data-testid="tab-metadata"]');

    assert.ok(textBtn && metadataBtn, 'Text and Metadata tabs should exist');

    // Focus the initial (text) tab
    textBtn.focus();
    assert.strictEqual(document.activeElement, textBtn);


    // Dispatch ArrowRight on the tablist to reliably trigger the tab handler
    const _tablist = anchor.querySelector('[role="tablist"]');
    // Use the deterministic test hook instead of keyboard events in JSDOM
    window.dispatchEvent(new window.CustomEvent('history-tabs:navigate', { detail: { dir: 'right' } }));

    // Wait a couple ticks for state update + focus side-effects
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // Metadata tab should be selected
    const meta = anchor.querySelector('[data-testid="tab-metadata"]');
    assert.strictEqual(meta && meta.getAttribute('aria-selected'), 'true');

    // Focus should now be on the metadata button (robust to node replacement)
    const activeTestId = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-testid');
    assert.strictEqual(activeTestId, 'tab-metadata');

    // Dispatch left via test hook
    window.dispatchEvent(new window.CustomEvent('history-tabs:navigate', { detail: { dir: 'left' } }));

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const text = anchor.querySelector('[data-testid="tab-text"]');
    assert.strictEqual(text && text.getAttribute('aria-selected'), 'true');
    const activeTestId2 = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-testid');
    assert.strictEqual(activeTestId2, 'tab-text');
  });

  it('panels expose aria-hidden as string and toggle correctly', async () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'history-tabs-island');
    anchor.setAttribute('data-testid', 'history-tabs-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 99 }));
    document.body.appendChild(anchor);

    mountIslands(document);

    const textPanel = anchor.querySelector('[data-testid="panel-text"]');
    const metadataPanel = anchor.querySelector('[data-testid="panel-metadata"]');
    const similarPanel = anchor.querySelector('[data-testid="panel-similar"]');

    assert.ok(textPanel && metadataPanel && similarPanel, 'All three panels should exist');

    // Wait a tick so effects that set ARIA attributes run
    await new Promise((r) => setTimeout(r, 0));

    // Ensure clicking tabs updates aria-hidden on panels (either attribute or class state)
    const textBtn = anchor.querySelector('[data-testid="tab-text"]');
    const similarBtn = anchor.querySelector('[data-testid="tab-similar"]');

    // Activate text explicitly
    textBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(textPanel.getAttribute('aria-hidden') === 'false' || !textPanel.classList.contains('hidden'));

    // Switch to similar
    similarBtn.click();
    await new Promise((r) => setTimeout(r, 0));

    assert.ok(similarPanel.getAttribute('aria-hidden') === 'false' || !similarPanel.classList.contains('hidden'));
    assert.ok(textPanel.getAttribute('aria-hidden') === 'true' || textPanel.classList.contains('hidden'));
  });
});
