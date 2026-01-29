const { JSDOM } = require('jsdom');
const assert = require('assert');

const { mountIslands } = require('../../src/islands/runtime');

describe('island runtime - Manual Editor ARIA and focus', function () {
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
    anchor.setAttribute('data-island', 'manual-editor-island');
    anchor.setAttribute('data-testid', 'manual-editor-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 123 }));
    document.body.appendChild(anchor);

    mountIslands(document);

    const metaBtn = anchor.querySelector('[data-testid="tab-metadata"]');
    const contentBtn = anchor.querySelector('[data-testid="tab-content"]');
    const fieldsBtn = anchor.querySelector('[data-testid="tab-fields"]');

    assert.ok(metaBtn && contentBtn && fieldsBtn, 'All three tab buttons should exist');
    // Initially metadata is active
    assert.strictEqual(metaBtn.getAttribute('aria-selected'), 'true');
    assert.strictEqual(contentBtn.getAttribute('aria-selected'), 'false');

    // Click content tab
    contentBtn.click();
    assert.strictEqual(contentBtn.getAttribute('aria-selected'), 'true');
    assert.strictEqual(metaBtn.getAttribute('aria-selected'), 'false');
  });

  it('supports keyboard navigation (ArrowRight/Left)', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'manual-editor-island');
    anchor.setAttribute('data-testid', 'manual-editor-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 123 }));
    document.body.appendChild(anchor);

    mountIslands(document);

    const tabs = Array.from(anchor.querySelectorAll('[role="tab"]'));
    assert.ok(tabs.length === 4, 'expected 4 tabs');

    // Simulate ArrowRight key on the first tab element
    const e = new window.KeyboardEvent('keydown', { key: 'ArrowRight' });
    tabs[0].dispatchEvent(e);

    // Now the second tab should be active
    assert.strictEqual(tabs[1].getAttribute('aria-selected'), 'true');
  });

  it('all tabs expose aria-selected as string and toggle correctly', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'manual-editor-island');
    anchor.setAttribute('data-testid', 'manual-editor-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 123 }));
    document.body.appendChild(anchor);

    mountIslands(document);

    const metaBtn = anchor.querySelector('[data-testid="tab-metadata"]');
    const contentBtn = anchor.querySelector('[data-testid="tab-content"]');
    const fieldsBtn = anchor.querySelector('[data-testid="tab-fields"]');
    const aiBtn = anchor.querySelector('[data-testid="tab-ai-debug"]');

    assert.ok(metaBtn && contentBtn && fieldsBtn && aiBtn, 'expected 4 tab buttons');

    // Initially metadata active
    assert.strictEqual(metaBtn.getAttribute('aria-selected'), 'true');
    assert.strictEqual(typeof metaBtn.getAttribute('aria-selected'), 'string');

    // Click fields tab
    fieldsBtn.click();
    assert.strictEqual(fieldsBtn.getAttribute('aria-selected'), 'true');
    assert.strictEqual(metaBtn.getAttribute('aria-selected'), 'false');
  });
});
