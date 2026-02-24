import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Document 47 Simple Persistence Test', () => {
  test('Verify metadata title update on doc 47', async ({ page }) => {
    test.setTimeout(120000);

    // 1. Navigate to Doc 47
    console.log('📄 Navigating to Document 47 Workspace...');
    await page.goto(`${BASE}/workspace/doc/47`, { waitUntil: 'networkidle' });
    
    // Login if needed
    if (page.url().includes('/login')) {
      await page.fill('#username', process.env.PAPERLESS_ADMIN_USER || 'elfman');
      await page.fill('#password', process.env.PAPERLESS_ADMIN_PASSWORD || 'P2tr3ck!1976');
      await page.click('[data-testid="login-submit-btn"]');
      await page.waitForURL('**/workspace/doc/47');
    }

    // Wait for hydration
    await expect(page.locator('[data-testid="smart-metadata-root"]')).toBeVisible({ timeout: 30000 });

    // 2. Modify Title
    console.log('✏️ Modifying title...');
    const titleInput = page.locator('[data-testid="smart-title-input"]');
    const _originalTitle = await titleInput.inputValue();
    const testTitle = `Einzelfahrt Simple Test ${Date.now()}`;
    await titleInput.fill(testTitle);
    await titleInput.blur();

    // Wait for dirty state
    console.log('⏳ Waiting for dirty state...');
    await expect(page.locator('[data-testid="status-unsaved"]')).toBeVisible({ timeout: 10000 });

    // 3. Save Changes
    console.log('💾 Triggering save...');
    const saveBtn = page.locator('[data-testid="save-all-btn"]');
    await saveBtn.click();

    // 4. Verify UI Feedback
    console.log('⏳ Verifying UI feedback...');
    await expect(page.locator('[data-testid="status-saved"]')).toBeVisible({ timeout: 20000 });
    console.log('✅ UI reports success.');

    // 5. Verify Paperless-ngx DB (via docker exec)
    console.log('🔍 Verifying Paperless-ngx database state...');
    const dbTitle = execSync(`docker exec paperless_db psql -U elfman -d paperless -t -c "SELECT title FROM documents_document WHERE id = 47;"`).toString().trim();
    console.log(`DB Title: "${dbTitle}"`);
    expect(dbTitle).toBe(testTitle);

    console.log('✨ Simple persistence check passed for Document 47.');
  });
});
