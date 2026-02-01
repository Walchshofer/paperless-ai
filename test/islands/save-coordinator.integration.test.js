const assert = require('assert');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', jsx: 'react-jsx', jsxImportSource: 'preact' } });
const { h } = require('preact');
const { render } = require('@testing-library/preact');
const SaveCoordinatorIsland = require('../../src/islands/SaveCoordinatorIsland.tsx').default;

describe('SaveCoordinatorIsland integration', () => {
  beforeEach(() => {
    global.window = global.window || {};
    global.window._listeners = {};
    global.window.addEventListener = function (name, fn) { this._listeners[name] = this._listeners[name] || []; this._listeners[name].push(fn); };
    global.window.removeEventListener = function (name, fn) { if (!this._listeners[name]) return; this._listeners[name] = this._listeners[name].filter((f) => f !== fn); };
    global.window.dispatchEvent = function (evt) { const l = this._listeners[evt.type] || []; l.forEach((fn) => { try { fn(evt); } catch (err) {} }); return l.length > 0; };
    global.window.__workspaceState = {};
  });

  afterEach(() => {
    delete global.window.__workspaceState;
    delete global.window._listeners;
    delete global.window.addEventListener;
    delete global.window.removeEventListener;
    delete global.window.dispatchEvent;
  });

  it('renders overlay when saving begins', (done) => {
    const { container } = render(h(SaveCoordinatorIsland, { documentId: 200 }));

    window.addEventListener('workspace:save-begin', function onBegin(e) {
      // when begin happens the island should show overlay
      setTimeout(() => {
        const overlay = container.querySelector('[data-testid="save-coordinator-overlay"]');
        assert.ok(overlay, 'overlay should be present');
        done();
      }, 10);

      // ack and complete to finish quickly
      window.dispatchEvent(new CustomEvent('workspace:save-ack', { detail: { saveId: e.detail.saveId, participantId: 'p1', willSave: true } }));
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('workspace:save-partial-complete', { detail: { saveId: e.detail.saveId, participantId: 'p1', success: true } }));
      }, 20);
    });

    window.__workspaceState['200'] = { isDirty: true };
    window.dispatchEvent(new CustomEvent('workspace:save-request', { detail: { documentId: 200 } }));
  });
});