const { JSDOM } = require('jsdom');
const { mountIslands } = require('../src/islands/runtime');

(async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`);
  const { window } = dom;
  const { document } = window;
  global.window = window;
  global.document = document;

  const anchor = document.createElement('div');
  anchor.setAttribute('data-island', 'overlay-viewer-island');
  anchor.setAttribute('data-testid', 'overlay-viewer-island');
  anchor.setAttribute('data-props', JSON.stringify({ documentId: 123 }));
  document.body.appendChild(anchor);

  mountIslands(document);

  const draw = anchor.querySelector('[data-testid="red-pen-toggle"]');
  const pan = anchor.querySelector('[data-testid="overlay-pan-toggle"]');
  console.log('draw exists?', !!draw, 'pan exists?', !!pan);
  if (draw) console.log('draw aria-pressed:', draw.getAttribute('aria-pressed'), 'text:', draw.textContent);
  if (pan) console.log('pan aria-pressed:', pan.getAttribute('aria-pressed'));

  if (draw) {
    draw.click();
    console.log('after click draw aria-pressed:', draw.getAttribute('aria-pressed'), 'text:', draw.textContent);
    draw.click();
    console.log('after click2 draw aria-pressed:', draw.getAttribute('aria-pressed'));
  }

  if (pan) {
    pan.click();
    console.log('after click pan aria-pressed:', pan.getAttribute('aria-pressed'));
  }

  delete global.window;
  delete global.document;
})();