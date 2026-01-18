const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Island runtime (browser build)', function(){
  it('mounts playground-island from built dist file', async function(){
    const runtimePath = path.join(__dirname, '..', '..', 'public', 'js', 'dist', 'island-runtime.js');
    const code = fs.readFileSync(runtimePath, 'utf8');

    const dom = new JSDOM(`<!doctype html><html><head></head><body>
      <div data-island="playground-island" data-props='{"collection":"visual_pages","gpuState":"idle"}'></div>
    </body></html>`, { runScripts: 'dangerously', resources: 'usable' });

    // Evaluate the runtime inside the JSDOM window
    dom.window.eval(code);

    // mount
    if (typeof dom.window.mountIslands === 'function') {
      dom.window.mountIslands(dom.window.document);
    } else if (dom.window.islandRuntime && typeof dom.window.islandRuntime.mountIslands === 'function') {
      dom.window.islandRuntime.mountIslands(dom.window.document);
    } else {
      assert.fail('mountIslands not available on window');
    }

    const root = dom.window.document.querySelector('[data-testid="playground-island-root"]');
    assert.ok(root, 'playground island root should be mounted');
    assert.ok(root.textContent.includes('Visual RAG Playground'), 'root should contain playground title');
  });
});