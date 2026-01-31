const { JSDOM } = require('jsdom');
const assert = require('assert');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', jsx: 'react-jsx', jsxImportSource: 'preact' } });
const { h, render } = require('preact');
const DocumentContextBar = require('../../src/islands/DocumentContextBarIsland.tsx').default;

describe('DocumentContextBarIsland - reacts to workspace events', function () {
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

  it('sets data-status="unsaved" when workspace:dirty is emitted for same document', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(DocumentContextBar, { documentId: 42, title: 'Doc 42', availableDocuments: [{ id: 42, title: 'Doc 42' }] }), root);

    await new Promise((r) => setTimeout(r, 50));

    window.dispatchEvent(new window.CustomEvent('workspace:dirty', { detail: { documentId: 42 } }));
    await new Promise((r) => setTimeout(r, 50));

    const container = root.querySelector('[data-testid="document-context-bar-root"]');
    assert.ok(container, 'root exists');
    assert.strictEqual(container.getAttribute('data-status'), 'unsaved');
  });
});
