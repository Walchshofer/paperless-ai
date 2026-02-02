const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

(async () => {
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
  console.log('--- Full island fragment (excerpt) ---');
  const match = html.match(/<div[^>]*data-island="overlay-viewer-island"[^>]*data-props="([^"]+)"/);
  if (!match) {
    console.error('overlay-viewer-island anchor not found');
    process.exit(1);
  }
  const propsRaw = match[1];
  console.log('Raw attribute value:');
  console.log(propsRaw);
  console.log('\nDecoded by simple replace (propsRaw.replace(/\\&quot;/g, ' + "'\"'" + '))');
  const decoded = propsRaw.replace(/\\&quot;/g, '"');
  console.log(decoded);
  console.log('\nAttempt JSON.parse...');
  try {
    const parsed = JSON.parse(decoded);
    console.log('Parsed OK:', parsed);
  } catch (err) {
    console.error('JSON.parse failed:', err.message);
    // Print char codes for first 40 chars
    const chars = decoded.slice(0, 80).split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' ');
    console.log('Decoded prefix chars:', chars);
  }
})();