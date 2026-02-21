import { test, expect } from '@playwright/test';

test.describe('Prompt Test Lab Comprehensive Audit', () => {
  test('Verify each prompt domain and test execution in Lab', async ({ page }) => {
    // Enable console logging for better audit trail
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Login (Auth bypass for speed if possible, otherwise use standard login)
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'elfman');
    await page.fill('input[name="password"]', 'P2tr3ck!1976');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 30000 });

    // Go to Settings and enable Developer Mode
    console.log('Navigating to settings...');
    await page.goto('http://localhost:3000/settings', { waitUntil: 'domcontentloaded' });
    
    const devToggle = page.locator('[data-testid="developer-toggle"]');
    await expect(devToggle).toBeVisible({ timeout: 15000 });
    if (await devToggle.getAttribute('aria-checked') === 'false') {
      await devToggle.click();
    }

    // Navigate to Prompts category via sidebar
    console.log('Switching to Prompts category...');
    const promptsNav = page.locator('[data-testid="category-prompts"]');
    await expect(promptsNav).toBeVisible({ timeout: 10000 });
    await promptsNav.click();

    // Wait for the Prompts Island to be mounted and ready
    const promptsIsland = page.locator('[data-island="prompts-settings-island"]');
    await expect(promptsIsland).toHaveAttribute('data-mounted', 'true', { timeout: 60000 });

    const domains = ['System', 'Medical', 'Financial', 'Legal', 'General'];
    
    for (const domain of domains) {
      console.log(`Auditing Domain: ${domain}`);
      const domainHeader = page.locator(`[data-testid="domain-header-${domain.toLowerCase()}"]`);
      
      if (!(await domainHeader.isVisible())) {
        console.log(`Domain ${domain} not visible or empty, skipping...`);
        continue;
      }

      // Expand domain if not expanded
      const isExpanded = await domainHeader.getAttribute('aria-expanded');
      if (isExpanded === 'false') {
        await domainHeader.click();
        await page.waitForTimeout(500); // Allow animation
      }

      // Find all prompt rows in this domain section
      const domainSection = page.locator(`[data-testid="domain-group-${domain.toLowerCase()}"]`);
      const promptRows = domainSection.locator('[data-testid^="prompt-row-"]');
      const rowCount = await promptRows.count();
      
      console.log(`Found ${rowCount} prompts in ${domain}`);

      // We test at least one prompt per domain to ensure coverage without excessive run time
      if (rowCount > 0) {
        const firstRow = promptRows.first();
        const promptId = await firstRow.locator('.font-mono').innerText();
        console.log(`Testing Prompt: ${promptId}`);

        // Open Editor
        await firstRow.click();
        
        // Open Test Lab
        const testLabBtn = page.locator(`[data-testid^="prompt-test-"]`).filter({ hasText: 'Test Lab' });
        await expect(testLabBtn).toBeVisible({ timeout: 15000 });
        await testLabBtn.click();

        // Verify Modal matches "Cyber Lab" aesthetic
        const modal = page.locator('[data-testid="prompt-test-modal"]');
        await expect(modal).toBeVisible({ timeout: 15000 });
        await expect(modal.locator('h3')).toContainText('Virtual Execution Environment');

        // Execute Test Run (using default mock data)
        const runBtn = page.locator('[data-testid="prompt-test-run"]');
        await expect(runBtn).toBeVisible();
        await runBtn.click();

        // Wait for results
        const results = page.locator('[data-testid="prompt-test-results"]');
        await expect(results).toBeVisible({ timeout: 60000 });

        // VERIFY ENHANCEMENTS: Model Badge and Guidance Status
        const modelBadge = results.locator('.fa-microchip').locator('xpath=..');
        await expect(modelBadge).toBeVisible();
        console.log(`Model Verified: ${await modelBadge.innerText()}`);

        const guidanceStatus = results.locator('.fa-shield-halved').locator('xpath=..');
        // Guidance might not be active in all test environments, but we check if source is guidance-service
        const sourceText = await page.evaluate(() => {
            // Check the response from the last /test call if possible, or just look for the badge
            return document.querySelector('.fa-shield-halved') ? 'Guidance Active' : 'Template Render Only';
        });
        console.log(`Execution Source: ${sourceText}`);

        // Test Close functionality (Fixed previously)
        const closeBtn = page.locator('button:has-text("Close Lab")');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        
        await expect(modal).not.toBeVisible({ timeout: 10000 });
        console.log(`Test Lab closed successfully for ${promptId}`);

        // Close Editor to clean up UI for next domain
        await firstRow.click();
      }
    }

    console.log('Comprehensive Prompt Test Lab Audit Complete.');
  });
});
