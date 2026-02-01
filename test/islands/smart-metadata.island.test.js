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

  it('renders custom fields and emits metadata:locate-field when locate clicked', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const fields = [{ id: 'f1', label: 'Invoice No', value: 'INV-1', overlayId: 'ov-1', pageNumber: 1 }];

    render(h(SmartMetadataIsland, { documentId: 42, customFields: fields }), root);

    await new Promise((r) => setTimeout(r, 20));

    const locateBtn = root.querySelector('[data-testid="locate-btn-f1"]');
    assert.ok(locateBtn, 'locate button should exist');

    let seen = null;
    window.addEventListener('metadata:locate-field', (e) => { seen = e.detail; });

    locateBtn.click();
    await new Promise((r) => setTimeout(r, 10));

    assert.deepStrictEqual(seen, { fieldId: 'f1' });
  });

  it('emits feedback:vote when thumbs up/down clicked', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const fields = [{ id: 'f2', label: 'Total', value: '100.00' }];
    render(h(SmartMetadataIsland, { documentId: 42, customFields: fields }), root);
    await new Promise((r) => setTimeout(r, 20));

    let seen = [];
    window.addEventListener('feedback:vote', (e) => { seen.push(e.detail); });

    const up = root.querySelector('[data-testid="feedback-up-f2"]');
    const down = root.querySelector('[data-testid="feedback-down-f2"]');
    assert.ok(up && down, 'feedback buttons present');

    up.click();
    down.click();
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(seen.length, 2);
    assert.deepStrictEqual(seen[0], { fieldId: 'f2', vote: 'up' });
    assert.deepStrictEqual(seen[1], { fieldId: 'f2', vote: 'down' });
  });

  it('marks workspace dirty when input changed', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const fields = [{ id: 'f3', label: 'Currency', value: 'EUR' }];
    render(h(SmartMetadataIsland, { documentId: 42, customFields: fields }), root);
    await new Promise((r) => setTimeout(r, 20));

    let seen = null;
    window.addEventListener('workspace:dirty', (e) => { seen = e.detail; });

    const input = root.querySelector('[data-testid="custom-field-value-f3"]');
    assert.ok(input, 'value input exists');

    input.value = 'USD';
    input.dispatchEvent(new window.Event('input'));

    await new Promise((r) => setTimeout(r, 20));

    assert.ok(window.__smart_metadata_dirty === true, 'test flag set');
    assert.deepStrictEqual(seen, { documentId: 42 });
  });
});
