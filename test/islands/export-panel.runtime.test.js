const { JSDOM } = require('jsdom');
const assert = require('assert');
const { h, render } = require('preact');

// Import the compiled TSX component via ts-node transpilation in test setup
const ExportPanelIsland = require('../../src/islands/ExportPanelIsland').default;

describe('export-panel runtime smoke', function () {
  let dom, document, window, anchor;

  beforeEach(() => {
    dom = new JSDOM(`<!doctype html><html><body></body></html>`);
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'export-panel-island');
    anchor.setAttribute('data-testid', 'export-panel-island');
    document.body.appendChild(anchor);
  });

  afterEach(() => {
    // Unmount Preact tree
    render(null, anchor);
    delete global.window;
    delete global.document;
  });

  it('opens modal when export:text-requested is dispatched', async () => {
    // Mount the Preact component directly into the anchor
    render(h(ExportPanelIsland, { documentId: 999 }), anchor);

    // Ensure modal not present initially
    let header = anchor.querySelector('h2');
    assert.strictEqual(header, null, 'expected no modal initially');

    // Dispatch export:text-requested
    const ev = new window.CustomEvent('export:text-requested', { detail: { text: 'Hello world' } });
    window.dispatchEvent(ev);

    // Allow effects to run (microtask)
    await new Promise((r) => setTimeout(r, 0));

    header = anchor.querySelector('h2');
    assert.ok(header, 'expected modal header after dispatch');
    assert.ok(/Export\s+text/i.test(header.textContent), `expected header to include 'Export text', got '${header.textContent}'`);
  });
});
