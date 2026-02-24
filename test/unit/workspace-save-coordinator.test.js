const assert = require('assert');
const { startCoordinator } = require('../../src/lib/workspace-save-coordinator');

describe('workspace-save-coordinator', () => {
  let coord;
  beforeEach(() => {
    // minimal event polyfill
    global.window = global.window || {};
    global.window._listeners = {};
    global.window.addEventListener = function (name, fn) { this._listeners[name] = this._listeners[name] || []; this._listeners[name].push(fn); };
    global.window.removeEventListener = function (name, fn) { if (!this._listeners[name]) return; this._listeners[name] = this._listeners[name].filter((f) => f !== fn); };
    global.window.dispatchEvent = function (evt) { const l = this._listeners[evt.type] || []; l.forEach((fn) => { try { fn(evt); } catch (err) {} }); return l.length > 0; };

    global.window.__workspaceState = {};
    coord = startCoordinator({ ackTimeoutMs: 10, saveTimeoutMs: 200 });
  });

  afterEach(() => {
    if (coord && typeof coord.stop === 'function') coord.stop();
    delete global.window.__workspaceState;
    delete global.window._listeners;
    delete global.window.addEventListener;
    delete global.window.removeEventListener;
    delete global.window.dispatchEvent;
  });

  it('completes successfully when participants ack and complete', (done) => {
    let finished = false;
    const finish = (err) => {
      if (finished) return;
      finished = true;
      done(err);
    };

    // Listen for save-begin and then send ack/partial completes
    let saved = false;
    window.addEventListener('workspace:save-begin', function onBegin(e) {
      // participant ack
      window.dispatchEvent(new CustomEvent('workspace:save-ack', { detail: { saveId: e.detail.saveId, participantId: 'p1', willSave: true } }));
      // after small delay send partial complete
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('workspace:save-partial-complete', { detail: { saveId: e.detail.saveId, participantId: 'p1', success: true } }));
      }, 10);
    });

    window.addEventListener('workspace:save-complete', function onComplete(_e) {
      saved = true;
      assert.ok(saved);
    });

    window.addEventListener('sync:success', function onSynced(e) {
      try {
        assert.ok(saved);
        const key = String(e.detail.documentId);
        assert.strictEqual(window.__workspaceState[key]?.isDirty, false);
        finish();
      } catch (err) {
        finish(err);
      }
    });

    // mark doc dirty
    window.__workspaceState['100'] = { isDirty: true };
    // request save
    window.dispatchEvent(new CustomEvent('workspace:save-request', { detail: { documentId: 100 } }));
  });

  it('fails when no participants and timeout', (done) => {
    window.addEventListener('workspace:save-failed', function onFailed(e) {
      assert.ok(e.detail.errors && e.detail.errors.length > 0);
      done();
    });

    // mark doc dirty
    window.__workspaceState['101'] = { isDirty: true };
    window.dispatchEvent(new CustomEvent('workspace:save-request', { detail: { documentId: 101 } }));
  });
});
