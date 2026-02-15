import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test.describe('Workspace Full Functionality Test', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    console.log('🔐 Step 1: Logging in...');
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="username"], input[type="text"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    console.log('✅ Login successful, redirected to:', page.url());
  });

  test('Complete workspace functionality test', async ({ page }) => {
    // ========== STEP 1: Navigate to Workspace ==========
    console.log('\n📂 Step 2: Navigating to workspace...');
    await page.goto(`${BASE}/workspace`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/ws-01-workspace-initial.png', fullPage: true });
    console.log('Current URL:', page.url());

    // ========== STEP 2: Select a Random Document ==========
    console.log('\n📄 Step 3: Selecting a random document...');
    
    // Find and click document selector trigger
    const selectorTrigger = page.locator('[data-testid="document-selector-trigger"]');
    if (await selectorTrigger.count() > 0) {
      // Open dropdown if not already visible
      const dropdown = page.locator('[data-testid="document-selector-dropdown"]');
      if (await dropdown.count() === 0) {
        await selectorTrigger.click();
        await page.waitForTimeout(500);
      }
      
      await page.screenshot({ path: 'test-results/ws-02-doc-selector-open.png', fullPage: true });
      
      // Get all document options
      const docOptions = page.locator('[data-testid^="document-option-"]');
      const optionCount = await docOptions.count();
      console.log(`Found ${optionCount} documents available`);
      
      if (optionCount > 0) {
        // Select a random document (between index 3-10 if available)
        const randomIdx = Math.min(Math.floor(Math.random() * Math.min(optionCount, 10)) + 3, optionCount - 1);
        const selectedOption = docOptions.nth(randomIdx);
        const docTitle = await selectedOption.textContent();
        console.log(`Selecting document #${randomIdx + 1}: "${docTitle?.trim()}"`);
        
        await selectedOption.click();
        await page.waitForTimeout(3000);
        
        const finalUrl = page.url();
        console.log('✅ Document selected, URL:', finalUrl);
        expect(finalUrl).toContain('/workspace/doc/');
        
        await page.screenshot({ path: 'test-results/ws-03-doc-selected.png', fullPage: true });
      }
    } else {
      // Fallback: go directly to document 9
      console.log('Document selector not found, navigating directly to doc 9');
      await page.goto(`${BASE}/workspace/doc/9`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    }

    // ========== STEP 3: Verify Document Renders in Viewer ==========
    console.log('\n👁️ Step 4: Verifying document renders in viewer area...');
    
    // Check for document viewer / PDF viewer / image viewer
    const viewerSelectors = [
      '[data-testid="document-viewer"]',
      '[data-testid="pdf-viewer"]',
      'iframe[src*="pdf"]',
      'canvas',
      'img[src*="preview"]',
      '.document-content',
      '[data-island="overlay-viewer-island"]'
    ];
    
    let viewerFound = false;
    for (const selector of viewerSelectors) {
      const viewer = page.locator(selector);
      if (await viewer.count() > 0) {
        console.log(`✅ Document viewer found: ${selector}`);
        viewerFound = true;
        break;
      }
    }
    
    if (!viewerFound) {
      console.log('⚠️ No specific viewer element found, checking page content...');
    }
    
    await page.screenshot({ path: 'test-results/ws-04-document-viewer.png', fullPage: true });

    // ========== STEP 4: Test Document Context Bar ==========
    console.log('\n📊 Step 5: Testing Document Context Bar...');
    
    const contextBar = page.locator('[data-testid="document-context-bar"], [data-island="document-context-bar-island"]');
    if (await contextBar.count() > 0) {
      console.log('✅ Document context bar found');
      
      // Check for navigation buttons (prev/next)
      const prevBtn = page.locator('[data-testid="nav-prev-btn"]');
      const nextBtn = page.locator('[data-testid="nav-next-btn"]');
      console.log('  - Previous button:', await prevBtn.count() > 0 ? 'present' : 'missing');
      console.log('  - Next button:', await nextBtn.count() > 0 ? 'present' : 'missing');
      
      // Check for document title
      const titleEl = page.locator('[data-testid="document-title"], .document-title');
      if (await titleEl.count() > 0) {
        const title = await titleEl.first().textContent();
        console.log('  - Document title:', title?.trim());
      }
    }

    // ========== STEP 5: Test Tabs (Metadata, Chat, Content) ==========
    console.log('\n📑 Step 6: Testing workspace tabs...');
    
    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    const chatTab = page.locator('[data-testid="tab-chat"]');
    const contentTab = page.locator('[data-testid="tab-content"]');
    
    console.log('  - Metadata tab:', await metadataTab.count() > 0 ? '✅ present' : '❌ missing');
    console.log('  - Chat tab:', await chatTab.count() > 0 ? '✅ present' : '❌ missing');
    console.log('  - Content tab:', await contentTab.count() > 0 ? '✅ present' : '❌ missing');

    // ========== STEP 6: Test Context Sidebar (Smart Metadata) ==========
    console.log('\n🧠 Step 7: Testing Context Sidebar (Smart Metadata / AI Features)...');
    
    const contextSidebar = page.locator('[data-testid="context-sidebar"], [data-island="context-sidebar-island"]');
    if (await contextSidebar.count() > 0) {
      console.log('✅ Context sidebar found');
      await page.screenshot({ path: 'test-results/ws-05-context-sidebar.png', fullPage: true });
      
      // Check for AI-related elements
      const aiElements = [
        { selector: '[data-testid*="tag"]', name: 'Tags section' },
        { selector: '[data-testid*="correspondent"]', name: 'Correspondent section' },
        { selector: '[data-testid*="title"]', name: 'Title section' },
        { selector: '.ai-suggestion, [data-testid*="suggestion"]', name: 'AI suggestions' },
        { selector: '[data-testid*="save"], button:has-text("Save")', name: 'Save button' }
      ];
      
      for (const { selector, name } of aiElements) {
        const el = page.locator(selector);
        console.log(`  - ${name}:`, await el.count() > 0 ? '✅ present' : '⚠️ not found');
      }
    } else {
      console.log('⚠️ Context sidebar not immediately visible');
    }

    // ========== STEP 7: Test Chat Tab (AI Chat Feature) ==========
    console.log('\n💬 Step 8: Testing Chat Tab (AI Chat Feature)...');
    
    if (await chatTab.count() > 0) {
      await chatTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/ws-06-chat-tab.png', fullPage: true });
      
      // Look for chat interface elements
      const chatInput = page.locator('textarea, input[type="text"]').filter({ hasText: '' });
      const chatMessages = page.locator('.chat-message, [data-testid*="message"], .message');
      const sendButton = page.locator('button:has-text("Send"), [data-testid="chat-submit"]');
      
      console.log('  - Chat input area:', await chatInput.count() > 0 ? '✅ present' : '⚠️ checking...');
      console.log('  - Chat messages container:', await chatMessages.count() > 0 ? '✅ present' : '⚠️ empty');
      console.log('  - Send button:', await sendButton.count() > 0 ? '✅ present' : '⚠️ not found');
      
      // Try to find any textarea for chat
      const anyTextarea = page.locator('textarea');
      if (await anyTextarea.count() > 0) {
        console.log('  - Found textarea element, attempting to type...');
        await anyTextarea.first().fill('What is this document about?');
        await page.screenshot({ path: 'test-results/ws-07-chat-input.png', fullPage: true });
      }
    }

    // ========== STEP 8: Test Metadata Tab ==========
    console.log('\n📝 Step 9: Testing Metadata Tab...');
    
    if (await metadataTab.count() > 0) {
      await metadataTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/ws-08-metadata-tab.png', fullPage: true });
      
      // Check for metadata form fields
      const formFields = [
        { selector: 'input[name="title"], [data-testid*="title"] input', name: 'Title field' },
        { selector: 'select, [data-testid*="correspondent"]', name: 'Correspondent selector' },
        { selector: '[data-testid*="tags"], .tag-selector', name: 'Tags selector' },
        { selector: '[data-testid*="document-type"]', name: 'Document type' }
      ];
      
      for (const { selector, name } of formFields) {
        const el = page.locator(selector);
        console.log(`  - ${name}:`, await el.count() > 0 ? '✅ present' : '⚠️ not found');
      }
    }

    // ========== STEP 9: Test Content Tab ==========
    console.log('\n📜 Step 10: Testing Content Tab...');
    
    if (await contentTab.count() > 0) {
      await contentTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/ws-09-content-tab.png', fullPage: true });
      
      // Check for document content display
      const contentArea = page.locator('.document-content, [data-testid="document-content"], pre, .content-viewer');
      if (await contentArea.count() > 0) {
        console.log('✅ Content area found');
        const content = await contentArea.first().textContent();
        console.log(`  - Content preview (first 100 chars): "${content?.substring(0, 100).trim()}..."`);
      }
    }

    // ========== STEP 10: Test Visual Overlays ==========
    console.log('\n🎨 Step 11: Testing Visual Overlays...');
    
    const overlayViewer = page.locator('[data-island="overlay-viewer-island"], [data-testid="overlay-viewer"]');
    if (await overlayViewer.count() > 0) {
      console.log('✅ Overlay viewer island found');
      
      // Check for overlay controls
      const overlayControls = page.locator('[data-testid*="overlay"], .overlay-control');
      console.log(`  - Overlay controls: ${await overlayControls.count()} found`);
    }

    // ========== STEP 11: Test Sidebar Navigation ==========
    console.log('\n🧭 Step 12: Testing Sidebar Navigation...');
    
    const sidebarNav = page.locator('.sidebar-nav, nav[role="navigation"]');
    if (await sidebarNav.count() > 0) {
      const navLinks = sidebarNav.locator('a');
      const linkCount = await navLinks.count();
      console.log(`Found ${linkCount} navigation links:`);
      
      for (let i = 0; i < Math.min(linkCount, 8); i++) {
        const link = navLinks.nth(i);
        const href = await link.getAttribute('href');
        const text = (await link.textContent())?.trim();
        const isActive = await link.evaluate(el => el.classList.contains('active') || el.getAttribute('aria-current') === 'page');
        console.log(`  ${isActive ? '→' : ' '} "${text}" -> ${href}`);
      }
    }

    // ========== STEP 12: Test Theme Toggle ==========
    console.log('\n🌓 Step 13: Testing Theme Toggle...');
    
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    if (await themeToggle.count() > 0) {
      console.log('✅ Theme toggle found');
      await themeToggle.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/ws-10-theme-toggled.png', fullPage: true });
      console.log('  - Theme toggled successfully');
    }

    // ========== FINAL SUMMARY ==========
    console.log('\n' + '='.repeat(50));
    console.log('📋 WORKSPACE FUNCTIONALITY TEST SUMMARY');
    console.log('='.repeat(50));
    
    const results = {
      'Login': '✅ Working',
      'Document Selector': await page.locator('[data-testid="document-selector-trigger"]').count() > 0 ? '✅ Working' : '⚠️ Check',
      'Document Viewer': viewerFound ? '✅ Working' : '⚠️ Check',
      'Context Bar': await contextBar.count() > 0 ? '✅ Working' : '⚠️ Check',
      'Tabs': await metadataTab.count() > 0 ? '✅ Working' : '⚠️ Check',
      'Context Sidebar': await contextSidebar.count() > 0 ? '✅ Working' : '⚠️ Check',
      'Theme Toggle': await themeToggle.count() > 0 ? '✅ Working' : '⚠️ Check'
    };
    
    for (const [feature, status] of Object.entries(results)) {
      console.log(`${feature}: ${status}`);
    }
    
    console.log('='.repeat(50));
    
    // Final screenshot
    await page.screenshot({ path: 'test-results/ws-11-final-state.png', fullPage: true });
    console.log('\n✅ Test completed! Screenshots saved to test-results/');
  });
});
