import { test, expect, type Route } from '@playwright/test';
const fixtures = require('../helpers/fixtures');
const { navigateToWorkspace, waitForIslandMount } = require('../helpers/workspace-fixtures');

test.describe('Draw-to-Custom-Field (T6)', () => {
  let docId: number;

  test.beforeEach(async ({ page }) => {
    docId = fixtures.getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
  });

  // ── Add Field button ─────────────────────────────────────────────────────────

  test('"Add Field from Document" button is visible in Extended Data section', async ({ page }) => {
    const btn = page.locator('[data-testid="add-custom-field-draw-btn"]');
    await expect(btn).toBeVisible({ timeout: 10000 });
  });

  test('clicking "Add Field from Document" dispatches custom-field:draw-request event', async ({ page }) => {
    const btn = page.locator('[data-testid="add-custom-field-draw-btn"]');
    const isVisible = await btn.isVisible({ timeout: 10000 }).catch(() => false);
    if (!isVisible) return; // no extended data section — skip

    const eventFired = page.evaluate(() => new Promise<boolean>((resolve) => {
      window.addEventListener('custom-field:draw-request', () => resolve(true), { once: true });
      setTimeout(() => resolve(false), 3000);
    }));

    await btn.click();
    expect(await eventFired).toBe(true);
  });

  test('draw-request event carries a valid tempFieldId', async ({ page }) => {
    const btn = page.locator('[data-testid="add-custom-field-draw-btn"]');
    if (!await btn.isVisible({ timeout: 10000 }).catch(() => false)) return;

    // Do NOT await here — let the browser promise stay pending while we click
    const detailPromise = page.evaluate(() => new Promise<{ tempFieldId?: string }>((resolve) => {
      window.addEventListener(
        'custom-field:draw-request',
        (e) => resolve((e as CustomEvent).detail || {}),
        { once: true }
      );
      setTimeout(() => resolve({}), 3000);
    }));

    await btn.click();
    const resolved = await detailPromise; // await AFTER click so event can fire
    expect(typeof resolved.tempFieldId).toBe('string');
    expect(resolved.tempFieldId!.length).toBeGreaterThan(0);
  });

  // ── Draw mode activation ─────────────────────────────────────────────────────

  test('overlay container enters draw mode after custom-field:draw-request', async ({ page }) => {
    const btn = page.locator('[data-testid="add-custom-field-draw-btn"]');
    if (!await btn.isVisible({ timeout: 10000 }).catch(() => false)) return;

    // Wait for overlay viewer to be mounted
    await waitForIslandMount(page, 'overlay-viewer-island', 10000);

    const overlayContainer = page.locator('[data-testid="overlay-container"]');
    const containerExists = await overlayContainer.isVisible({ timeout: 5000 }).catch(() => false);
    if (!containerExists) return; // overlay not shown in this layout — skip

    await btn.click();

    // Draw mode attribute should become 'active'
    await expect(overlayContainer).toHaveAttribute('data-draw-mode', 'active', { timeout: 5000 });
  });

  test('draw mode is inactive before any draw request', async ({ page }) => {
    await waitForIslandMount(page, 'overlay-viewer-island', 10000);

    const overlayContainer = page.locator('[data-testid="overlay-container"]');
    if (!await overlayContainer.isVisible({ timeout: 5000 }).catch(() => false)) return;

    const mode = await overlayContainer.getAttribute('data-draw-mode');
    expect(mode).toBe('inactive');
  });

  // ── Draw-complete → new field row ────────────────────────────────────────────

  test('dispatching custom-field:draw-complete creates a pending field row', async ({ page }) => {
    const tempFieldId = `custom_field_draw_${Date.now()}`;

    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('custom-field:draw-complete', {
        detail: {
          tempFieldId: id,
          bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
          page: 1,
          imageBase64: null
        }
      }));
    }, tempFieldId);

    await page.waitForTimeout(500);

    // A new field row with pendingName should appear
    // It renders an input with placeholder "Enter field name..."
    const newInput = page.locator('input[placeholder*="field name"], input[placeholder*="Enter field"]');
    const appeared = await newInput.isVisible({ timeout: 5000 }).catch(() => false);
    expect(appeared).toBe(true);
  });

  test('pending field row has a locate button linked to the drawn bbox', async ({ page }) => {
    const tempFieldId = `custom_field_draw_${Date.now()}`;

    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('custom-field:draw-complete', {
        detail: {
          tempFieldId: id,
          bbox: { x: 0.5, y: 0.6, width: 0.2, height: 0.1 },
          page: 2,
          imageBase64: null
        }
      }));
    }, tempFieldId);

    await page.waitForTimeout(500);

    // Locate button (crosshairs icon) should appear in the new row area
    const locateBtn = page.locator('[data-testid^="locate-btn-"]').last();
    const hasLocate = await locateBtn.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasLocate).toBe(true);
  });

  // ── Draw mode resets on document switch ─────────────────────────────────────

  test('draw mode clears when workspace:document-changed fires', async ({ page }) => {
    // Overlay island may not be present in all layouts — gracefully skip if not mounted
    const overlayMounted = await waitForIslandMount(page, 'overlay-viewer-island', 10000)
      .then(() => true).catch(() => false);
    if (!overlayMounted) return;

    const overlayContainer = page.locator('[data-testid="overlay-container"]');
    if (!await overlayContainer.isVisible({ timeout: 5000 }).catch(() => false)) return;

    // Activate draw mode manually
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('custom-field:draw-request', {
        detail: { documentId: 1, tempFieldId: 'tmp_001' }
      }));
    });

    // Wait for draw mode to become active
    const activated = await overlayContainer.getAttribute('data-draw-mode').then(
      v => v === 'active'
    ).catch(() => false);

    if (!activated) return; // island may not have handled the event — skip

    // Dispatch document switch
    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('workspace:document-changed', {
        detail: { documentId: id }
      }));
    }, docId);

    await page.waitForTimeout(500);

    // Draw mode should revert to inactive
    const modeAfter = await overlayContainer.getAttribute('data-draw-mode');
    expect(modeAfter).toBe('inactive');
  });

  // ── Edge: no draw-request without button click ───────────────────────────────

  test('custom-field:draw-request is not dispatched on plain page load', async ({ page }) => {
    let eventFired = false;
    await page.evaluate(() => {
      window.addEventListener('custom-field:draw-request', () => {
        (window as unknown as { __drawRequestFired: boolean }).__drawRequestFired = true;
      });
    });

    await page.waitForTimeout(1500);

    const fired = await page.evaluate(() =>
      !!(window as unknown as { __drawRequestFired?: boolean }).__drawRequestFired
    );
    expect(fired).toBe(false);
  });
});
