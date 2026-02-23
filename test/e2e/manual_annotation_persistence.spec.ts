import { test, expect, type Dialog, type Route } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');
const { navigateToWorkspace, switchTab } = require('../helpers/workspace-fixtures');

interface Overlay {
  id?: string;
  label: string;
  pageNumber?: number;
  confidence?: number;
  bbox?: { x: number; y: number; width: number; height: number };
  [key: string]: unknown;
}

const drawBoxOnViewer = async (page: import('@playwright/test').Page) => {
  const container = page.locator('[data-testid="overlay-container"]');
  const box = await container.boundingBox();
  if (!box) throw new Error('Overlay container bounding box not found');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
};

test.describe('Workspace - Visual overlay persistence', () => {
  test('label field creates overlay and delete removes it', async ({ page }) => {
    const docId = getTestDocId();
    const fieldId = 'invoice_number';
    let overlays: Overlay[] = [];

    await page.route(`**/api/visual-overlays/missing-fields/${docId}`, async (route: Route) => {
      const mapped = overlays.some((o: Overlay) => o.label === fieldId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fields: [
            { id: fieldId, label: 'Invoice Number', isMapped: mapped, overlayId: mapped ? 'ov-1' : null }
          ]
        })
      });
    });

    await page.route(`**/api/visual-overlays/document/${docId}`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ overlays })
      });
    });

    await page.route('**/api/visual-overlays', async (route: Route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      overlays = [{
        id: 'ov-1',
        label: fieldId,
        pageNumber: 1,
        confidence: 1,
        bbox: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 }
      }];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, overlay: overlays[0] })
      });
    });

    await page.route('**/api/visual-overlays/ov-1', async (route: Route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }
      overlays = [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

  await navigateToWorkspace(page, docId);
  await switchTab(page, 'visual');

  await page.waitForSelector('[data-testid="overlay-container"][data-draw-mode="inactive"]', { timeout: 10000 }).catch(() => null);

  const labelButton = page.locator(`[data-testid="label-btn-${fieldId}"]`);
  await expect(labelButton).toBeVisible();
  await labelButton.click();

  await page.waitForSelector('[data-testid="overlay-container"][data-draw-mode="active"]', { timeout: 10000 });

  const postOverlay = page.waitForResponse(resp =>
    resp.url().includes('/api/visual-overlays') &&
    resp.request().method() === 'POST'
  );

  await page.evaluate((detail) => {
    window.dispatchEvent(new CustomEvent('overlay:draw-complete', { detail }));
  }, {
    bbox: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
    page: 1,
    purpose: 'label-field',
    fieldId,
    imageBase64: 'ZmFrZQ=='
  });

  await postOverlay;

  await page.waitForSelector('[data-testid="overlay-ov-1"]', { timeout: 10000 });
  await expect(page.locator('[data-testid="overlay-ov-1"]')).toBeVisible();

  const deleteButton = page.locator('[data-testid="delete-overlay-ov-1"]');
  await expect(deleteButton).toBeVisible();
  page.once('dialog', async (dialog: Dialog) => {
    await dialog.accept();
  });
  const deleteOverlay = page.waitForResponse(resp =>
    resp.url().includes('/api/visual-overlays/ov-1') &&
    resp.request().method() === 'DELETE'
  );
  await deleteButton.click();
  await deleteOverlay;

  await page.waitForSelector('[data-testid="overlay-ov-1"]', { state: 'detached', timeout: 10000 });
  });

  test('missing fields list updates when overlay is mapped', async ({ page }) => {
    const docId = getTestDocId();
    const fieldId = 'invoice_number';
    let overlays: Overlay[] = [];

    await page.route(`**/api/visual-overlays/missing-fields/${docId}`, async (route: Route) => {
      const mapped = overlays.some((o: Overlay) => o.label === fieldId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fields: [
            { id: fieldId, label: 'Invoice Number', isMapped: mapped, overlayId: mapped ? 'ov-1' : null }
          ]
        })
      });
    });

    await page.route(`**/api/visual-overlays/document/${docId}`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ overlays })
      });
    });

    await page.route('**/api/visual-overlays', async (route: Route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      overlays = [{
        id: 'ov-1',
        label: fieldId,
        pageNumber: 1,
        confidence: 1,
        bbox: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 }
      }];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, overlay: overlays[0] })
      });
    });

  await navigateToWorkspace(page, docId);
  await switchTab(page, 'visual');

  await expect(page.locator(`[data-testid="missing-field-${fieldId}"]`)).toBeVisible();

  await page.waitForSelector('[data-testid="overlay-container"][data-draw-mode="inactive"]', { timeout: 10000 }).catch(() => null);
  await page.locator(`[data-testid="label-btn-${fieldId}"]`).click();
  await page.waitForSelector('[data-testid="overlay-container"][data-draw-mode="active"]', { timeout: 10000 });
  const postOverlay = page.waitForResponse(resp =>
    resp.url().includes('/api/visual-overlays') &&
    resp.request().method() === 'POST'
  );
  await page.evaluate((detail) => {
    window.dispatchEvent(new CustomEvent('overlay:draw-complete', { detail }));
  }, {
    bbox: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 },
    page: 1,
    purpose: 'label-field',
    fieldId,
    imageBase64: 'ZmFrZQ=='
  });
  await postOverlay;

  await expect(page.locator(`[data-testid="missing-field-${fieldId}"]`)).toHaveCount(0);
  });
});
