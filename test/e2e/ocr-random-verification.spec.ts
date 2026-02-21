import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('OCR Random Batch Verification', () => {
  // Available IDs in range 1-96 from previous check
  const ALL_IDS = [73,74,92,93,94,66,67,79,41,53,54,2,70,71,46,47,42,75,50,65,76,5,63,9,89,11,12,14,1,13,16,43,44,10,17,18,21,22,23,26,19,20,4,7,90,6,27,8,3,28,95,96,49,31,29,30,33,34,35,36,32,24,25,37,38,39,72,77,78,48,83,84,85,86,64,80,81,82,61,62,56,57,55,58,59,40,60,68,69,87,88,15,52,45,91];
  
  // Pick 3 random IDs
  const randomIds = [...ALL_IDS].sort(() => 0.5 - Math.random()).slice(0, 3);
  
  console.log(`[E2E] Randomly selected Document IDs for verification: ${randomIds.join(', ')}`);

  for (const docId of randomIds) {
    test(`Verify complete OCR flow for Document ${docId}`, async ({ page }) => {
      // Capture browser console logs
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          console.log(`[DOC ${docId}] ${msg.type().toUpperCase()}: ${msg.text()}`);
        }
      });
      
      console.log(`
--- STARTING VERIFICATION FOR DOC ${docId} ---`);
      
      // 1. Navigate directly to OCR tab
      console.log(`[DOC ${docId}] Navigating to workspace...`);
      await page.goto(`${BASE}/workspace/doc/${docId}?tab=content`, { waitUntil: 'domcontentloaded' });
      
      // Handle login if redirected (Auth handled by storageState in globalSetup)
      if (page.url().includes('/login')) {
        console.log(`[DOC ${docId}] Auth state missing, performing manual login...`);
        const user = process.env.PAPERLESS_ADMIN_USER || 'elfman';
        const pass = process.env.PAPERLESS_ADMIN_PASSWORD || 'P2tr3ck!1976';
        await page.fill('#username', user);
        await page.fill('#password', pass);
        await page.click('[data-testid="login-submit-btn"]');
        await page.waitForURL(`**/workspace/doc/${docId}?tab=content`);
      }

      // Wait for sidebar hydration
      const sidebarRoot = page.locator('[data-testid="context-sidebar-root"]');
      await expect(sidebarRoot).toBeVisible({ timeout: 30000 });
      await expect(sidebarRoot).toHaveAttribute('data-hydrated', 'true', { timeout: 15000 });
      
      // 2. Ensure OCR tab is active
      console.log(`[DOC ${docId}] Verifying tab state...`);
      const tabBtn = page.locator('button[id="tab-content"]');
      await expect(tabBtn).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });
      
      // 3. Trigger Regeneration
      console.log(`[DOC ${docId}] Triggering Neural Regeneration (300 DPI)...`);
      const regenBtn = page.locator('[data-testid="ocr-regenerate"]');
      await expect(regenBtn).toBeVisible();
      await regenBtn.click();
      
      // Wait for loading state
      await expect(page.locator('[data-testid="ocr-regenerating-state"]')).toBeVisible({ timeout: 10000 });
      
      // Wait for neural engine completion
      console.log(`[DOC ${docId}] Awaiting engine response...`);
      await expect(page.locator('[data-testid="ocr-regenerating-state"]')).not.toBeVisible({ timeout: 180000 });
      
      // Verify AI view active
      const highResBtn = page.locator('[data-testid="ocr-mode-high-res"]');
      await expect(highResBtn).toHaveClass(/bg-white/);
      await expect(page.locator('[data-testid="ocr-ai-info-bar"]')).toBeVisible();
      console.log(`[DOC ${docId}] ✅ Regeneration successful`);

      // 4. Test Edit Flow
      console.log(`[DOC ${docId}] Testing Edit/Save flow...`);
      await page.locator('[data-testid="ocr-start-edit"]').click();
      const textarea = page.locator('[data-testid="ocr-edit-textarea"]');
      await expect(textarea).toBeVisible();
      
      const originalValue = await textarea.inputValue();
      const newValue = `[VERIFIED ${Date.now()}] ${originalValue}`;
      await textarea.fill(newValue);
      
      const saveBtn = page.locator('[data-testid="ocr-save-edit"]');
      await saveBtn.click();
      
      await expect(saveBtn).toContainText('Saved', { timeout: 15000 });
      await expect(textarea).not.toBeVisible({ timeout: 15000 });
      console.log(`[DOC ${docId}] ✅ Edit/Save successful`);

      // 5. Feedback Vote
      console.log(`[DOC ${docId}] Testing Feedback...`);
      // Refresh to enable vote button if hidden by correction state
      await page.reload();
      await page.locator('button[id="tab-content"]').click();
      
      const voteBtn = page.locator('[data-testid="ocr-vote-accurate"]');
      if (await voteBtn.isVisible()) {
        await voteBtn.click();
        await expect(page.locator('text=Verified Accurate')).toBeVisible();
        console.log(`[DOC ${docId}] ✅ Feedback recorded`);
      }

      console.log(`--- COMPLETED VERIFICATION FOR DOC ${docId} ---`);
      await page.screenshot({ path: `test-results/ocr-random-doc-${docId}.png`, fullPage: true });
    });
  }
});
