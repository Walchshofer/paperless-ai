import { test, expect } from '@playwright/test';

test.describe('Connection Center Visual Verification', () => {
  test.setTimeout(60000); // Increase timeout to 60s

  test('Verify Connection Center layout and context-aware greying', async ({ page }) => {
    // 1. Navigate to settings with higher timeout and networkidle
    console.log('Navigating to settings...');
    await page.goto('http://localhost:3000/settings', { 
        timeout: 45000,
        waitUntil: 'networkidle' 
    });
    
    console.log('Page loaded, URL:', page.url());
    console.log('Title:', await page.title());

    // Ensure the settings sidebar island is mounted
    const sidebar = page.locator('[data-island="settings-sidebar-island"]');
    await expect(sidebar).toHaveAttribute('data-mounted', 'true', { timeout: 30000 });

    // 2. Click the Connection tab explicitly
    const connectionTabBtn = page.locator('[data-testid="category-connection"]');
    await connectionTabBtn.click();

    // 3. Wait for the connection section to be visible
    const connectionSection = page.locator('[data-settings-category="connection"]');
    await expect(connectionSection).not.toHaveClass(/hidden/, { timeout: 10000 });

    // 4. Initial State Check for the island
    const islandRoot = page.locator('[data-island="connection-settings-island"]');
    await expect(islandRoot).toHaveAttribute('data-mounted', 'true', { timeout: 15000 });
    
    const root = page.locator('[data-testid="connection-settings-root"]');
    await expect(root).toBeVisible({ timeout: 10000 });
    
    // Check if the lightbulb tip is present
    await expect(page.locator('text=Settings are context-aware')).toBeVisible();

    // 5. Capture baseline screenshot
    await page.screenshot({ path: 'test-results/visual/connection-center-initial.png', fullPage: true });

    // 6. Switch to AI tab and change provider
    await page.click('[data-testid="category-ai-provider"]');
    const providerSelect = page.locator('[data-testid="provider-select"]');
    await expect(providerSelect).toBeVisible();
    
    // Switch to Azure
    await providerSelect.selectOption('azure');
    
    // 7. Switch back to Connection Center and verify visual change
    await page.click('[data-testid="category-connection"]');
    
    // Wait for the "Azure OpenAI" box to be enabled (active)
    const azureBox = page.locator('.p-4.rounded-lg.border:has-text("Azure OpenAI")');
    await expect(azureBox).toBeVisible({ timeout: 10000 });
    
    // Verify the "Active" badge exists on the Azure box
    const activeBadge = azureBox.locator('span:has-text("Active")');
    await expect(activeBadge).toBeVisible();

    // Capture screenshot to verify Azure is highlighted and others are greyed
    await page.screenshot({ path: 'test-results/visual/connection-center-azure-active.png', fullPage: true });
  });
});
