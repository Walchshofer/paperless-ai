const { JSDOM } = require('jsdom');
const assert = require('assert');

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', jsx: 'react-jsx', jsxImportSource: 'preact' }
});

const { h, render } = require('preact');
const VisualAnnotationIsland = require('../../src/islands/VisualAnnotationIsland.tsx').default;

describe('VisualAnnotationIsland - participant save wiring', function () {
  let dom, document, window;

  beforeEach(() => {
    dom = new JSDOM(`<!doctype html><html><body></body></html>`);
    window = dom.window;
    document = window.document;
    global.document = document;
    global.window = window;

    // stub fetch to simulate backend
    global.fetch = async (_url, _opts) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ created: [{ id: 1, bbox: { x: 0, y: 0, width: 0.1, height: 0.1 } }] })
      };
    }; 
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
    delete global.fetch;
  });

  it('acks save and emits partial-complete on success', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const anns = [{ bbox: { x: 0, y: 0, width: 0.1, height: 0.1 } }];
    render(h(VisualAnnotationIsland, { documentId: 42, annotations: anns }), root);

    await new Promise((r) => setTimeout(r, 50));

    let ack = null;
    let partial = null;

    window.addEventListener('workspace:save-ack', (e) => { ack = e.detail; });
    window.addEventListener('workspace:save-partial-complete', (e) => { partial = e.detail; });

    window.dispatchEvent(new window.CustomEvent('workspace:save-request', { detail: { documentId: 42, saveId: 's-2' } }));

    // give time for save to complete
    await new Promise((r) => setTimeout(r, 300));

    assert.ok(ack, 'ack emitted');
    assert.strictEqual(ack.participantId, 'visual-annotation');
    assert.strictEqual(ack.willSave, true);

    assert.ok(partial, 'partial emitted');
    assert.strictEqual(partial.participantId, 'visual-annotation');
    assert.strictEqual(partial.success, true);
  });
});