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
    anchor.setAttribute('data-props', JSON.stringify({ documentId: '123', page: 1 }));

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
    // invalid annotations type (should be array, not string)
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 123, annotations: 'not-an-array' }));

    document.body.appendChild(anchor);

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="visual-annotation-island-root"]');
    assert.strictEqual(root, null, 'Expected island NOT to render with invalid props');
    assert.ok(warnings.length > 0, 'Expected console.warn to be called for invalid props');

    console.warn = oldWarn;
  });

  it('mounts with numeric documentId (paperless-ngx compatibility)', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'visual-annotation-island');
    anchor.setAttribute('data-testid', 'visual-annotation-island');
    // numeric documentId should now be valid (paperless-ngx uses integers)
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 123, page: 1 }));

    document.body.appendChild(anchor);

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="visual-annotation-island-root"]');
    assert.ok(root, 'Expected visual annotation island to mount with numeric documentId');
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

  it('allows drawing a box and emits normalized annotations on save', (done) => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'visual-annotation-island');
    anchor.setAttribute('data-testid', 'visual-annotation-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 'doc-42', page: 1 }));

    document.body.appendChild(anchor);

    // set up a reasonable bounding box for the canvas since JSDOM doesn't layout
    mountIslands(document);

    const root = anchor.querySelector('[data-testid="visual-annotation-island-root"]');
    assert.ok(root, 'Expected root to be present');
    const canvas = root.querySelector('[data-testid="annotation-canvas"]');
    const drawToggle = root.querySelector('[data-testid="draw-toggle"]');
    const saveBtn = root.querySelector('[data-testid="save-annotations"]');
    const overlay = root.querySelector('[data-testid="annotation-overlay"]');

    // stub getBoundingClientRect for deterministic coords
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });

    // Listen for payload
    const listener = (e) => {
      try {
        const payload = e.detail;
        assert.strictEqual(payload.documentId, 'doc-42');
        assert.strictEqual(payload.page, 1);
        assert.strictEqual(payload.annotations.length, 1);
        const a = payload.annotations[0];
        // expected normalized values: start (40,20) end (140,120) -> left=40 top=20 width=100 height=100
        assert.ok(Math.abs(a.x - 0.1) < 0.01, `x normalized expected ~0.1 but got ${a.x}`);
        assert.ok(Math.abs(a.y - 0.1) < 0.01, `y normalized expected ~0.1 but got ${a.y}`);
        assert.ok(Math.abs(a.width - 0.25) < 0.01, `width normalized expected ~0.25 but got ${a.width}`);
        assert.ok(Math.abs(a.height - 0.5) < 0.01, `height normalized expected ~0.5 but got ${a.height}`);
        document.removeEventListener('payload:ready', listener);
        done();
      } catch (err) { document.removeEventListener('payload:ready', listener); done(err); }
    };
    document.addEventListener('payload:ready', listener);

    // Enable drawing
    drawToggle.click();

    // Simulate user drawing (mousedown -> mousemove -> mouseup)
    const down = new window.MouseEvent('mousedown', { clientX: 40, clientY: 20, bubbles: true });
    canvas.dispatchEvent(down);
    const move = new window.MouseEvent('mousemove', { clientX: 140, clientY: 120, bubbles: true });
    canvas.dispatchEvent(move);
    const up = new window.MouseEvent('mouseup', { clientX: 140, clientY: 120, bubbles: true });
    canvas.dispatchEvent(up);

    // click save to emit payload
    saveBtn.click();
  });

  it('confirming an annotation posts to API and dispatches feedback:confirmed', (done) => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'visual-annotation-island');
    anchor.setAttribute('data-testid', 'visual-annotation-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 'doc-42', page: 1 }));

    document.body.appendChild(anchor);

    // stub fetch to observe API calls
    const calls = [];
    const origFetch = global.fetch;
    global.fetch = async (url, opts = {}) => {
      calls.push({ url, opts });
      // health check
      if (url.endsWith('/health')) return { ok: true, status: 200, json: async () => ({}) };
      // feedback endpoint
      if (url.endsWith('/feedback')) return { ok: true, status: 200, json: async () => ({ success: true }) };
      return { ok: true, status: 200, json: async () => ({}) };
    };

    mountIslands(document);

    const root = anchor.querySelector('[data-testid="visual-annotation-island-root"]');
    const canvas = root.querySelector('[data-testid="annotation-canvas"]');

    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });

    // Enable drawing
    const drawToggle = root.querySelector('[data-testid="draw-toggle"]');
    drawToggle.click();

    // Simulate drawing
    canvas.dispatchEvent(new window.MouseEvent('mousedown', { clientX: 40, clientY: 20, bubbles: true }));
    canvas.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 140, clientY: 120, bubbles: true }));
    canvas.dispatchEvent(new window.MouseEvent('mouseup', { clientX: 140, clientY: 120, bubbles: true }));

    // Fill in label and note inputs and trigger input events to update state
    const label = root.querySelector('[data-testid="annotation-label-0"]');
    const note = root.querySelector('[data-testid="annotation-note-0"]');
    label.value = 'Invoice';
    label.dispatchEvent(new window.Event('input', { bubbles: true }));
    note.value = 'Matches OCR';
    note.dispatchEvent(new window.Event('input', { bubbles: true }));

    // Listen for feedback:confirmed event
    function onConfirmed(e) {
      try {
        document.removeEventListener('feedback:confirmed', onConfirmed);
        // Ensure API was called
        const fbCall = calls.find(c => c.url && c.url.endsWith('/feedback'));
        assert.ok(fbCall, 'expected fetch to /api/visual-rag/feedback');
        const body = JSON.parse(fbCall.opts.body);

        // Verify new payload structure: { documentId, events: [{ event_type, field_name, ... }] }
        assert.ok(body.documentId !== undefined, 'documentId should be present');
        assert.ok(Array.isArray(body.events), 'events should be an array');
        assert.strictEqual(body.events.length, 1, 'expected exactly one event');
        assert.strictEqual(body.events[0].event_type, 'annotation', 'event_type should be annotation');
        assert.strictEqual(body.events[0].field_name, 'Invoice', 'field_name should match label');
        assert.ok(body.events[0].corrected_value, 'corrected_value should be present');
        assert.strictEqual(body.events[0].corrected_value.label, 'Invoice');
        assert.ok(body.events[0].context, 'context should be present');
        assert.ok(Array.isArray(body.events[0].context.bbox), 'bbox should be an array in context');

        // Confirm the event detail matches the annotation object
        const d = e.detail;
        assert.strictEqual(d.label, 'Invoice');
        assert.strictEqual(d.note, 'Matches OCR');
        assert.ok(Array.isArray(d.bbox), 'event detail should include bbox array');

        // restore fetch
        global.fetch = origFetch;
        done();
      } catch (err) { global.fetch = origFetch; done(err); }
    }

    document.addEventListener('feedback:confirmed', onConfirmed);

    // Give Preact a tick to flush updates, then click Confirm Match
    setTimeout(() => {
      const item = root.querySelector('[data-testid="annotation-item"]');
      const confirmBtn = item && Array.from(item.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Confirm'));
      assert.ok(confirmBtn, 'expected confirm button');
      confirmBtn.click();
    }, 0);
  });

  it('responds to annotations:loaded events and populates saved annotations', (done) => {
    const saved = [{ id: 'uuid-saved', document_id: 42, page: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.2, label: 'Saved', note: 'note' }];

    const anchor = document.createElement('div');
    anchor.setAttribute('data-island', 'visual-annotation-island');
    anchor.setAttribute('data-testid', 'visual-annotation-island');
    anchor.setAttribute('data-props', JSON.stringify({ documentId: 'doc-42', page: 1, annotations: saved }));

    document.body.appendChild(anchor);
    mountIslands(document);

    const root = anchor.querySelector('[data-testid="visual-annotation-island-root"]');
    assert.ok(root, 'Expected root to be present');

    setTimeout(() => {
      try {
        const item = root.querySelector('[data-testid="annotation-item"]');
        // debug: uncomment to inspect
        // console.log('ROOT HTML:\n', root.innerHTML);
        assert.ok(item, 'Expected an annotation item to be rendered');
        const label = root.querySelector('[data-testid="annotation-label-0"]');
        assert.strictEqual(label.value, 'Saved');
        // Confirmed boxes should be rendered with confirmed class
        const box = root.querySelector('[data-testid="annotation-box-0"]');
        assert.ok(box.className.includes('vai-box-confirmed'));
        done();
      } catch (err) { done(err); }
    }, 50);
  });
});
