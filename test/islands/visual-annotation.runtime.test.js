const { JSDOM } = require('jsdom');
const assert = require('assert');

const { mountIslands } = require('../../src/islands/runtime');

describe('island runtime - Visual Annotation', function () {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    dom = new JSDOM(`<!doctype html><html><body></body></html>`);
    window = dom.window;
    document = window.document;
    // Expose globals expected by mountIslands (document)
    global.document = document;
    global.window = window;
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
  });

  it('mounts visual annotation island with valid props', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'visual-annotation-island');
    anchor.setAttribute('data-testid', 'visual-annotation-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 123, page: 1 }));

    document.body.appendChild(anchor);

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="visual-annotation-island-root"]');
    assert.ok(root, 'Expected visual annotation island root to be rendered');
  });

  it('does not mount when props are invalid and warns', () => {
    const warnings = [];
    const oldWarn = console.warn;
    console.warn = (...args) => warnings.push(args);

    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'visual-annotation-island');
    anchor.setAttribute('data-testid', 'visual-annotation-island');
    // invalid documentId type (string instead of number)
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 'not-a-number' }));

    document.body.appendChild(anchor);

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="visual-annotation-island-root"]');
    assert.strictEqual(root, null, 'Expected island NOT to render with invalid props');
    assert.ok(warnings.length > 0, 'Expected console.warn to be called for invalid props');

    console.warn = oldWarn;
  });

  it('skips mount and warns when data-props is malformed JSON', () => {
    const warnings = [];
    const oldWarn = console.warn;
    console.warn = (...args) => warnings.push(args);

    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'visual-annotation-island');
    anchor.setAttribute('data-testid', 'visual-annotation-island');
    // malformed JSON
    anchor.setAttribute('data-props', '{ invalid json }');

    document.body.appendChild(anchor);

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="visual-annotation-island-root"]');
    assert.strictEqual(root, null, 'Expected island NOT to render when props JSON malformed');
    assert.ok(warnings.length > 0, 'Expected console.warn to be called for parse error');

    console.warn = oldWarn;
  });
});
