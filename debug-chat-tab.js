const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'elfman');
    await page.fill('input[name="password"]', 'P2tr3ck!1976');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to workspace with cache buster
    await page.goto(`http://localhost:3000/workspace/doc/latest?_cb=${Date.now()}`);
    await page.waitForTimeout(3000);

    // Select a document
    const selector = page.locator('[data-testid="document-selector-trigger"]');
    if (await selector.count() > 0) {
      await selector.click();
      await page.waitForTimeout(1000);
      await page.locator('[data-testid="document-selector-dropdown"] button').first().click();
      await page.waitForTimeout(2000);
    }

    // Switch to Chat tab
    await page.locator('button[role="tab"]:has-text("Chat")').click();
    await page.waitForTimeout(2000);

    console.log('\n========================================');
    console.log('🔍 DEBUGGING CHAT TAB HTML');
    console.log('========================================\n');

    // Get the chat tab panel HTML
    const allSelects = await page.locator('select').all();
    console.log(`Total <select> elements: ${allSelects.length}\n`);
    
    for (let i = 0; i < allSelects.length; i++) {
      const id = await allSelects[i].getAttribute('id');
      const testId = await allSelects[i].getAttribute('data-testid');
      const outerHTML = await allSelects[i].evaluate(el => el.outerHTML.substring(0, 200));
      console.log(`${i + 1}. id="${id}", data-testid="${testId}"`);
      console.log(`   ${outerHTML}...\n`);
    }

    // Look for title display
    const titleDisplay = await page.locator('[data-testid="chat-document-title"]').count();
    console.log(`\n[data-testid="chat-document-title"] count: ${titleDisplay}`);

    // Check loaded JS files
    console.log('\n========================================');
    console.log('📦 LOADED JAVASCRIPT FILES');
    console.log('========================================\n');
    
    const scripts = await page.locator('script[src]').all();
    for (const script of scripts) {
      const src = await script.getAttribute('src');
      if (src && (src.includes('chat') || src.includes('sidebar'))) {
        console.log(`  ${src}`);
      }
    }

    console.log('\n\nKeeping browser open for manual inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await browser.close();
  }
})();
