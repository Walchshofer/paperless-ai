import { test, expect } from '@playwright/test';

test.describe('Settings Prompts & AI Provider Audit', () => {
  test('Capture AI Provider and Prompts sections', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('BROWSER ERROR:', msg.text());
      } else {
        console.log('BROWSER LOG:', msg.text());
      }
    });

    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'elfman');
    await page.fill('input[name="password"]', 'P2tr3ck!1976');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 30000 });

    // Go to settings
    await page.goto('http://localhost:3000/settings', { waitUntil: 'networkidle' });
    
    // Enable developer mode
    console.log('Enabling developer mode...');
    const devToggle = page.locator('[data-testid="developer-toggle"]');
    await expect(devToggle).toBeVisible({ timeout: 30000 });
    await devToggle.click();

    // 1. Audit AI Provider
    console.log('Navigating to AI Provider...');
    await page.click('[data-testid="category-ai-provider"]');
    
    // Wait for hydration
    const islandEl = page.locator('[data-island="ai-provider-island"]');
    await expect(islandEl).toHaveAttribute('data-mounted', 'true', { timeout: 60000 });

    // Switch to Ollama tab - EXTREME
    console.log('Switching to Ollama tab...');
    const ollamaTab = page.locator('[data-testid="tab-ollama"]');
    await expect(ollamaTab).toBeVisible({ timeout: 30000 });
    
    // Direct JS click and state check
    await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="tab-ollama"]') as HTMLElement;
        if (btn) {
            btn.click();
            console.log('Ollama tab clicked via evaluate');
        }
    });
    
    // Wait for content to render
    console.log('Waiting for Ollama tab content...');
    const ollamaContent = page.locator('[data-testid="tab-content-ollama"]');
    
    // Try one more time if not visible
    for (let i = 0; i < 5; i++) {
        if (await ollamaContent.isVisible()) break;
        console.log(`Retry ${i+1} to show Ollama content...`);
        await page.evaluate(() => { (document.querySelector('[data-testid="tab-ollama"]') as HTMLElement)?.click(); });
        await page.waitForTimeout(2000);
    }

    await expect(ollamaContent).toBeVisible({ timeout: 15000 });
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/audit-ai-provider-final.png', fullPage: true });

    // 2. Audit Prompts & Cyber-Lab
    console.log('Navigating to Prompts...');
    await page.click('[data-testid="category-prompts"]');
    await expect(page).toHaveURL(/#prompts/);
    
    // Wait for prompts island
    const promptsIsland = page.locator('[data-island="prompts-settings-island"]');
    await expect(promptsIsland).toHaveAttribute('data-mounted', 'true', { timeout: 60000 });
    
    // Open Router editor
    const routerRow = page.locator('[data-testid="prompt-row-sys-router"]');
    await expect(routerRow).toBeVisible({ timeout: 30000 });
    await routerRow.click();
    
    // 3. Verify Cyber-Lab Document Injection
    console.log('Opening Test Modal...');
    // The play icon button in the editor row
    const testTrigger = page.locator('button >> i.fa-flask').first().locator('xpath=..');
    await expect(testTrigger).toBeVisible({ timeout: 30000 });
    await testTrigger.click();

    await expect(page.locator('[data-testid="prompt-test-modal"]')).toBeVisible({ timeout: 30000 });
    
    console.log('Switching to Real Document source...');
    await page.click('button:has-text("Real Document")');
    
    console.log('Verifying Document Picker presence...');
    await expect(page.locator('label:has-text("Select Test Subject")')).toBeVisible({ timeout: 15000 });
    
    await page.screenshot({ path: 'test-results/audit-cyber-lab-final.png', fullPage: true });
  });
});
