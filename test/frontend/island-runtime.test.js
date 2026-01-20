const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { JSDOM } = require('jsdom');

describe('Island runtime (browser build)', function(){
  it('mounts playground-island from built dist file', async function(){
    const runtimePath = path.join(__dirname, '..', '..', 'public', 'js', 'dist', 'island-runtime.js');

    const dom = new JSDOM(`<!doctype html><html><head></head><body>
      <div data-island="playground-island" data-props='{"collection":"visual_pages","gpuState":"idle"}'></div>
    </body></html>`, { runScripts: 'dangerously', resources: 'usable' });

    const originalGlobals = {
      window: global.window,
      document: global.document,
      navigator: global.navigator,
      HTMLElement: global.HTMLElement
    };
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    global.HTMLElement = dom.window.HTMLElement;

    try {
      if (!fs.existsSync(runtimePath)) {
        assert.fail(`Runtime file missing: ${runtimePath}`);
      }

      const runtimeModule = await import(pathToFileURL(runtimePath).href);
      const mountIslands = runtimeModule.mountIslands ||
        dom.window.mountIslands ||
        dom.window.islandRuntime?.mountIslands;
      if (typeof mountIslands !== 'function') {
        assert.fail('mountIslands not available');
      }
      mountIslands(dom.window.document);
    } finally {
      await new Promise(resolve => setTimeout(resolve, 0));
      global.window = originalGlobals.window;
      global.document = originalGlobals.document;
      global.navigator = originalGlobals.navigator;
      global.HTMLElement = originalGlobals.HTMLElement;
    }

    const root = dom.window.document.querySelector('[data-testid="playground-island-root"]');
    assert.ok(root, 'playground island root should be mounted');
    assert.ok(root.textContent.includes('Visual RAG Playground'), 'root should contain playground title');
  });
});
