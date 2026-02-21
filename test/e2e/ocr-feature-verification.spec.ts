import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('OCR Tab Feature Verification', () => {
  // Authentication is handled by globalSetup and storageState
  
  test('Verify OCR View, Toggle, Edit, Feedback and Regeneration', async ({ page }) => {
    // Capture browser console logs
    page.on('console', msg => console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.message}`));

    // 1. Navigate directly to OCR tab using deep-linking
    console.log('📄 Navigating to Document 2 Workspace (OCR Tab)...');
    await page.goto(`${BASE}/workspace/doc/2?tab=content`, { waitUntil: 'domcontentloaded' });
    
    // Check for login redirect just in case
    if (page.url().includes('/login')) {
      console.log('⚠️ Storage state expired or invalid, performing manual login...');
      const user = process.env.PAPERLESS_ADMIN_USER || 'elfman';
      const pass = process.env.PAPERLESS_ADMIN_PASSWORD || 'P2tr3ck!1976';
      await page.fill('#username', user);
      await page.fill('#password', pass);
      await page.click('[data-testid="login-submit-btn"]');
      await page.waitForURL('**/workspace/doc/2?tab=content');
    }

    // Wait for sidebar to hydrate
    console.log('⏳ Waiting for sidebar hydration...');
    const sidebarRoot = page.locator('[data-testid="context-sidebar-root"]');
    await expect(sidebarRoot).toBeVisible({ timeout: 30000 });
    
    // 2. Ensure OCR tab is selected (declarative attributes fix)
    console.log('📑 Verifying OCR tab state...');
    const tabBtn = page.locator('button[id="tab-content"]');
    await expect(tabBtn).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });
    
    // 3. Verify Mode Toggle existence
    console.log('🔄 Verifying Mode Toggles...');
    const originalBtn = page.locator('[data-testid="ocr-mode-original"]');
    const highResBtn = page.locator('[data-testid="ocr-mode-high-res"]');
    
    await expect(originalBtn).toBeVisible({ timeout: 15000 });
    await expect(highResBtn).toBeVisible({ timeout: 15000 });
    
    // 4. Test Regeneration
    console.log('🔄 Testing Regeneration...');
    const regenBtn = page.locator('[data-testid="ocr-regenerate"]');
    await expect(regenBtn).toBeVisible();
    await regenBtn.click();
    
    // Check for loading state
    console.log('⏳ Awaiting regeneration loading state...');
    await expect(page.locator('[data-testid="ocr-regenerating-state"]')).toBeVisible({ timeout: 10000 });
    
    // Wait for regeneration to complete
    console.log('⏳ Awaiting neural engine completion...');
    await expect(page.locator('[data-testid="ocr-regenerating-state"]')).not.toBeVisible({ timeout: 120000 });
    
    // Verify AI view active and info bar visible
    await expect(highResBtn).toHaveClass(/bg-white/);
    await expect(page.locator('[data-testid="ocr-ai-info-bar"]')).toBeVisible();
    console.log('✅ Regeneration successful');

    // 5. Test Edit Flow
    console.log('✏️ Testing Edit flow...');
    await page.locator('[data-testid="ocr-start-edit"]').click();
    
    // Verify textarea visible
    const textarea = page.locator('[data-testid="ocr-edit-textarea"]');
    await expect(textarea).toBeVisible();
    
    // Edit some text
    const originalValue = await textarea.inputValue();
    const newValue = `[EDITED BY E2E TEST ${Date.now()}] ${originalValue}`;
    await textarea.fill(newValue);
    
    console.log('💾 Testing Save...');
    const saveBtn = page.locator('[data-testid="ocr-save-edit"]');
    await saveBtn.click();
    
    // Wait for "Saved" success state on the button
    await expect(saveBtn).toContainText('Saved', { timeout: 15000 });
    await expect(textarea).not.toBeVisible({ timeout: 15000 });
    
    console.log('✅ Edit and Save successful');

    // 6. Verify Feedback State (Accurate vote)
    console.log('👍 Testing Feedback Vote...');
    // Refresh to clear 'correction' state if needed, or just check if 'accurate' button is visible
    await page.reload();
    await page.locator('[data-testid="tab-content"]').first().click();
    
    const voteBtn = page.locator('[data-testid="ocr-vote-accurate"]');
    if (await voteBtn.isVisible()) {
      await voteBtn.click();
      await expect(page.locator('text=Verified Accurate')).toBeVisible();
      console.log('✅ Feedback vote recorded');
    }

    await page.screenshot({ path: 'test-results/ocr-features-complete-verified.png', fullPage: true });
  });
});
