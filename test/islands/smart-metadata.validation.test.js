const { JSDOM } = require('jsdom');
const assert = require('assert');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', jsx: 'react-jsx', jsxImportSource: 'preact' } });
const { h, render } = require('preact');
const SmartMetadataIsland = require('../../src/islands/SmartMetadataIsland.tsx').default;

describe('SmartMetadataIsland - validation', function () {
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

  it('does not mark workspace dirty when initial customFields fail Zod validation', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    // invalid field: missing id
    const fields = [{ id: null, label: 'Bad Field', value: 'X' }];

    render(h(SmartMetadataIsland, { documentId: 99, customFields: fields }), root);
    await new Promise((r) => setTimeout(r, 20));

    let seen = null;
    window.addEventListener('workspace:dirty', (e) => { seen = e.detail; });

    // attempt to change title; validation should fail because customFields invalid
    const input = root.querySelector('[data-testid="smart-title-input"]');
    input.value = 'New Title';
    input.dispatchEvent(new window.Event('input'));

    await new Promise((r) => setTimeout(r, 50));

    // should not have emitted workspace:dirty
    assert.strictEqual(seen, null);

    const err = root.querySelector('[data-testid="validation-error"]');
    assert.ok(err && err.textContent && err.textContent.length > 0, 'validation error visible');
  });
});
