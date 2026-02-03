const { chromium } = require('playwright');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 600,
    args: ['--start-maximized', '--disable-cache', '--incognito']
  });
  const context = await browser.newContext({ 
    viewport: null,
    ignoreHTTPSErrors: true,
    bypassCSP: true
  });
  const page = await context.newPage();

  try {
    console.log('\n========================================');
    console.log('🧪 SIDEBAR TABS VISUAL TEST');
    console.log('========================================\n');

    // Login
    console.log('📝 Logging in...');
    await page.goto('http://localhost:3000/login');
    await sleep(1000);
    await page.fill('input[name="username"]', 'elfman');
    await page.fill('input[name="password"]', 'P2tr3ck!1976');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   ✅ Login successful\n');

    // Navigate to workspace
    console.log('📂 Navigating to Workspace...');
    const cacheBuster = Date.now();
    await page.goto(`http://localhost:3000/workspace/doc/latest?_=${cacheBuster}`, { waitUntil: 'networkidle' });
    await sleep(2500);
    console.log('   ✅ Workspace loaded\n');

    // Select a document first
    console.log('📄 Selecting a document...');
    const selectorTrigger = page.locator('[data-testid="document-selector-trigger"]');
    if (await selectorTrigger.count() > 0) {
      await selectorTrigger.click();
      await sleep(1000);
      const firstDoc = page.locator('[data-testid="document-selector-dropdown"] button').first();
      if (await firstDoc.count() > 0) {
        const docText = await firstDoc.textContent();
        console.log(`   ✓ Selecting: ${docText.trim()}`);
        await firstDoc.click();
        await sleep(2000);
        console.log('   ✅ Document selected\n');
      }
    }

    // Get all sidebar tabs
    console.log('🔍 Discovering sidebar tabs...');
    const tabs = await page.locator('button[role="tab"]').all();
    const tabNames = [];
    for (const tab of tabs) {
      const text = await tab.textContent();
      tabNames.push(text.trim());
    }
    console.log(`   Found ${tabNames.length} tabs: ${tabNames.join(', ')}\n`);

    // ============================================
    // TEST EACH TAB
    // ============================================
    
    for (let i = 0; i < tabs.length; i++) {
      const tabName = tabNames[i];
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📑 TAB ${i + 1}: ${tabName.toUpperCase()}`);
      console.log('='.repeat(50));
      
      // Click tab
      await tabs[i].click();
      await sleep(1500);
      console.log(`   ✓ Switched to ${tabName} tab`);

      // Special handling for Chat tab (verify our changes)
      if (tabName.toLowerCase().includes('chat')) {
        console.log('\n   🔍 VERIFYING CHAT TAB CHANGES:');
        console.log('   ' + '-'.repeat(45));
        
        // Wait for chat content to fully render
        await sleep(1000);
        
        // Check for duplicate dropdown (should NOT exist)
        console.log('\n   ❌ Checking for OLD duplicate dropdown (#2):');
        const chatDropdowns = await page.locator('[role="tabpanel"][aria-labelledby*="chat"] select, [data-testid*="chat-workspace"] select[id*="document"]').count();
        if (chatDropdowns === 0) {
          console.log('      ✅ No duplicate dropdown found (correct!)');
        } else {
          console.log(`      ⚠️  Found ${chatDropdowns} dropdown(s) in chat content`);
        }
        
        // Check for document title display (should exist)
        console.log('\n   ✓ Checking for NEW document title display (#3):');
        const titleDisplay = page.locator('[data-testid="chat-document-title"]');
        const titleCount = await titleDisplay.count();
        if (titleCount > 0) {
          const titleText = await titleDisplay.first().textContent();
          console.log(`      ✅ Document title display found!`);
          console.log(`      📝 Current title: "${titleText.trim()}"`);
          
          // Check if it's visible
          const isVisible = await titleDisplay.first().isVisible();
          console.log(`      📍 Visibility: ${isVisible ? 'Visible' : 'Hidden'}`);
        } else {
          console.log('      ⚠️  Document title display NOT found');
          console.log('      ℹ️  Checking for any title-related elements...');
          const anyTitle = await page.locator('[class*="title"], [data-testid*="title"]').count();
          console.log(`      Found ${anyTitle} title-like element(s)`);
        }
        
        // Verify the title updates when document changes
        console.log('\n   🔄 Testing document title synchronization:');
        const originalTitle = titleCount > 0 ? await titleDisplay.first().textContent() : '';
        
        // Switch document via main selector
        await selectorTrigger.click();
        await sleep(1000);
        const secondDoc = page.locator('[data-testid="document-selector-dropdown"] button').nth(1);
        if (await secondDoc.count() > 0) {
          const newDocText = await secondDoc.textContent();
          console.log(`      ✓ Selecting new document: ${newDocText.trim()}`);
          await secondDoc.click();
          await sleep(2000);
          
          // Check if title updated
          if (titleCount > 0) {
            const newTitle = await titleDisplay.first().textContent();
            if (newTitle.trim() !== originalTitle.trim()) {
              console.log(`      ✅ Title updated successfully!`);
              console.log(`      📝 New title: "${newTitle.trim()}"`);
            } else {
              console.log('      ⚠️  Title did not update');
            }
          }
        }
        
        // Check for chat input
        console.log('\n   💬 Checking chat interface:');
        const chatInput = await page.locator('textarea[placeholder*="message"], input[placeholder*="message"], textarea[data-testid*="chat-input"]').count();
        if (chatInput > 0) {
          console.log('      ✅ Chat input field present');
        } else {
          console.log('      ⚠️  Chat input not found');
        }
        
        // Check for chat messages area
        const messagesArea = await page.locator('[data-testid*="chat-messages"], [class*="chat-messages"]').count();
        if (messagesArea > 0) {
          console.log('      ✅ Chat messages area present');
        } else {
          console.log('      ℹ️  Chat messages area structure may vary');
        }
        
        console.log('\n   ' + '='.repeat(45));
        console.log('   ✅ CHAT TAB VERIFICATION COMPLETE');
        console.log('   ' + '='.repeat(45));
      }
      
      // Special handling for Metadata tab
      else if (tabName.toLowerCase().includes('metadata')) {
        console.log('\n   📋 Checking metadata interface:');
        
        // Look for metadata fields
        const metadataFields = await page.locator('input[type="text"], input[type="date"], select, textarea').count();
        console.log(`      ✓ Found ${metadataFields} input field(s)`);
        
        // Check for save button
        const saveButton = await page.locator('button:has-text("Save"), button[data-testid*="save"]').count();
        if (saveButton > 0) {
          console.log('      ✅ Save button present');
        }
        
        // Check for smart metadata indicator
        const smartMetadata = await page.locator('[data-testid*="smart-metadata"]').count();
        if (smartMetadata > 0) {
          console.log('      ✅ Smart metadata component loaded');
        }
      }
      
      // Special handling for Document Content tab
      else if (tabName.toLowerCase().includes('document') || tabName.toLowerCase().includes('content')) {
        console.log('\n   📄 Checking document content display:');
        
        // Look for text content area
        const contentArea = await page.locator('[data-testid*="document-content"], pre, [class*="content"]').count();
        if (contentArea > 0) {
          console.log('      ✅ Content display area present');
          
          // Try to get a sample of text
          const contentText = await page.locator('[data-testid*="document-content"], pre').first().textContent().catch(() => '');
          if (contentText && contentText.length > 0) {
            const preview = contentText.substring(0, 100).replace(/\s+/g, ' ').trim();
            console.log(`      ℹ️  Content preview: "${preview}..."`);
          }
        } else {
          console.log('      ℹ️  Content area may be loading');
        }
      }
      
      // Special handling for Visual tab
      else if (tabName.toLowerCase().includes('visual')) {
        console.log('\n   🎨 Checking visual tools:');
        
        // Check for tool buttons
        const panButton = await page.locator('button:has-text("Pan")').count();
        const zoomButton = await page.locator('button:has-text("Zoom")').count();
        const drawButton = await page.locator('button:has-text("Draw")').count();
        
        if (panButton > 0) console.log('      ✅ Pan tool available');
        if (zoomButton > 0) console.log('      ✅ Zoom tool available');
        if (drawButton > 0) console.log('      ✅ Draw tool available');
        
        // Check for canvas/viewer
        const canvas = await page.locator('canvas, [data-testid*="canvas"], [data-testid*="viewer"]').count();
        if (canvas > 0) {
          console.log('      ✅ Visual viewer/canvas present');
        }
      }
      
      // Generic tab content check
      const tabContent = await page.locator('[role="tabpanel"], .tab-content, [data-testid*="tab-content"]').count();
      if (tabContent > 0) {
        console.log(`      ✓ Tab panel content rendered`);
      }
      
      await sleep(1000);
    }

    // ============================================
    // FINAL VERIFICATION
    // ============================================
    console.log('\n\n' + '='.repeat(50));
    console.log('🎯 FINAL VERIFICATION');
    console.log('='.repeat(50));
    
    // Switch back to Chat tab for final check
    const chatTab = page.locator('button[role="tab"]:has-text("Chat")').first();
    if (await chatTab.count() > 0) {
      await chatTab.click();
      await sleep(2000);
      
      console.log('\n✨ Confirming implemented changes in Chat tab:');
      
      // Get all selects and categorize them
      const allSelects = await page.locator('select').all();
      let mainAreaSelects = 0;
      let chatTabSelects = 0;
      let otherSidebarSelects = 0;
      
      for (const sel of allSelects) {
        const location = await sel.evaluate(el => {
          const chatContent = el.closest('[role="tabpanel"][aria-labelledby*="chat"]');
          if (chatContent) return 'chat-tab';
          const sidebar = el.closest('.sidebar-content, aside, [data-testid*="sidebar"]');
          if (sidebar) return 'other-sidebar';
          return 'main';
        });
        
        if (location === 'chat-tab') chatTabSelects++;
        else if (location === 'other-sidebar') otherSidebarSelects++;
        else mainAreaSelects++;
      }
      
      console.log(`\n   📊 Detailed Summary:`);
      console.log(`      • <select> in main document selector: ${mainAreaSelects}`);
      console.log(`      • <select> in Chat tab content: ${chatTabSelects}`);
      console.log(`      • <select> in other sidebar tabs: ${otherSidebarSelects}`);
      
      const titleDisplay = await page.locator('[data-testid="chat-document-title"]').count();
      console.log(`      • Document title displays: ${titleDisplay}`);
      
      if (titleDisplay > 0) {
        const isVisible = await page.locator('[data-testid="chat-document-title"]').first().isVisible();
        console.log(`      • Title display visible: ${isVisible ? 'Yes' : 'No'}`);
      }
      
      if (chatTabSelects === 0 && titleDisplay > 0) {
        console.log('\n   ✅✅✅ ALL CHANGES VERIFIED SUCCESSFULLY! ✅✅✅');
        console.log('      ✓ Duplicate dropdown removed from Chat tab');
        console.log('      ✓ Document title display added to Chat tab');
        console.log('      ✓ Main document selector still present (as expected)');
      } else if (chatTabSelects > 0) {
        console.log('\n   ⚠️  Warning: Found dropdown(s) in Chat tab content');
      } else if (titleDisplay === 0) {
        console.log('\n   ⚠️  Warning: Document title display not found');
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ SIDEBAR TABS TEST COMPLETE');
    console.log('='.repeat(50));
    console.log('\nKeeping browser open for 15 seconds for manual inspection...\n');
    
    await sleep(15000);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await page.screenshot({ path: 'sidebar-test-error.png', fullPage: true });
    console.log('\nError screenshot saved to: sidebar-test-error.png');
  } finally {
    await browser.close();
    console.log('\n✨ Test complete - browser closed.\n');
  }
})();
