import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Document 47 Persistence Test', () => {
  test('Verify full persistence stack on doc 47', async ({ page }) => {
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

    // 2. Modify Metadata
    console.log('✏️ Modifying metadata...');
    const titleInput = page.locator('[data-testid="smart-title-input"]');
    const originalTitle = await titleInput.inputValue();
    const testTitle = `${originalTitle} [TEST-PERSISTED]`;
    await titleInput.click();
    await titleInput.clear();
    await titleInput.type(testTitle, { delay: 50 });
    await titleInput.blur();

    const corrInput = page.locator('[data-testid="smart-correspondent-input"]');
    await corrInput.click();
    await corrInput.clear();
    await corrInput.type('HOFER XG', { delay: 50 });
    await corrInput.blur();

    const dateInput = page.locator('[data-testid="smart-createdDate-input"]');
    if (await dateInput.isVisible()) {
      await dateInput.click();
      await dateInput.clear();
      await dateInput.type('2025-12-06', { delay: 50 });
      await dateInput.blur();
    }

    // Wait for dirty state
    console.log('⏳ Waiting for dirty state...');
    await expect(page.locator('[data-testid="status-unsaved"]')).toBeVisible({ timeout: 20000 });

    // Add a tag if not present
    const tagSelect = page.locator('[data-testid="add-tag-select"]');
    if (await tagSelect.isVisible()) {
      await tagSelect.selectOption({ label: 'Ticket' });
    }

    // 3. Modify OCR Content
    console.log('📝 Modifying OCR content...');
    await page.click('[data-testid="tab-content"]');
    await expect(page.locator('[data-testid="document-content-island-root"]')).toBeVisible();
    
    await page.click('[data-testid="ocr-start-edit"]');
    const ocrTextarea = page.locator('[data-testid="ocr-edit-textarea"]');
    const currentOcr = await ocrTextarea.inputValue();
    await ocrTextarea.fill(`[OCR-TEST-PERSISTED] ${currentOcr}`);

    // 4. Save Changes
    console.log('💾 Triggering atomic save...');
    const saveBtn = page.locator('[data-testid="save-all-btn"]');
    await saveBtn.click();

    // 5. Verify UI Feedback
    console.log('⏳ Verifying UI feedback...');
    // The status badge should cycle through saved/unsaved/saved
    // We wait for the "Saved" badge to be visible again
    await expect(page.locator('[data-testid="status-saved"]')).toBeVisible({ timeout: 20000 });
    console.log('✅ UI reports success.');

    // 6. Verify Paperless-ngx DB (via docker exec)
    console.log('🔍 Verifying Paperless-ngx database state...');
    const dbTitle = execSync(`docker exec paperless_db psql -U elfman -d paperless -t -c "SELECT title FROM documents_document WHERE id = 47;"`).toString().trim();
    console.log(`DB Title: "${dbTitle}"`);
    expect(dbTitle).toContain('[TEST-PERSISTED]');

    // 7. Verify OCR Mirroring in Custom Fields
    console.log('🔍 Verifying OCR mirroring in Paperless-ngx custom fields...');
    const customFieldVal = execSync(`docker exec paperless_db psql -U elfman -d paperless -t -c "SELECT value_text FROM documents_customfieldvalue v JOIN documents_customfield f ON v.field_id = f.id WHERE v.document_id = 47 AND f.name = 'vis_ocr_text';"`).toString().trim();
    console.log(`Custom Field Value Snippet: "${customFieldVal.substring(0, 50)}..."`);
    expect(customFieldVal).toContain('[OCR-TEST-PERSISTED]');

    console.log('✨ All persistence checks passed for Document 47.');
  });
});
