import { test, expect } from '@playwright/test';
const fixtures = require('../helpers/fixtures');
const { waitForIslandMount } = require('../helpers/workspace-fixtures');

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('Metadata locate -> Overlay highlight', () => {
  test('dispatching metadata:locate-field triggers overlay highlight', async ({ page }) => {
    const docId = fixtures.getTestDocId();
    const fieldId = 'e2e_locate_total_amount';
    const bbox = { x: 0.78, y: 0.76, width: 0.14, height: 0.1 };
    await page.route(`**/api/visual-overlays/document/${docId}*`, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          overlays: [
            {
              id: 'e2e-overlay-1',
              pageNumber: 1,
              bbox
            }
          ],
          fields: [
            {
              id: fieldId,
              paperlessField: fieldId,
              pageNumber: 1,
              bbox
            }
          ]
        })
      });
    });
    await page.goto(`${BASE}/workspace/doc/${docId}?tab=metadata`, {
      waitUntil: 'domcontentloaded'
    });

    await waitForIslandMount(page, 'overlay-viewer-island', 10000);
    await waitForIslandMount(page, 'context-sidebar-island', 10000);
    // UnifiedWorkspaceIsland hosts the metadata:locate-field → overlay:highlight-region
    // event relay. It is class="hidden" (no visible rendering), so wait for
    // the element to exist in the DOM rather than be visible.
    await page.waitForSelector('[data-island="unified-workspace-island"]', {
      state: 'attached',
      timeout: 10000
    });

    // Wait for image to load so scroll-delta assertions work (applyRegionScroll
    // returns early when imageDimensions.width === 0).
    await page.waitForFunction(
      () => {
        const img = document.querySelector(
          '[data-testid="overlay-document-image"]'
        ) as HTMLImageElement | null;
        return img != null && img.naturalWidth > 0;
      },
      { timeout: 15000 }
    );

    const beforeScroll = await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="overlay-container"]'
      ) as HTMLElement | null;
      if (!container) {
        return null;
      }
      return {
        left: container.scrollLeft,
        top: container.scrollTop
      };
    });

    await page.evaluate((targetFieldId: string) => {
      window.dispatchEvent(new CustomEvent('metadata:locate-field', {
        detail: { fieldId: targetFieldId }
      }));
    }, fieldId);

    const highlight = page.locator('[data-testid="overlay-highlight-region"]');
    await expect(highlight).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(350);

    const afterScroll = await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="overlay-container"]'
      ) as HTMLElement | null;
      if (!container) {
        return null;
      }
      return {
        left: container.scrollLeft,
        top: container.scrollTop
      };
    });

    const locateState = await page.evaluate(() => {
      const w = window as unknown as {
        __last_metadata_locate?: { fieldId?: string; handled?: boolean };
      };
      return w.__last_metadata_locate || null;
    });
    expect(locateState?.fieldId).toBe(fieldId);
    expect(locateState?.handled).toBe(true);
    expect(beforeScroll).toBeTruthy();
    expect(afterScroll).toBeTruthy();
    expect(
      (afterScroll?.left || 0) > (beforeScroll?.left || 0) ||
      (afterScroll?.top || 0) > (beforeScroll?.top || 0)
    ).toBe(true);
  });
});
