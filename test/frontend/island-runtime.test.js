const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Island runtime (browser build)', function(){
  it('mounts playground-island from built dist file', async function(){
    const runtimePath = path.join(__dirname, '..', '..', 'public', 'js', 'dist', 'island-runtime.js');

    // Provide a fake 2D context before any script runs so built islands that call
    // canvas APIs won't hit JSDOM's unimplemented stub error
    const fakeCtx = {
      getImageData: () => ({ data: new Uint8ClampedArray(0) }),
      putImageData: () => {},
      measureText: () => ({ width: 0 }),
      fillRect: () => {},
      clearRect: () => {},
      drawImage: () => {},
      beginPath: () => {},
      arc: () => {},
      fillText: () => {},
      getContextAttributes: () => ({})
    };

    const dom = new JSDOM(`<!doctype html><html><head></head><body>
      <div data-island="playground-island" data-props='{"collection":"visual_pages","gpuState":"idle"}'></div>
    </body></html>`, {
      runScripts: 'dangerously',
      resources: 'usable',
      beforeParse(window) {
        try {
          if (window && window.HTMLCanvasElement) {
            try {
              window.HTMLCanvasElement.prototype.getContext = function() { return fakeCtx; };
            } catch (assignErr) {
              Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
                value: function() { return fakeCtx; },
                configurable: true,
                writable: true
              });
            }
          }
        } catch (e) {
          console.warn('[test] Could not set canvas.getContext in beforeParse:', e && e.message);
        }
      }
    });

    // Stub canvas getContext (JSDOM does not implement canvas) to avoid test-time errors
    try {
      if (dom.window && dom.window.HTMLCanvasElement) {
        const fakeCtx = {
          getImageData: () => ({ data: new Uint8ClampedArray(0) }),
          putImageData: () => {},
          measureText: () => ({ width: 0 }),
          fillRect: () => {},
          clearRect: () => {},
          drawImage: () => {},
          beginPath: () => {},
          arc: () => {},
          fillText: () => {},
          getContextAttributes: () => ({})
        };
        try {
          dom.window.HTMLCanvasElement.prototype.getContext = function() { return fakeCtx; };
        } catch (assignErr) {
          Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'getContext', {
            value: function() { return fakeCtx; },
            configurable: true,
            writable: true
          });
        }
      }
    } catch (e) {
      console.warn('[test] Could not stub canvas.getContext:', e && e.message);
    }

    const originalGlobals = {
      window: global.window,
      document: global.document,
      navigator: global.navigator,
      HTMLElement: global.HTMLElement
    };
    global.window = dom.window;
    global.document = dom.window.document;
    // Some Node runtimes expose a read-only navigator; use defineProperty for compatibility
    try {
      Object.defineProperty(global, 'navigator', {
        value: dom.window.navigator,
        configurable: true,
        writable: true
      });
    } catch (e) {
      // Fallback to assignment if defineProperty isn't allowed
      try { global.navigator = dom.window.navigator; } catch (err) {
        console.warn('[test] Could not set global.navigator:', err && err.message);
      }
    }
    global.HTMLElement = dom.window.HTMLElement;

    try {
      if (!fs.existsSync(runtimePath)) {
        assert.fail(`Runtime file missing: ${runtimePath}`);
      }

      // Evaluate the built runtime in JSDOM, stripping ESM exports so it can
      // run under the CommonJS test runner even when ts-node is registered.
      let mountIslands = null;
      try {
        let code = fs.readFileSync(runtimePath, 'utf8');
        code = code
          .replace(/^\s*export\s+\{[^}]+\};?\s*$/gm, '')
          .replace(/^\s*export\s+default\s+/gm, '')
          .replace(/^\s*export\s+(const|function|class)\s+/gm, '$1 ');
        code +=
          '\n;window.__mountIslands = typeof mountIslands === "function" ? ' +
          'mountIslands : window.mountIslands;';
        dom.window.eval(code);
        mountIslands =
          dom.window.__mountIslands ||
          dom.window.mountIslands ||
          dom.window.islandRuntime?.mountIslands;
      } catch (err) {
        assert.fail(`Could not evaluate runtime: ${err.message}`);
      }
      if (typeof mountIslands !== 'function') {
        assert.fail('mountIslands not available');
      }
      mountIslands(dom.window.document);
    } finally {
      await new Promise(resolve => setTimeout(resolve, 0));
      global.window = originalGlobals.window;
      global.document = originalGlobals.document;
      // Restore navigator safely (may be a getter-only in some Node environments)
      try {
        if (originalGlobals.navigator === undefined) {
          try { delete global.navigator; } catch (e) { /* ignore */ }
        } else {
          Object.defineProperty(global, 'navigator', {
            value: originalGlobals.navigator,
            configurable: true,
            writable: true
          });
        }
      } catch (e) {
        try { global.navigator = originalGlobals.navigator; } catch (err) { /* ignore */ }
      }
      global.HTMLElement = originalGlobals.HTMLElement;
    }

    const root = dom.window.document.querySelector('[data-testid="playground-island-root"]');
    assert.ok(root, 'playground island root should be mounted');
    assert.ok(root.textContent.includes('Visual RAG Playground'), 'root should contain playground title');
  });
});
