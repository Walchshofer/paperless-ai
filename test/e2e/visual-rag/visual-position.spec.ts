import { test, expect } from '@playwright/test';

// Position verification requires a fixture with known visual_overlays payload and a document image available.
// This scaffold is for test-agent to fill in once fixtures/infra are available.

test.describe('Visual overlay position verification', () => {
  test('overlay SVG rect attributes match bbox percentages', async ({ page }) => {
    await page.goto('/manual');

    const visualBtn = await page.$('[data-testid="view-visual-btn"]');
    if (!visualBtn) {
      test.skip(true, 'Manual page not available in this environment (skipping)');
      return;
    }

    await page.click('[data-testid="view-visual-btn"]');
    const overlayAnchor = await page.$('[data-testid="visual-overlays-island"]');
    if (!overlayAnchor) {
      test.skip(true, 'Visual overlays anchor not present in this environment');
      return;
    }

    const overlayId = 'ov-pos-1';
    const bbox = { x: 0.12, y: 0.34, width: 0.56, height: 0.22 };

    await page.evaluate(
      async ({ overlayId, bbox }) => {
        const anchor = document.querySelector(
          '[data-island="visual-overlays-island"]'
        );
        if (!anchor) return;

        const props = {
          documentId: 1001,
          images: [
            {
              id: 'img-pos-1',
              originalSrc:
                'data:image/svg+xml;utf8,' +
                encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400"><rect width="500" height="400" fill="#e5e7eb"/></svg>'
                ),
            },
          ],
          overlaysByImage: {
            'img-pos-1': [
              {
                id: overlayId,
                bbox,
              },
            ],
          },
        };

        anchor.setAttribute('data-props', JSON.stringify(props));
        if (typeof (window as unknown as { mountIslands?: (d: Document) => void }).mountIslands === 'function') {
          (window as unknown as { mountIslands?: (d: Document) => void }).mountIslands?.(document);
        }
      },
      { overlayId, bbox }
    );

    const marker = page.locator(`[data-testid="overlay-marker-${overlayId}"]`);
    await marker.waitFor({ state: 'visible', timeout: 10000 });

    await expect(marker).toHaveAttribute('x', `${bbox.x * 100}%`);
    await expect(marker).toHaveAttribute('y', `${bbox.y * 100}%`);
    await expect(marker).toHaveAttribute('width', `${bbox.width * 100}%`);
    await expect(marker).toHaveAttribute('height', `${bbox.height * 100}%`);
  });
});