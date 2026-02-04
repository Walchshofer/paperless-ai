const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

describe('Workspace view server rendering', function() {
  it('embeds overlay-viewer-island data-props with document info', async function() {
    const tplPath = path.resolve(__dirname, '../../views/document-workspace.ejs');
    const tpl = fs.readFileSync(tplPath, 'utf8');

    const vm = {
      version: 'test',
      document: {
        id: 42,
        title: 'Test Doc',
        pageCount: 3,
        originalUrl: 'https://example.com/doc/42'
      },
      availableDocuments: [{ id: 42, title: 'Test Doc', original_filename: 'test.pdf' }],
      chat: {},
      visual: { fields: [], overlayCount: 0 },
      ui: { activeTab: 'metadata', sidebarCollapsed: false },
      user: { isAdmin: false }
    };

    const html = await ejs.render(tpl, { vm }, { async: true, filename: tplPath });

    const match = html.match(/<div[^>]*data-island="overlay-viewer-island"[^>]*data-props="([^"]+)"/);
    assert.ok(match, 'overlay-viewer-island anchor not found');

    const propsRaw = match[1];
    const decoded = propsRaw.replace(/(&quot;|&#34;)/g, '"');
    const props = JSON.parse(decoded);

    assert.strictEqual(props.documentId, 42);
    assert.strictEqual(props.pageCount, 3);
    assert.strictEqual(props.originalUrl, 'https://example.com/doc/42');
  });
});
