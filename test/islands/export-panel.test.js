const { JSDOM } = require('jsdom');
const assert = require('assert');

const { mountIslands } = require('../../src/islands/runtime');

describe('island runtime - Export Panel', function () {
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

  it('renders placeholder and includes documentId when provided', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'export-panel-island');
    anchor.setAttribute('data-testid', 'export-panel-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 222 }));
    document.body.appendChild(anchor);

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="export-panel-root"]');
    assert.ok(root, 'expected export panel root');
    const text = root.textContent || '';
    assert.ok(text.includes('222'), 'expected document id to be present in placeholder');
  });
});
