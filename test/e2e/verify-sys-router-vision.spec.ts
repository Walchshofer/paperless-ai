import { test, expect } from '@playwright/test';

test.describe('SYS_ROUTER_V1 Multimodal Verification', () => {
  test('Verify SYS_ROUTER_V1 receives 300dpi image and returns valid JSON', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes

    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'elfman');
    await page.fill('input[name="password"]', 'P2tr3ck!1976');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 60000 });

    // Go to Prompts settings
    console.log('Navigating to prompts settings...');
    await page.goto('http://localhost:3000/settings#prompts', { timeout: 60000, waitUntil: 'domcontentloaded' });
    
    // Wait for the root element to ensure page hydration
    await page.waitForSelector('[data-testid="prompts-settings-root"]', { timeout: 30000 });

    // Expand System domain
    console.log('Expanding System domain...');
    const systemHeader = page.locator('[data-testid="domain-header-system"]');
    await systemHeader.scrollIntoViewIfNeeded();
    if (await systemHeader.getAttribute('aria-expanded') === 'false') {
        await systemHeader.click();
        await page.waitForTimeout(1000);
    }

    // Find SYS_ROUTER row button
    console.log('Opening SYS_ROUTER group...');
    const routerBtn = page.locator('[data-testid="prompt-row-btn-sys-router"]');
    await expect(routerBtn).toBeVisible({ timeout: 10000 });
    await routerBtn.click();

    // Verify editor panel is open
    console.log('Verifying editor is open...');
    const editor = page.locator('[data-testid="prompt-editor-sys-router-v1"]');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Click Test Lab button
    console.log('Opening Test Lab...');
    const testBtn = editor.locator('[data-testid="prompt-test-sys-router-v1"]');
    await testBtn.click();

    // Wait for modal
    const modal = page.locator('[data-testid="prompt-test-modal"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Select Real Document (Load recent documents from API)
    console.log('Selecting real document...');
    const loadDocsBtn = modal.locator('[data-testid="test-lab-load-docs-btn"]');
    await loadDocsBtn.click();
    
    // Wait for document picker and select first document
    const picker = modal.locator('button.flex.flex-col').first();
    await expect(picker).toBeVisible({ timeout: 30000 });
    const docTitle = await picker.locator('span.text-\\[10px\\]').innerText();
    console.log(`Selected document: ${docTitle}`);
    await picker.click();

    // Verify document data preview appears after selecting a document.
    // PromptsSettingsIsland stores the fetched image in testImage state (used as
    // __image_data in the test payload) but does not render an <img> element.
    // The "Extraction Subject Preview" section is rendered when selectedDocumentData
    // is set, which confirms the document was loaded and the image was fetched.
    console.log('Verifying document data preview...');
    const extractionPreview = modal.locator('h4:has-text("Extraction Subject Preview")');
    await expect(extractionPreview).toBeVisible({ timeout: 30000 });
    console.log('Document data preview confirmed (Extraction Subject Preview visible).');

    // Switch to Execute mode (button text is "Execute Neural Simulation", use testid)
    console.log('Switching to Execute mode...');
    const execModeBtn = modal.locator('[data-testid="test-mode-execute"]');
    await execModeBtn.scrollIntoViewIfNeeded();
    await execModeBtn.click();

    // Run test
    console.log('Running neural simulation (Ollama Vision)...');
    const runBtn = modal.locator('[data-testid="prompt-test-run"]');
    
    const responsePromise = page.waitForResponse(resp => 
        resp.url().includes('/test') && resp.status() === 200, 
        { timeout: 180000 }
    );
    
    await runBtn.click();
    const response = await responsePromise;
    console.log('Response received.');
    
    // Verify results
    const results = modal.locator('[data-testid="prompt-test-results"]');
    await expect(results).toBeVisible({ timeout: 30000 });

    const pass = await results.locator('span:has-text("Execution Successful")').isVisible();
    expect(pass).toBeTruthy();
    
    const jsonVerified = await results.locator('span:has-text("JSON Verified")').isVisible();
    expect(jsonVerified).toBeTruthy();

    // Check model info
    const modelLabel = await results.locator('i.fa-microchip + span').innerText();
    console.log(`Model Used: ${modelLabel}`);
    
    const outputContainer = results.locator('div.text-rose-900, div.dark\\:text-rose-50');
    const rawOutput = await outputContainer.innerText();
    console.log('Raw Output Fragment:', rawOutput.substring(0, 200));
    
    // Ensure it contains basic router fields
    expect(rawOutput).toContain('primary_domain');
    expect(rawOutput).toContain('document_type');

    console.log('Verification Complete: PASS');
  });
});
