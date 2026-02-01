const assert = require('assert');
const { isDocumentDirty, confirmAndNavigate } = require('../../src/lib/navigation-guard');

describe('navigation-guard helper', () => {
  beforeEach(() => {
    global.window = global.window || {};
    global.window.__workspaceState = {};
    global.window.location = { href: '' };

    // Minimal event target polyfill for test environment
    global.window._listeners = {};
    global.window.addEventListener = function (name, fn) {
      this._listeners[name] = this._listeners[name] || [];
      this._listeners[name].push(fn);
    };
    global.window.removeEventListener = function (name, fn) {
      if (!this._listeners[name]) return;
      this._listeners[name] = this._listeners[name].filter((f) => f !== fn);
    };
    global.window.dispatchEvent = function (evt) {
      const l = this._listeners[evt.type] || [];
      l.forEach((fn) => { try { fn(evt); } catch (err) { /* ignore */ } });
      return l.length > 0;
    };
  });

  afterEach(() => {
    delete global.window.__workspaceState;
    // Clean up polyfill
    delete global.window._listeners;
    delete global.window.addEventListener;
    delete global.window.removeEventListener;
    delete global.window.dispatchEvent;
    // leave global.window
  });

  it('isDocumentDirty returns true when state is dirty', () => {
    global.window.__workspaceState['42'] = { isDirty: true };
    assert.strictEqual(isDocumentDirty(42), true);
  });

  it('isDocumentDirty returns false when clean', () => {
    global.window.__workspaceState['42'] = { isDirty: false };
    assert.strictEqual(isDocumentDirty(42), false);
  });

  it('confirmAndNavigate dispatches navigation:request when dirty', (done) => {
    global.window.__workspaceState['42'] = { isDirty: true };
    // Listen for navigation:request
    function onReq(e) {
      try {
        assert.strictEqual(e.detail.href, '/document/2');
        assert.strictEqual(e.detail.docId, 42);
        done();
      } finally {
        global.window.removeEventListener('navigation:request', onReq);
      }
    }
    global.window.addEventListener('navigation:request', onReq);

    const result = confirmAndNavigate('/document/2', 42);
    assert.strictEqual(result, false);
  });

  it('confirmAndNavigate navigates when not dirty', () => {
    global.window.__workspaceState['42'] = { isDirty: false };
    // No confirm should be called, but set it to fail if called
    global.window.confirm = () => { throw new Error('confirm should not be called'); };
    const result = confirmAndNavigate('/document/3', 42);
    assert.strictEqual(result, true);
    assert.strictEqual(global.window.location.href, '/document/3');
  });

  it('confirmAndNavigate navigates when not dirty', () => {
    global.window.__workspaceState['42'] = { isDirty: false };
    // No confirm should be called, but set it to fail if called
    global.window.confirm = () => { throw new Error('confirm should not be called'); };
    const result = confirmAndNavigate('/document/3', 42);
    assert.strictEqual(result, true);
    assert.strictEqual(global.window.location.href, '/document/3');
  });
});