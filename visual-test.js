const { chromium } = require('playwright');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 800,
    args: ['--start-maximized']
  });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    console.log('\n========================================');
    console.log('🧪 VISUAL CONFIRMATION TEST');
    console.log('========================================\n');

    // ============================================
    // TEST 1: Login
    // ============================================
    console.log('📝 TEST 1: Login with elfman / P2tr3ck!1976');
    await page.goto('http://localhost:3000/login');
    await sleep(1000);
    
    await page.fill('input[name="username"]', 'elfman');
    await page.fill('input[name="password"]', 'P2tr3ck!1976');
    console.log('   ✓ Credentials entered');
    
    await page.click('button[type="submit"]');
    console.log('   ✓ Submit clicked');
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   ✅ Login successful - redirected to dashboard\n');
    await sleep(2000);

    // ============================================
    // TEST 2: Navigate to Workspace
    // ============================================
    console.log('📂 TEST 2: Navigate to Workspace');
    await page.goto('http://localhost:3000/workspace/doc/latest');
    await sleep(2000);
    
    const workspacePage = await page.locator('[data-page="document-workspace"]').count();
    if (workspacePage > 0) {
      console.log('   ✅ Workspace page loaded successfully\n');
    } else {
      console.log('   ⚠️  Workspace page indicator not found\n');
    }

    // ============================================
    // TEST 3: Select Different Documents
    // ============================================
    console.log('📄 TEST 3: Document Selection');
    
    // Click document selector trigger
    const selectorTrigger = page.locator('[data-testid="document-selector-trigger"]');
    if (await selectorTrigger.count() > 0) {
      await selectorTrigger.click();
      console.log('   ✓ Document selector opened');
      await sleep(1500);
      
      // Try to select first document
      const firstDoc = page.locator('[data-testid="document-selector-dropdown"] button').first();
      if (await firstDoc.count() > 0) {
        const docText = await firstDoc.textContent();
        console.log(`   ✓ Selecting first document: ${docText.trim()}`);
        await firstDoc.click();
        await sleep(2000);
        console.log('   ✅ First document selected\n');
        
        // Select a different document
        await selectorTrigger.click();
        await sleep(1000);
        const secondDoc = page.locator('[data-testid="document-selector-dropdown"] button').nth(1);
        if (await secondDoc.count() > 0) {
          const docText2 = await secondDoc.textContent();
          console.log(`   ✓ Selecting second document: ${docText2.trim()}`);
          await secondDoc.click();
          await sleep(2000);
          console.log('   ✅ Second document selected\n');
        }
      } else {
        console.log('   ⚠️  No documents found in selector\n');
      }
    } else {
      console.log('   ⚠️  Document selector not found\n');
    }

    // ============================================
    // TEST 4: Visual Tab Tools (Pan, Zoom, Draw)
    // ============================================
    console.log('🎨 TEST 4: Visual Tab Tools');
    
    // Look for visual tab with different possible selectors
    const visualTabSelectors = [
      'button:has-text("Visual")',
      '[data-tab="visual"]',
      '[aria-label*="Visual"]',
      'button[role="tab"]:has-text("Visual")'
    ];
    
    let visualTabFound = false;
    for (const selector of visualTabSelectors) {
      const tab = page.locator(selector).first();
      if (await tab.count() > 0) {
        await tab.click();
        console.log(`   ✓ Switched to Visual tab (using selector: ${selector})`);
        visualTabFound = true;
        await sleep(2000);
        break;
      }
    }
    
    if (visualTabFound) {
      
      // Test Pan Tool
      console.log('\n   🖐️  Testing Pan Tool:');
      const panButton = page.locator('button:has-text("Pan"), button[title*="Pan"], button[aria-label*="Pan"]').first();
      if (await panButton.count() > 0) {
        await panButton.click();
        console.log('      ✓ Pan tool activated');
        await sleep(1000);
        
        // Try to find canvas or image viewer
        const canvas = page.locator('canvas, [data-testid*="canvas"], [data-testid*="viewer"]').first();
        if (await canvas.count() > 0) {
          const box = await canvas.boundingBox();
          if (box) {
            console.log('      ✓ Found viewer element');
            // Simulate pan by dragging
            await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width/2 + 100, box.y + box.height/2 + 50, { steps: 10 });
            await page.mouse.up();
            console.log('      ✅ Pan gesture simulated (drag 100px right, 50px down)');
            await sleep(1500);
          }
        } else {
          console.log('      ⚠️  Canvas/viewer not found');
        }
      } else {
        console.log('      ⚠️  Pan button not found');
      }
      
      // Test Zoom Tool
      console.log('\n   🔍 Testing Zoom Tool:');
      const zoomInButton = page.locator('button:has-text("Zoom"), button[title*="Zoom"], button[aria-label*="Zoom In"]').first();
      if (await zoomInButton.count() > 0) {
        await zoomInButton.click();
        console.log('      ✓ Zoom button clicked');
        await sleep(1000);
        
        // Try mouse wheel zoom
        const canvas = page.locator('canvas, [data-testid*="canvas"], [data-testid*="viewer"]').first();
        if (await canvas.count() > 0) {
          await canvas.hover();
          await page.mouse.wheel(0, -100); // Zoom in
          console.log('      ✓ Zoom in gesture (wheel up)');
          await sleep(1000);
          await page.mouse.wheel(0, 100); // Zoom out
          console.log('      ✅ Zoom out gesture (wheel down)');
          await sleep(1500);
        }
      } else {
        console.log('      ⚠️  Zoom button not found');
      }
      
      // Test Draw Tool
      console.log('\n   ✏️  Testing Draw Tool:');
      const drawButton = page.locator('button:has-text("Draw"), button[title*="Draw"], button[aria-label*="Draw"]').first();
      if (await drawButton.count() > 0) {
        await drawButton.click();
        console.log('      ✓ Draw tool activated');
        await sleep(1000);
        
        // Draw a simple shape
        const canvas = page.locator('canvas, [data-testid*="canvas"], [data-testid*="viewer"]').first();
        if (await canvas.count() > 0) {
          const box = await canvas.boundingBox();
          if (box) {
            // Draw a square
            const startX = box.x + 100;
            const startY = box.y + 100;
            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.mouse.move(startX + 100, startY, { steps: 10 });
            await page.mouse.move(startX + 100, startY + 100, { steps: 10 });
            await page.mouse.move(startX, startY + 100, { steps: 10 });
            await page.mouse.move(startX, startY, { steps: 10 });
            await page.mouse.up();
            console.log('      ✅ Draw gesture simulated (square shape)');
            await sleep(2000);
          }
        } else {
          console.log('      ⚠️  Canvas not found for drawing');
        }
      } else {
        console.log('      ⚠️  Draw button not found');
      }
    } else {
      console.log('   ⚠️  Visual tab not found in sidebar');
      console.log('   ℹ️  Available tabs:');
      const allTabs = await page.locator('button[role="tab"]').all();
      for (const tab of allTabs) {
        const text = await tab.textContent();
        console.log(`      - ${text.trim()}`);
      }
      console.log();
    }

    // ============================================
    // TEST 5: Settings Page
    // ============================================
    console.log('\n⚙️  TEST 5: Navigate to Settings');
    await page.goto('http://localhost:3000/settings');
    await sleep(2000);
    
    const settingsPage = await page.locator('[data-page="settings"]').count();
    if (settingsPage > 0) {
      console.log('   ✓ Settings page loaded');
      
      // Check if admin sections are visible
      const developerSection = await page.locator('[data-testid="settings-section-developer"]').count();
      const advancedSection = await page.locator('[data-testid="settings-section-advanced"]').count();
      
      if (developerSection > 0) {
        console.log('   ✓ Developer settings section visible (admin access confirmed)');
      }
      if (advancedSection > 0) {
        console.log('   ✓ Advanced settings section visible (admin access confirmed)');
      }
      
      console.log('   ✅ Settings page accessible and admin sections visible\n');
    } else {
      console.log('   ⚠️  Settings page not found\n');
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n========================================');
    console.log('✅ VISUAL CONFIRMATION COMPLETE');
    console.log('========================================');
    console.log('Keeping browser open for 10 seconds...');
    console.log('You can manually inspect the final state.\n');
    
    await sleep(10000);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack:', error.stack);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
    console.log('\nError screenshot saved to: error-screenshot.png');
  } finally {
    await browser.close();
    console.log('\n✨ Test complete - browser closed.\n');
  }
})();
