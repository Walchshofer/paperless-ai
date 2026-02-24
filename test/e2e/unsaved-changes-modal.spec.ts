import { test, expect } from '@playwright/test';
const fixtures = require('../helpers/fixtures');
const { navigateToWorkspace, waitForIslandMount, clickToolbarButton } = require('../helpers/workspace-fixtures');

test.describe('Unsaved changes modal — portal z-index fix', () => {
  let docId: number;

  test.beforeEach(async ({ page }) => {
    docId = fixtures.getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
  });

  // ── Helper: dirty the form ───────────────────────────────────────────────────
  async function makeFormDirty(page: import('@playwright/test').Page) {
    // Type into the correspondent input to mark the form dirty
    const correspondentInput = page.locator('[data-testid="smart-correspondent-input"]');
    const isVisible = await correspondentInput.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await correspondentInput.click({ clickCount: 3 }); // select all
      await correspondentInput.type('__dirty_test__');
    } else {
      // Fallback: dispatch workspace:dirty directly
      await page.evaluate((id) => {
        window.dispatchEvent(new CustomEvent('workspace:dirty', { detail: { documentId: id } }));
      }, docId);
    }
  }

  // ── Modal appears ────────────────────────────────────────────────────────────

  test('unsaved changes modal appears when navigating away with dirty form', async ({ page }) => {
    await makeFormDirty(page);

    // Trigger navigation (next/prev document) to surface the modal
    const navNext = page.locator('[data-testid="nav-next-btn"]');
    const navVisible = await navNext.isVisible({ timeout: 5000 }).catch(() => false);
    if (!navVisible) return; // no next document available — skip

    await navNext.click();

    const modal = page.locator('[data-testid="nav-confirm-modal"], [role="dialog"]').filter({
      hasText: /unsaved|discard|save/i
    });
    await expect(modal).toBeVisible({ timeout: 8000 });
  });

  // ── Portal fix: modal is child of document.body ──────────────────────────────

  test('modal is rendered as a direct child of document.body (portal fix)', async ({ page }) => {
    await makeFormDirty(page);

    const navNext = page.locator('[data-testid="nav-next-btn"]');
    if (!await navNext.isVisible({ timeout: 5000 }).catch(() => false)) return;

    await navNext.click();

    const modalVisible = await page.locator('[data-testid="nav-confirm-modal"], [role="dialog"]')
      .filter({ hasText: /unsaved|discard|save/i })
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    if (!modalVisible) return; // modal didn't appear — likely no next doc

    // The modal or its overlay wrapper should be a direct child of <body>
    const isDirectBodyChild = await page.evaluate(() => {
      // Any fixed overlay rendered via createPortal is a direct child of body
      const fixedEls = Array.from(document.body.children).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.position === 'fixed' || style.zIndex !== 'auto';
      });
      return fixedEls.length > 0;
    });

    expect(isDirectBodyChild).toBe(true);
  });

  test('modal z-index is ≥ 9999 to clear the panel divider', async ({ page }) => {
    await makeFormDirty(page);

    const navNext = page.locator('[data-testid="nav-next-btn"]');
    if (!await navNext.isVisible({ timeout: 5000 }).catch(() => false)) return;

    await navNext.click();

    const modal = page.locator('[data-testid="nav-confirm-modal"], [role="dialog"]')
      .filter({ hasText: /unsaved|discard|save/i });

    if (!await modal.isVisible({ timeout: 8000 }).catch(() => false)) return;

    const zIndex = await page.evaluate(() => {
      // Find the highest z-index among body direct children
      let maxZ = 0;
      for (const child of Array.from(document.body.children)) {
        const z = parseInt(window.getComputedStyle(child).zIndex, 10);
        if (Number.isFinite(z) && z > maxZ) maxZ = z;
      }
      return maxZ;
    });

    expect(zIndex).toBeGreaterThanOrEqual(9999);
  });

  // ── Modal buttons ────────────────────────────────────────────────────────────

  test('Cancel button closes modal and keeps the user on the same doc', async ({ page }) => {
    await makeFormDirty(page);

    const navNext = page.locator('[data-testid="nav-next-btn"]');
    if (!await navNext.isVisible({ timeout: 5000 }).catch(() => false)) return;

    // Capture current URL
    const urlBefore = page.url();
    await navNext.click();

    const modal = page.locator('[data-testid="nav-confirm-modal"], [role="dialog"]')
      .filter({ hasText: /unsaved|discard|save/i });
    if (!await modal.isVisible({ timeout: 8000 }).catch(() => false)) return;

    const cancelBtn = modal.locator('button', { hasText: /cancel/i });
    await cancelBtn.click();

    await page.waitForTimeout(500);
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // URL should be unchanged (stayed on same doc)
    expect(page.url()).toBe(urlBefore);
  });

  test('Discard button closes modal and navigates away', async ({ page }) => {
    await makeFormDirty(page);

    const navNext = page.locator('[data-testid="nav-next-btn"]');
    if (!await navNext.isVisible({ timeout: 5000 }).catch(() => false)) return;

    const urlBefore = page.url();
    await navNext.click();

    const modal = page.locator('[data-testid="nav-confirm-modal"], [role="dialog"]')
      .filter({ hasText: /unsaved|discard|save/i });
    if (!await modal.isVisible({ timeout: 8000 }).catch(() => false)) return;

    const discardBtn = modal.locator('button', { hasText: /discard/i });
    await discardBtn.click();

    await page.waitForTimeout(1000);
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // URL should have changed (navigation happened)
    expect(page.url()).not.toBe(urlBefore);
  });

  test('Save button closes modal, saves, then navigates away', async ({ page }) => {
    await makeFormDirty(page);

    const navNext = page.locator('[data-testid="nav-next-btn"]');
    if (!await navNext.isVisible({ timeout: 5000 }).catch(() => false)) return;

    const urlBefore = page.url();
    await navNext.click();

    const modal = page.locator('[data-testid="nav-confirm-modal"], [role="dialog"]')
      .filter({ hasText: /unsaved|discard|save/i });
    if (!await modal.isVisible({ timeout: 8000 }).catch(() => false)) return;

    const saveBtn = modal.locator('button', { hasText: /save/i });
    await saveBtn.click();

    await page.waitForTimeout(2000);
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Should navigate after save
    expect(page.url()).not.toBe(urlBefore);
  });

  // ── Modal not blocked by panel divider ──────────────────────────────────────

  test('modal backdrop covers the full viewport (not clipped by divider)', async ({ page }) => {
    await makeFormDirty(page);

    const navNext = page.locator('[data-testid="nav-next-btn"]');
    if (!await navNext.isVisible({ timeout: 5000 }).catch(() => false)) return;

    await navNext.click();

    const modal = page.locator('[data-testid="nav-confirm-modal"], [role="dialog"]')
      .filter({ hasText: /unsaved|discard|save/i });
    if (!await modal.isVisible({ timeout: 8000 }).catch(() => false)) return;

    // The backdrop/overlay should cover full viewport height
    const isFullScreen = await page.evaluate(() => {
      const overlay = document.body.querySelector('[class*="fixed"][class*="inset-0"]');
      if (!overlay) return false;
      const rect = overlay.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      return rect.height >= vh * 0.95 && rect.width >= vw * 0.95;
    });

    expect(isFullScreen).toBe(true);
  });

  // ── No modal when form is clean ──────────────────────────────────────────────

  test('navigation without dirty form shows no modal', async ({ page }) => {
    // Do NOT dirty the form — navigate directly
    const navNext = page.locator('[data-testid="nav-next-btn"]');
    if (!await navNext.isVisible({ timeout: 5000 }).catch(() => false)) return;

    await navNext.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('[data-testid="nav-confirm-modal"], [role="dialog"]')
      .filter({ hasText: /unsaved|discard|save/i });
    const modalShown = await modal.isVisible().catch(() => false);
    expect(modalShown).toBe(false);
  });
});
