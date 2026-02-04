const { JSDOM } = require('jsdom');
const assert = require('assert');

require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: 'CommonJS',
    jsx: 'react-jsx',
    jsxImportSource: 'preact',
    moduleResolution: 'node',
    allowSyntheticDefaultImports: true,
    esModuleInterop: true
  }
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

describe('SmartMetadataIsland - basic interactions', function () {
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

  it('renders required fields and emits metadata:locate-field when locate clicked', async () => {
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

    const locateBtn = await waitForSelector(root, '[data-testid="locate-required-invoice-number"]');
    assert.ok(locateBtn, 'locate button should exist');

    let seen = null;
    window.addEventListener('metadata:locate-field', (e) => { seen = e.detail; });

    locateBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));

    assert.deepStrictEqual(seen, { fieldId: 'custom_field:invoice_number' });
  });

  it('emits feedback:vote when thumbs up/down clicked', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const profile = { domain: 'general', requiredFields: [], optionalFields: [] };
    const visualFields = [{ id: 'v1', label: 'Signature', value: 'Signed' }];
    render(h(SmartMetadataIsland, { documentId: 42, fieldProfile: profile, visualFields }), root);
    let seen = [];
    window.addEventListener('feedback:vote', (e) => { seen.push(e.detail); });

    const up = await waitForSelector(root, '[data-testid="feedback-up-v1"]');
    const down = await waitForSelector(root, '[data-testid="feedback-down-v1"]');
    assert.ok(up && down, 'feedback buttons present');

    up.dispatchEvent(new window.Event('click', { bubbles: true }));
    down.dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(seen.length, 2);
    assert.deepStrictEqual(seen[0], { fieldId: 'v1', vote: 'up' });
    assert.deepStrictEqual(seen[1], { fieldId: 'v1', vote: 'down' });
  });

  it('marks workspace dirty when input changed', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const profile = {
      domain: 'financial',
      requiredFields: [{ fieldId: 'invoice_number', label: 'Invoice No', paperlessField: 'custom_field:invoice_number' }],
      optionalFields: []
    };
    render(h(SmartMetadataIsland, { documentId: 42, fieldProfile: profile }), root);
    let seen = null;
    window.addEventListener('workspace:dirty', (e) => { seen = e.detail; });

    const input = await waitForSelector(root, '[data-testid="required-field-value-invoice-number"]');
    assert.ok(input, 'value input exists');

    input.value = 'USD';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));

    await new Promise((r) => setTimeout(r, 60));

    assert.ok(window.__smart_metadata_dirty === true, 'test flag set');
    assert.deepStrictEqual(seen, { documentId: 42 });
  });

  it('emits tags:updated with tag IDs when adding/removing tags', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const selectedTags = [{ id: 1, name: 'Finance', color: '#ffcc00' }];
    const availableTags = [
      { id: 1, name: 'Finance', color: '#ffcc00' },
      { id: 2, name: 'Urgent', color: '#ff0000' }
    ];

    render(h(SmartMetadataIsland, {
      documentId: 42,
      selectedTags,
      availableTags
    }), root);

    const seen = [];
    window.addEventListener('tags:updated', (e) => { seen.push(e.detail); });

    const select = await waitForSelector(root, '[data-testid="add-tag-select"]');
    assert.ok(select, 'tag select exists');

    select.value = '2';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    assert.ok(seen.length >= 1, 'tag add should emit event');
    assert.ok(seen[seen.length - 1].tags.some((t) => t.id === 2), 'new tag id should be included');

    const removeBtn = await waitForSelector(root, '[data-testid="tag-remove-1"]');
    assert.ok(removeBtn, 'remove button exists');
    removeBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    assert.ok(seen.length >= 2, 'tag remove should emit event');
    assert.ok(!seen[seen.length - 1].tags.some((t) => t.id === 1), 'removed tag id should be absent');
  });
});
