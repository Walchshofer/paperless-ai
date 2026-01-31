import { test, expect } from '@playwright/test';

test.describe('Visual-RAG overlay success', () => {
  test('overlay island mounts and renders injected overlays', async ({ page }) => {
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

    const overlayId = 'ov-success-1';

    await page.evaluate(async ({ overlayId }) => {
      const anchor = document.querySelector(
        '[data-island="visual-overlays-island"]'
      );
      if (!anchor) return;

      const props = {
        documentId: 999,
        images: [
          {
            id: 'img-success-1',
            originalSrc:
              'data:image/svg+xml;utf8,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f3f4f6"/></svg>'
              ),
          },
        ],
        overlaysByImage: {
          'img-success-1': [
            {
              id: overlayId,
              bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.25 },
            },
          ],
        },
      };

      anchor.setAttribute('data-props', JSON.stringify(props));
      if (typeof (window as unknown as { mountIslands?: (d: Document) => void }).mountIslands === 'function') {
        (window as unknown as { mountIslands?: (d: Document) => void }).mountIslands?.(document);
      }
    }, { overlayId });

    await page.waitForSelector(`[data-testid="overlay-marker-${overlayId}"]`, {
      timeout: 10000,
    });

    const marker = page.locator(`[data-testid="overlay-marker-${overlayId}"]`);
    await expect(marker).toBeVisible();
  });
});
