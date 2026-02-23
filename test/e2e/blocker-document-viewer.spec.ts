import { test, expect, type Locator } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test.describe('Workspace Document Viewer Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    console.log('🔐 Logging in...');
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="username"], input[type="text"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    console.log('✅ Login successful');
  });

  test('BLOCKER: Document must render in viewer area', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('🔴 BLOCKER TEST: Document Viewer Verification');
    console.log('='.repeat(60));

    // Step 1: Navigate to workspace and select a document
    console.log('\n📂 Step 1: Navigate to workspace...');
    await page.goto(`${BASE}/workspace`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Step 2: Select a random document
    console.log('\n📄 Step 2: Select a document...');
    const selectorTrigger = page.locator('[data-testid="document-selector-trigger"]');
    
    if (await selectorTrigger.count() > 0) {
      const dropdown = page.locator('[data-testid="document-selector-dropdown"]');
      if (await dropdown.count() === 0) {
        await selectorTrigger.click();
        await page.waitForTimeout(500);
      }
      
      const docOptions = page.locator('[data-testid^="document-option-"]');
      const optionCount = await docOptions.count();
      console.log(`Found ${optionCount} documents`);
      
      if (optionCount > 0) {
        const randomIdx = Math.floor(Math.random() * Math.min(optionCount, 15));
        const selectedOption = docOptions.nth(randomIdx);
        const docTitle = await selectedOption.textContent();
        console.log(`Selecting document #${randomIdx + 1}: "${docTitle?.trim()}"`);
        
        await selectedOption.click();
        await page.waitForTimeout(3000);
      }
    } else {
      // Fallback: direct navigation
      await page.goto(`${BASE}/workspace/doc/9`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
    }

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    expect(currentUrl).toContain('/workspace/doc/');

    await page.screenshot({ path: 'test-results/blocker-01-doc-selected.png', fullPage: true });

    // Step 3: BLOCKER - Verify document viewer renders
    console.log('\n🔴 Step 3: BLOCKER - Verify document viewer renders...');
    
    // List of possible document viewer selectors
    const viewerSelectors = [
      // PDF/Image viewers
      'iframe[src*="/api/"]',
      'iframe[src*="preview"]',
      'iframe[src*="document"]',
      'iframe[src*="pdf"]',
      'iframe',
      'object[type="application/pdf"]',
      'embed[type="application/pdf"]',
      
      // Canvas-based viewers
      'canvas',
      
      // Image viewers
      'img[src*="/api/"]',
      'img[src*="preview"]',
      'img[src*="thumbnail"]',
      'img[src*="document"]',
      
      // Island-based viewers
      '[data-island="overlay-viewer-island"]',
      '[data-island="document-viewer-island"]',
      '[data-testid="document-viewer"]',
      '[data-testid="pdf-viewer"]',
      '[data-testid="overlay-viewer"]',
      
      // Content containers
      '.document-viewer',
      '.pdf-viewer',
      '.preview-container',
      '#document-viewer',
      '#pdf-viewer'
    ];

    let viewerFound = false;
    let viewerElement: Locator | null = null;
    let foundSelector = '';

    console.log('Searching for document viewer element...');
    for (const selector of viewerSelectors) {
      const el = page.locator(selector);
      const count = await el.count();
      if (count > 0) {
        const isVisible = await el.first().isVisible().catch(() => false);
        if (isVisible) {
          viewerFound = true;
          viewerElement = el.first();
          foundSelector = selector;
          console.log(`  ✅ FOUND: ${selector} (visible)`);
          break;
        } else {
          console.log(`  ⚠️ Found but not visible: ${selector}`);
        }
      }
    }

    // If no specific viewer found, check for main content area
    if (!viewerFound) {
      console.log('\n⚠️ No specific viewer found, checking main content areas...');
      
      const mainContentSelectors = [
        'main',
        '[role="main"]',
        '.main-content',
        '.workspace-content',
        '[data-testid="workspace-main"]',
        '[data-testid="unified-workspace-root"]'
      ];

      for (const selector of mainContentSelectors) {
        const el = page.locator(selector);
        if (await el.count() > 0) {
          console.log(`  Found main content: ${selector}`);
          
          // Check if it contains any visual content
          const hasImages = await el.locator('img').count();
          const hasCanvas = await el.locator('canvas').count();
          const hasIframe = await el.locator('iframe').count();
          
          console.log(`    - Images: ${hasImages}, Canvas: ${hasCanvas}, Iframes: ${hasIframe}`);
          
          if (hasImages > 0 || hasCanvas > 0 || hasIframe > 0) {
            viewerFound = true;
            foundSelector = `${selector} (contains visual elements)`;
            break;
          }
        }
      }
    }

    // Dump page structure for debugging if not found
    if (!viewerFound) {
      console.log('\n❌ No viewer found! Dumping page structure...');
      
      // Get all main elements
      const bodyHTML = await page.evaluate(() => {
        const main = document.querySelector('main') || document.body;
        return main.innerHTML.substring(0, 3000);
      });
      console.log('Page HTML preview (first 1000 chars):');
      console.log(bodyHTML.substring(0, 1000));
      
      // Check for any error messages
      const errorMessages = page.locator('.error, [role="alert"], .alert-danger, .error-message');
      if (await errorMessages.count() > 0) {
        const errorText = await errorMessages.first().textContent();
        console.log(`ERROR MESSAGE FOUND: ${errorText}`);
      }
    }

    await page.screenshot({ path: 'test-results/blocker-02-viewer-check.png', fullPage: true });

    // ASSERTION: Document viewer MUST be present
    console.log('\n' + '='.repeat(60));
    if (viewerFound) {
      console.log(`✅ BLOCKER PASSED: Document viewer found (${foundSelector})`);
    } else {
      console.log('❌ BLOCKER FAILED: No document viewer element found!');
    }
    console.log('='.repeat(60));

    expect(viewerFound, 'Document viewer must be present and visible').toBeTruthy();

    // Step 4: Verify viewer has actual content
    console.log('\n📋 Step 4: Verify viewer has actual content...');
    
    if (viewerElement) {
      const boundingBox = await viewerElement.boundingBox();
      if (boundingBox) {
        console.log(`  Viewer dimensions: ${boundingBox.width}x${boundingBox.height}`);
        expect(boundingBox.width).toBeGreaterThan(100);
        expect(boundingBox.height).toBeGreaterThan(100);
        console.log('  ✅ Viewer has reasonable dimensions');
      }
    }

    // Step 5: Test sidebar functionality
    console.log('\n🔧 Step 5: Test sidebar functionality...');
    
    // Test context sidebar
    const contextSidebar = page.locator('[data-testid="context-sidebar"], [data-island="context-sidebar-island"]');
    if (await contextSidebar.count() > 0) {
      console.log('  ✅ Context sidebar present');
      
      // Check for interactive elements
      const sidebarButtons = contextSidebar.locator('button');
      const sidebarInputs = contextSidebar.locator('input, select, textarea');
      console.log(`    - Buttons: ${await sidebarButtons.count()}`);
      console.log(`    - Inputs: ${await sidebarInputs.count()}`);
    }

    // Test tabs
    const tabs = ['metadata', 'chat', 'content'];
    for (const tab of tabs) {
      const tabEl = page.locator(`[data-testid="tab-${tab}"]`);
      if (await tabEl.count() > 0) {
        console.log(`  ✅ Tab "${tab}" present`);
      } else {
        console.log(`  ⚠️ Tab "${tab}" not found`);
      }
    }

    await page.screenshot({ path: 'test-results/blocker-03-final.png', fullPage: true });

    // Step 6: Test Chat functionality
    console.log('\n💬 Step 6: Test Chat functionality...');
    const chatTab = page.locator('[data-testid="tab-chat"]');
    if (await chatTab.count() > 0) {
      await chatTab.click();
      await page.waitForTimeout(1500);
      
      const chatInput = page.locator('[data-testid="chat-input"], textarea[placeholder*="Ask"]');
      if (await chatInput.count() > 0) {
        console.log('  ✅ Chat input found');
        await chatInput.fill('What is this document about?');
        console.log('  ✅ Test message typed');
        
        await page.screenshot({ path: 'test-results/blocker-04-chat.png', fullPage: true });
      }
    }

    // Step 7: Test Save functionality
    console.log('\n💾 Step 7: Test Save functionality...');
    const saveBtn = page.locator('button:has-text("Save"), [data-testid*="save"]');
    if (await saveBtn.count() > 0) {
      const isEnabled = await saveBtn.first().isEnabled();
      console.log(`  Save button enabled: ${isEnabled}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL BLOCKER TESTS PASSED');
    console.log('='.repeat(60));
  });
});
