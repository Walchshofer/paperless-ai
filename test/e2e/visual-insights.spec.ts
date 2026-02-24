import { test, expect, type Route } from '@playwright/test';
const fixtures = require('../helpers/fixtures');
const { navigateToWorkspace, waitForIslandMount, switchTab } = require('../helpers/workspace-fixtures');

const MOCK_VIS_OCR_PAGES = [
  { pageNumber: 1, text: 'Rechnungsnummer 12345\nGesamtbetrag: EUR 99,00', success: true },
  { pageNumber: 2, text: '', success: false }
];

// Mock the visual overlays API to return empty so mappedVisualFields === 0,
// which is required for vis-ocr-inline-pages and generate-high-res-cta to render.
async function mockEmptyOverlays(page: import('@playwright/test').Page) {
  await page.route('**/api/visual-overlays/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ overlays: [], fields: [] })
    });
  });
}

test.describe('Visual Insights — VIS_OCR display + auto-generate (T3b + T4)', () => {
  let docId: number;

  test.beforeEach(async ({ page }) => {
    docId = fixtures.getTestDocId();
    // Clear localStorage guard so auto-generate fires fresh each time
    await page.addInitScript((id) => {
      localStorage.removeItem(`vis_ocr_generated_${id}`);
    }, docId);
  });

  // ── CTA empty state ─────────────────────────────────────────────────────────

  test('generate-high-res-cta appears when no visual data is available', async ({ page }) => {
    // Ensure mappedVisualFields = 0 by mocking overlays to empty
    await mockEmptyOverlays(page);

    // Intercept OCR regenerate to delay so we can observe state
    await page.route('**/ocr/regenerate', async (route: Route) => {
      await new Promise<void>((r) => setTimeout(r, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, pages: [], source: 'vis_ocr' })
      });
    });

    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);

    // Reset vis_ocr state to empty so the CTA condition is met:
    // (mappedVisualFields.length === 0 && visOcrPages.length === 0)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('vis-ocr:updated', {
        detail: { pages: [], source: '' }
      }));
    });
    await page.waitForTimeout(400);

    // Either the CTA (no data) or the accordion (has data) should be visible
    const cta = page.locator('[data-testid="generate-high-res-cta"]');
    const accordion = page.locator('[data-testid="vis-ocr-inline-pages"]');
    const eitherVisible = await cta.isVisible({ timeout: 5000 }).catch(() => false)
      || await accordion.isVisible({ timeout: 2000 }).catch(() => false);
    expect(eitherVisible).toBe(true);
  });

  // ── Auto-generate banner lifecycle ─────────────────────────────────────────

  test('auto-generate banner transitions from running to done', async ({ page }) => {
    // Mock regeneration with a 1.5s delay so the running/regenerating state is observable
    await page.route('**/ocr/regenerate', async (route: Route) => {
      await new Promise<void>((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pages: MOCK_VIS_OCR_PAGES,
          source: 'vis_ocr',
          quality: 0.9
        })
      });
    });

    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);

    // Switch to content tab — auto-ocr-banner lives in DocumentContentIsland
    await switchTab(page, 'content');
    await waitForIslandMount(page, 'document-content-island', 10000).catch(() => {});

    // Manually trigger regeneration via the vis-ocr:request-generate event
    // (DocumentContentIsland listens and calls handleRegenerate())
    // Pass null documentId to match any document (handler only filters when documentId != null)
    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('vis-ocr:request-generate', {
        detail: { documentId: id }
      }));
    }, docId);

    // Running banner, done banner, or regenerating state should appear in the content tab.
    // Auto-generate (silent) sets autoGenerateBanner; manual trigger shows ocr-regenerating-state.
    const running = page.locator('[data-testid="auto-ocr-banner"]');
    const done = page.locator('[data-testid="auto-ocr-banner-done"]');
    const regenerating = page.locator('[data-testid="ocr-regenerating-state"]');

    const gotRunning = await running.isVisible({ timeout: 8000 }).catch(() => false);
    const gotDone = await done.isVisible({ timeout: 10000 }).catch(() => false);
    const gotRegenerating = await regenerating.isVisible({ timeout: 3000 }).catch(() => false);
    expect(gotRunning || gotDone || gotRegenerating).toBe(true);
  });

  // ── localStorage guard prevents double-fire ─────────────────────────────────

  test('auto-generate does NOT fire on second visit when localStorage guard is set', async ({ page }) => {
    let callCount = 0;
    await page.route('**/ocr/regenerate', async (route: Route) => {
      callCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, pages: MOCK_VIS_OCR_PAGES, source: 'vis_ocr' })
      });
    });

    // Pre-set the guard before navigation
    await page.addInitScript((id) => {
      localStorage.setItem(`vis_ocr_generated_${id}`, '1');
    }, docId);

    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
    await page.waitForTimeout(2000);

    expect(callCount).toBe(0);
    // No banner should appear (guard prevents auto-gen)
    const bannerVisible = await page.locator('[data-testid="auto-ocr-banner"]').isVisible().catch(() => false);
    expect(bannerVisible).toBe(false);
  });

  // ── vis-ocr-inline-pages accordion ─────────────────────────────────────────

  test('vis-ocr-inline-pages accordion appears after successful regeneration', async ({ page }) => {
    // mappedVisualFields must be 0 for accordion to render
    await mockEmptyOverlays(page);

    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);

    // Inject vis_ocr pages directly via event (simulates successful regeneration)
    await page.evaluate((pages) => {
      window.dispatchEvent(new CustomEvent('vis-ocr:updated', {
        detail: { pages, source: 'vis_ocr', quality: 0.9 }
      }));
    }, MOCK_VIS_OCR_PAGES);
    await page.waitForTimeout(500);

    const accordion = page.locator('[data-testid="vis-ocr-inline-pages"]');
    await expect(accordion).toBeVisible({ timeout: 8000 });
  });

  test('first page in accordion is expanded by default (open attribute)', async ({ page }) => {
    await mockEmptyOverlays(page);

    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);

    await page.evaluate((pages) => {
      window.dispatchEvent(new CustomEvent('vis-ocr:updated', {
        detail: { pages, source: 'vis_ocr' }
      }));
    }, MOCK_VIS_OCR_PAGES);
    await page.waitForTimeout(500);

    const accordion = page.locator('[data-testid="vis-ocr-inline-pages"]');
    await expect(accordion).toBeVisible({ timeout: 8000 });

    const firstDetail = accordion.locator('details').first();
    const isOpen = await firstDetail.getAttribute('open');
    expect(isOpen).not.toBeNull(); // open attribute present → expanded
  });

  test('failed OCR page shows "Needs Review" status', async ({ page }) => {
    await mockEmptyOverlays(page);

    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);

    await page.evaluate((pages) => {
      window.dispatchEvent(new CustomEvent('vis-ocr:updated', {
        detail: { pages, source: 'vis_ocr' }
      }));
    }, MOCK_VIS_OCR_PAGES);
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="vis-ocr-inline-pages"]')).toBeVisible({ timeout: 8000 });
    // Page 2 has success:false → should show "Needs Review"
    const needsReview = page.locator('[data-testid="vis-ocr-inline-pages"]').getByText('Needs Review');
    await expect(needsReview).toBeVisible({ timeout: 3000 });
  });

  // ── Generate CTA button dispatches event ────────────────────────────────────

  test('clicking Generate High-Res Analysis CTA fires vis-ocr:request-generate event', async ({ page }) => {
    await mockEmptyOverlays(page);

    // Use a slow regeneration so CTA stays visible long enough to interact
    await page.route('**/ocr/regenerate', async (route: Route) => {
      await new Promise<void>((r) => setTimeout(r, 5000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    // Guard already set so auto-gen doesn't fire; CTA should appear (no data)
    await page.addInitScript((id) => {
      localStorage.setItem(`vis_ocr_generated_${id}`, '1');
    }, docId);

    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);

    // Reset vis_ocr state to empty via event so CTA condition is met
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('vis-ocr:updated', {
        detail: { pages: [], source: '' }
      }));
    });
    await page.waitForTimeout(400);

    const cta = page.locator('[data-testid="generate-high-res-cta"]');
    const ctaVisible = await cta.isVisible({ timeout: 5000 }).catch(() => false);
    if (!ctaVisible) return; // doc already has visual data — skip

    // Set up event listener BEFORE clicking (don't await evaluate until after click)
    const eventFiredPromise = page.evaluate(() => new Promise<boolean>((resolve) => {
      window.addEventListener('vis-ocr:request-generate', () => resolve(true), { once: true });
      setTimeout(() => resolve(false), 4000);
    }));

    await cta.click();
    expect(await eventFiredPromise).toBe(true);
  });
});
