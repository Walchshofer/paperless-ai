const { JSDOM } = require('jsdom');
const assert = require('assert');

const _tsNodeService = require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    jsx: 'react-jsx',
    jsxImportSource: 'preact',
  },
});

const { h, render } = require('preact');
const ManualEditorIsland = require(
  '../../src/islands/ManualEditorIsland.tsx'
).default;


describe('ManualEditorIsland - responds to page-level events', function () {
  let dom, document, window;

  beforeEach(() => {
    dom = new JSDOM(`<!doctype html><html><body></body></html>`);
    window = dom.window;
    document = window.document;
    global.document = document;
    global.window = window;
    global.fetch = async () => ({
      ok: false,
      status: 503,
      json: async () => ({})
    });
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
    delete global.fetch;
  });

  it('updates metadata when manual:metadata-updated is dispatched', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(ManualEditorIsland, { documentId: 123 }), root);

    const titleInput = root.querySelector('[data-testid="manual-title-input"]');
    assert.ok(titleInput, 'title input should exist');

    // allow island mount & effects to run
    await new Promise((r) => setTimeout(r, 70));

    // Add test-level listener to ensure event dispatch works
    let seenMeta = false;
    const testListener = () => { seenMeta = true; };
    window.addEventListener('manual:metadata-updated', testListener);

    // Fire event after listeners are bound
    window.dispatchEvent(new window.CustomEvent('manual:metadata-updated', {
      detail: {
        title: 'Injected Title',
        content: 'Injected Content',
        documentType: 'Invoice',
      },
    }));

    // allow Preact to process state updates
    await new Promise((r) => setTimeout(r, 80));

    console.log('[unit-debug] seenMeta ->', seenMeta);
    window.removeEventListener('manual:metadata-updated', testListener);

    const contentInput = root.querySelector('[data-testid="manual-content-input"]');
    const doctypeInput = root.querySelector('[data-testid="manual-doctype-input"]');
    assert.ok(contentInput);
    assert.ok(doctypeInput, 'document type input should exist');
    assert.strictEqual(String(titleInput.value).trim(), 'Injected Title');
    assert.strictEqual(String(contentInput.value).trim(), 'Injected Content');
    assert.strictEqual(String(doctypeInput.value).trim(), 'Invoice');
  });

  it('updates fields when manual:fields-updated is dispatched', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(ManualEditorIsland, { documentId: 123 }), root);

    // allow island mount & effects to run
    await new Promise((r) => setTimeout(r, 70));

    // Dispatch fields after listeners are bound
    window.dispatchEvent(new window.CustomEvent('manual:fields-updated', { detail: { fields: [{ label: 'Inv No', value: 'INV-999', confidence: 0.9 }] } }));

    // allow Preact to process state updates
    await new Promise((r) => setTimeout(r, 80));

    const nameInput = root.querySelector('[data-testid="field-name-0"]');
    const valueInput = root.querySelector('[data-testid="field-value-0"]');
    assert.ok(nameInput, 'field name input should exist');
    assert.ok(valueInput, 'field value input should exist');
    assert.strictEqual(String(nameInput.value).trim(), 'Inv No');
    assert.strictEqual(String(valueInput.value).trim(), 'INV-999');
  });
});
