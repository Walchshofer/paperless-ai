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

  it('prefills metadata date from AI-mapped metadata:document_date field', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const profile = {
      domain: 'financial',
      requiredFields: [{ fieldId: 'invoice_date', label: 'Invoice Date', paperlessField: 'metadata:document_date' }],
      optionalFields: []
    };
    const visualFields = [
      {
        id: 'overlay-date',
        label: 'Invoice Date',
        value: '13.01.2025',
        paperlessMapping: 'metadata:document_date'
      }
    ];

    render(h(SmartMetadataIsland, {
      documentId: 42,
      fieldProfile: profile,
      metadata: { title: 'Doc', correspondent: 'ACME', createdDate: '' },
      visualFields
    }), root);

    const dateInput = await waitForSelector(root, '[data-testid="smart-date-input"]');
    assert.ok(dateInput, 'date input should render');
    await new Promise((r) => setTimeout(r, 30));
    assert.strictEqual(dateInput.value, '2025-01-13');
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

  it('triggers reprocess request and renders progress overlay updates', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(h(SmartMetadataIsland, { documentId: 42 }), root);

    const reprocessBtn = await waitForSelector(root, '[data-testid="reprocess-metadata-btn"]');
    assert.ok(reprocessBtn, 'metadata reprocess button exists');

    let requestDetail = null;
    window.addEventListener('workspace:reprocess-request', (e) => {
      requestDetail = e.detail;
    });

    reprocessBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));

    assert.deepStrictEqual(requestDetail, { documentId: 42 });
    const overlay = root.querySelector('[data-testid="reprocess-progress-overlay"]');
    assert.ok(overlay, 'overlay should appear after request');

    window.dispatchEvent(new window.CustomEvent('workspace:reprocess-progress', {
      detail: {
        documentId: 42,
        stage: 'visual_extraction',
        label: 'Visual extraction',
        status: 'in_progress',
        percentage: 60
      }
    }));
    await new Promise((r) => setTimeout(r, 30));

    const percent = root.querySelector('[data-testid="reprocess-progress-percent"]');
    assert.ok(percent && percent.textContent && percent.textContent.includes('60%'));

    window.dispatchEvent(new window.CustomEvent('workspace:reprocess-complete', {
      detail: { documentId: 42 }
    }));
    await new Promise((r) => setTimeout(r, 30));

    assert.strictEqual(reprocessBtn.textContent.includes('Reprocessing...'), false);
  });

  it('renders user-friendly failed progress messages', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(h(SmartMetadataIsland, { documentId: 42 }), root);
    const reprocessBtn = await waitForSelector(
      root,
      '[data-testid="reprocess-metadata-btn"]'
    );
    assert.ok(reprocessBtn, 'metadata reprocess button exists');

    reprocessBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));

    const userMessage = (
      'Vector search is temporarily unavailable because the circuit '
      + 'breaker is open. Please try again later.'
    );
    window.dispatchEvent(new window.CustomEvent('workspace:reprocess-progress', {
      detail: {
        documentId: 42,
        stage: 'failed',
        status: 'failed',
        percentage: 100,
        details: { userMessage }
      }
    }));
    await new Promise((r) => setTimeout(r, 30));

    const label = root.querySelector('[data-testid="reprocess-progress-label"]');
    assert.ok(label, 'progress label is rendered');
    assert.ok(label.textContent.includes('Vector search is temporarily'));
  });
});
