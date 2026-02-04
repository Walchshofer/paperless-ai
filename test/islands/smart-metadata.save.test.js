const { JSDOM } = require('jsdom');
const assert = require('assert');

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', jsx: 'react-jsx', jsxImportSource: 'preact' }
});

const { h, render } = require('preact');
const SmartMetadataIsland = require('../../src/islands/SmartMetadataIsland.tsx').default;

async function waitForSelector(root, selector, attempts = 10, delayMs = 20) {
  for (let i = 0; i < attempts; i += 1) {
    const node = root.querySelector(selector);
    if (node) return node;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

describe('SmartMetadataIsland - participant save wiring', function () {
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

  it('acks save and emits partial-complete and clears dirty', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const profile = {
      domain: 'financial',
      requiredFields: [{ fieldId: 'invoice_number', label: 'Invoice No', paperlessField: 'custom_field:invoice_number' }],
      optionalFields: []
    };
    render(h(SmartMetadataIsland, {
      documentId: 42,
      fieldProfile: profile,
      customFields: [{ name: 'invoice_number', value: 'INV-1' }]
    }), root);

    // mark dirty
    const input = await waitForSelector(root, '[data-testid="required-field-value-invoice-number"]');
    assert.ok(input, 'value input exists');
    input.value = 'INV-2';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));

    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(window.__smart_metadata_dirty, true);

    let ack = null;
    let partial = null;

    window.addEventListener('workspace:save-ack', (e) => { ack = e.detail; });
    window.addEventListener('workspace:save-partial-complete', (e) => { partial = e.detail; });

    window.dispatchEvent(new window.CustomEvent('workspace:save-request', { detail: { documentId: 42, saveId: 's-1' } }));

    // wait for ack and partial to be processed
    await new Promise((r) => setTimeout(r, 200));

    assert.ok(ack, 'ack should be emitted');
    assert.strictEqual(ack.participantId, 'smart-metadata');
    assert.strictEqual(ack.willSave, true);

    assert.ok(partial, 'partial-complete should be emitted');
    assert.strictEqual(partial.participantId, 'smart-metadata');
    assert.strictEqual(partial.success, true);

    assert.strictEqual(window.__smart_metadata_dirty, false, 'dirty cleared after save');
  });
});
