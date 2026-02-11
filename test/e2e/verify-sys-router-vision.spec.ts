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

    // Select Real Document
    console.log('Selecting real document...');
    await modal.getByRole('button', { name: 'Real Document' }).click();
    
    // Wait for document picker and select first document
    const picker = modal.locator('button.flex.flex-col').first();
    await expect(picker).toBeVisible({ timeout: 30000 });
    const docTitle = await picker.locator('span.text-\\[10px\\]').innerText();
    console.log(`Selected document: ${docTitle}`);
    await picker.click();

    // Verify image preview appears
    console.log('Verifying image preview...');
    const imagePreview = modal.locator('img[alt="Document Preview (300 DPI)"]');
    await expect(imagePreview).toBeVisible({ timeout: 30000 });
    
    // Check if the image source is valid (base64)
    const src = await imagePreview.getAttribute('src');
    expect(src).toContain('data:image/png;base64,');
    console.log('Image preview confirmed (base64 PNG).');

    // Switch to Execute mode
    console.log('Switching to Execute mode...');
    await modal.getByRole('button', { name: 'Execute', exact: true }).click();

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
