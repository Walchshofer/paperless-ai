const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to login...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'elfman');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for chat page...');
    await page.waitForURL('**/chat', { timeout: 10000 });
    await page.waitForTimeout(3000);

    console.log('\n=== Checking UI Elements ===\n');

    // Check main dropdown
    const mainDropdown = await page.locator('#chat-document-select').count();
    console.log(`Main document dropdown (#1): ${mainDropdown > 0 ? '✓ FOUND' : '✗ NOT FOUND'}`);

    // Check for duplicate dropdowns in sidebar
    const allSelects = await page.locator('select').all();
    console.log(`\nTotal <select> elements on page: ${allSelects.length}`);
    
    for (let i = 0; i < allSelects.length; i++) {
      const testId = await allSelects[i].getAttribute('data-testid');
      const id = await allSelects[i].getAttribute('id');
      const parentClass = await allSelects[i].evaluate(el => el.closest('[class*="sidebar"]') ? 'IN SIDEBAR' : 'IN MAIN');
      console.log(`  ${i + 1}. id="${id}" data-testid="${testId}" ${parentClass}`);
    }

    // Check for title display
    const titleDisplay = await page.locator('[data-testid="chat-document-title"]').count();
    console.log(`\nDocument title display (#3): ${titleDisplay > 0 ? '✓ FOUND' : '✗ NOT FOUND'}`);

    if (titleDisplay > 0) {
      const titleText = await page.locator('[data-testid="chat-document-title"]').first().textContent();
      console.log(`  Content: "${titleText}"`);
    }

    // Take screenshots
    console.log('\nTaking screenshots...');
    await page.screenshot({ path: 'ui-check-full.png', fullPage: true });
    console.log('  ✓ Saved: ui-check-full.png');

    const sidebar = page.locator('.sidebar-content').first();
    if (await sidebar.count() > 0) {
      await sidebar.screenshot({ path: 'ui-check-sidebar.png' });
      console.log('  ✓ Saved: ui-check-sidebar.png');
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Expected: 1 dropdown (main), 0 in sidebar, 1 title display`);
    console.log(`Actual: ${allSelects.length} dropdown(s) total, ${titleDisplay} title display(s)`);
    
    const sidebarDropdowns = allSelects.filter(async (sel) => {
      return await sel.evaluate(el => el.closest('[class*="sidebar"]') !== null);
    });
    
    if (allSelects.length === 1 && titleDisplay > 0) {
      console.log('\n✓✓✓ UI CHANGES VERIFIED SUCCESSFULLY ✓✓✓');
    } else {
      console.log('\n⚠ UI may still have issues - check screenshots');
    }

    console.log('\nKeeping browser open for 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: 'ui-check-error.png' });
  } finally {
    await browser.close();
  }
})();
