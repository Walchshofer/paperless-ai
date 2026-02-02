const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

describe('Manual view server rendering with images', function() {
  it('embeds images and overlaysByImage into overlay-viewer-island data-props', async function() {
    const tplPath = path.resolve(__dirname, '../../views/manual.ejs');
    const tpl = fs.readFileSync(tplPath, 'utf8');

    const vm = {
      manual: {
        documentId: 42,
        images: [{ id: 'img-1', originalSrc: 'https://example.com/1.png', width: 600, height: 400 }],
        overlaysByImage: { 'img-1': [{ id: 'ov-1', bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, label: 'test' }] }
      },
      version: 'test'
    };

    const html = await ejs.render(tpl, { vm }, { async: true, filename: tplPath });

    const match = html.match(/<div[^>]*data-island="overlay-viewer-island"[^>]*data-props="([^"]+)"/);
    assert.ok(match, 'overlay-viewer-island anchor not found');

    const propsRaw = match[1];
    // EJS JSON.stringify will produce double quotes escaped as HTML entities in attribute; convert back
    // Support both named (&quot;) and numeric (&#34;) quote entities that may appear in different environments.
    const decoded = propsRaw.replace(/(&quot;|&#34;)/g, '"');
    const props = JSON.parse(decoded);

    assert.ok(Array.isArray(props.images), 'images not present in data-props');
    assert.strictEqual(props.images[0].id, 'img-1');
    assert.ok(props.overlaysByImage && props.overlaysByImage['img-1'], 'overlaysByImage not present');
  });
});