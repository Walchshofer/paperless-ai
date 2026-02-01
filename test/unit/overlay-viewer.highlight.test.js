
const assert = require('assert');
const { render, cleanup } = require('@testing-library/preact');
const { h } = require('preact');
const OverlayViewerIsland = require('../../src/islands/OverlayViewerIsland').default;

describe('OverlayViewerIsland - overlay:highlight-region handling', () => {
  afterEach(() => {
    try { cleanup(); } catch (e) {}
  });

  it('renders highlight region when event dispatched', async () => {
    const props = { documentId: 1, page: 1, overlayMode: 'document' };
    const { container: _container, queryByTestId } = render(h(OverlayViewerIsland, props));

    const bbox = { x: 0.15, y: 0.2, width: 0.1, height: 0.05 };
    window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page: 1 } }));

    // wait briefly for effect
    await new Promise((r) => setTimeout(r, 10));

    const highlight = queryByTestId('overlay-highlight-region');
    assert.ok(highlight, 'expected highlight region to be rendered');
  });
});
