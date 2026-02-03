const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'elfman');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Go to chat page
    await page.goto('http://localhost:3000/chat');
    await page.waitForTimeout(3000);

    // Take screenshot of the whole page
    await page.screenshot({ path: 'ui-check-full.png', fullPage: true });
    console.log('Screenshot saved: ui-check-full.png');

    // Check for duplicate dropdowns
    const dropdowns = await page.locator('select[data-testid*="document"]').count();
    console.log(`\nFound ${dropdowns} document dropdown(s)`);

    // List all document dropdowns
    const allDropdowns = await page.locator('select').all();
    for (let i = 0; i < allDropdowns.length; i++) {
      const testId = await allDropdowns[i].getAttribute('data-testid');
      const id = await allDropdowns[i].getAttribute('id');
      console.log(`  Dropdown ${i + 1}: data-testid="${testId}", id="${id}"`);
    }

    // Check for document title displays
    const titleDisplays = await page.locator('[data-testid="selected-document-title"]').count();
    console.log(`\nFound ${titleDisplays} document title display(s)`);

    // Check sidebar structure
    console.log('\n=== Sidebar Structure ===');
    const sidebarSections = await page.locator('.sidebar-content [data-testid*="section"]').all();
    for (let section of sidebarSections) {
      const testId = await section.getAttribute('data-testid');
      console.log(`  Section: ${testId}`);
    }

    // Check what's in the header/workspace area
    console.log('\n=== Workspace Header ===');
    const workspaceSelectors = await page.locator('[data-testid*="workspace"]').all();
    for (let elem of workspaceSelectors) {
      const testId = await elem.getAttribute('data-testid');
      const tagName = await elem.evaluate(el => el.tagName);
      console.log(`  Element: <${tagName}> data-testid="${testId}"`);
    }

    await page.waitForTimeout(5000);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
