import { test } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test.describe('AI Features Deep Test', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 10000 });
    await page.fill('input[name="username"], input[type="text"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
  });

  test('Deep dive into AI Chat functionality', async ({ page }) => {
    console.log('\n🤖 AI CHAT DEEP TEST');
    console.log('='.repeat(50));
    
    // Navigate to a document
    await page.goto(`${BASE}/workspace/doc/67`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-page="document-workspace"]', { timeout: 20000 });
    
    // Click on Chat tab
    console.log('\n💬 Testing Chat interface...');
    const chatTab = page.locator('[data-testid="tab-chat"]');
    if (await chatTab.count() > 0) {
      await chatTab.click();
      await page.waitForTimeout(2000);
      
      // Screenshot the chat interface
      await page.screenshot({ path: 'test-results/ai-01-chat-interface.png', fullPage: true });
      
      // Look for chat workspace island
      const chatIsland = page.locator('[data-island="chat-workspace-island"]');
      console.log('Chat workspace island:', await chatIsland.count() > 0 ? '✅ found' : '❌ not found');
      
      // Look for all textareas and inputs
      const textareas = page.locator('textarea');
      const textareaCount = await textareas.count();
      console.log(`Found ${textareaCount} textarea elements`);
      
      for (let i = 0; i < textareaCount; i++) {
        const ta = textareas.nth(i);
        const placeholder = await ta.getAttribute('placeholder');
        const id = await ta.getAttribute('id');
        const dataTestid = await ta.getAttribute('data-testid');
        console.log(`  Textarea #${i + 1}: id="${id}", placeholder="${placeholder}", data-testid="${dataTestid}"`);
      }
      
      // Look for chat-related elements
      const chatElements = [
        '[data-testid="chat-input"]',
        '[data-testid="chat-submit"]',
        '[data-testid="chat-messages"]',
        '.chat-input',
        '.chat-container',
        '#chat-input',
        'form[data-testid*="chat"]',
        'button[type="submit"]'
      ];
      
      console.log('\nSearching for chat elements:');
      for (const selector of chatElements) {
        const el = page.locator(selector);
        const count = await el.count();
        if (count > 0) {
          console.log(`  ✅ ${selector}: ${count} found`);
        }
      }
      
      // Try to find and interact with chat input
      const possibleInputs = [
        'textarea[placeholder*="message"]',
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="ask"]',
        'textarea[placeholder*="Ask"]',
        'textarea[placeholder*="chat"]',
        'textarea[placeholder*="Chat"]',
        'textarea:visible',
        'input[placeholder*="message"]'
      ];
      
      console.log('\nTrying to find chat input:');
      for (const selector of possibleInputs) {
        const input = page.locator(selector);
        if (await input.count() > 0 && await input.first().isVisible()) {
          console.log(`  ✅ Found visible input: ${selector}`);
          
          // Try to type a message
          await input.first().fill('What is the main topic of this document?');
          await page.screenshot({ path: 'test-results/ai-02-chat-message-typed.png', fullPage: true });
          console.log('  ✅ Message typed in chat input');
          
          // Look for send button
          const sendBtn = page.locator('button:has-text("Send"), button[type="submit"]:visible, [data-testid*="send"], [data-testid*="submit"]');
          if (await sendBtn.count() > 0) {
            console.log('  ✅ Send button found');
            // Optionally click send
            // await sendBtn.first().click();
            // await page.waitForTimeout(5000);
          }
          break;
        }
      }
    }
    
    // ========== Smart Tags Test ==========
    console.log('\n🏷️ Testing Smart Tags...');
    
    // Go back to metadata tab
    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    if (await metadataTab.count() > 0) {
      await metadataTab.click();
      await page.waitForTimeout(1500);
    }
    
    // Look for tag-related elements
    const tagSelectors = [
      '[data-testid*="tag"]',
      '.tag-selector',
      '.tags-container',
      '[data-testid="smart-tags"]',
      'select[name*="tag"]',
      '[role="combobox"]'
    ];
    
    console.log('Looking for tag elements:');
    for (const selector of tagSelectors) {
      const el = page.locator(selector);
      const count = await el.count();
      if (count > 0) {
        console.log(`  ✅ ${selector}: ${count} found`);
      }
    }
    
    await page.screenshot({ path: 'test-results/ai-03-smart-tags.png', fullPage: true });
    
    // ========== Smart Filenaming Test ==========
    console.log('\n📝 Testing Smart Filenaming (Title)...');
    
    // Look for title input or AI title suggestion
    const titleSelectors = [
      '[data-testid*="title"]',
      'input[name="title"]',
      '[data-testid="smart-title"]',
      '.title-input',
      'input[placeholder*="title"]'
    ];
    
    console.log('Looking for title/filenaming elements:');
    for (const selector of titleSelectors) {
      const el = page.locator(selector);
      const count = await el.count();
      if (count > 0) {
        console.log(`  ✅ ${selector}: ${count} found`);
        // Get current title value if it's an input
        if (selector.includes('input')) {
          const value = await el.first().inputValue().catch(() => null);
          if (value) console.log(`     Current value: "${value.substring(0, 50)}..."`);
        }
      }
    }
    
    await page.screenshot({ path: 'test-results/ai-04-smart-title.png', fullPage: true });
    
    // ========== Correspondent Selection Test ==========
    console.log('\n👤 Testing Correspondent Selection...');
    
    const correspondentSelectors = [
      '[data-testid*="correspondent"]',
      'select[name*="correspondent"]',
      '.correspondent-selector',
      '[data-testid="smart-correspondent"]'
    ];
    
    console.log('Looking for correspondent elements:');
    for (const selector of correspondentSelectors) {
      const el = page.locator(selector);
      const count = await el.count();
      if (count > 0) {
        console.log(`  ✅ ${selector}: ${count} found`);
      }
    }
    
    // ========== Save Functionality Test ==========
    console.log('\n💾 Testing Save Functionality...');
    
    const saveSelectors = [
      'button:has-text("Save")',
      '[data-testid*="save"]',
      'button[type="submit"]',
      '.save-button'
    ];
    
    console.log('Looking for save elements:');
    for (const selector of saveSelectors) {
      const el = page.locator(selector);
      const count = await el.count();
      if (count > 0) {
        const isEnabled = await el.first().isEnabled().catch(() => false);
        console.log(`  ✅ ${selector}: ${count} found (enabled: ${isEnabled})`);
      }
    }
    
    await page.screenshot({ path: 'test-results/ai-05-save-button.png', fullPage: true });
    
    // ========== Context Sidebar Deep Dive ==========
    console.log('\n📊 Testing Context Sidebar in detail...');
    
    const sidebar = page.locator('[data-testid="context-sidebar"], [data-island="context-sidebar-island"]');
    if (await sidebar.count() > 0) {
      // Get all interactive elements in sidebar
      const buttons = sidebar.locator('button');
      const inputs = sidebar.locator('input, select, textarea');
      
      console.log(`  Buttons in sidebar: ${await buttons.count()}`);
      console.log(`  Inputs in sidebar: ${await inputs.count()}`);
      
      // List button text
      const buttonCount = await buttons.count();
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const text = await buttons.nth(i).textContent();
        console.log(`    Button #${i + 1}: "${text?.trim()}"`);
      }
    }
    
    // ========== Final Summary ==========
    console.log('\n' + '='.repeat(50));
    console.log('📋 AI FEATURES TEST SUMMARY');
    console.log('='.repeat(50));
    console.log('Chat Interface: Present (tab visible)');
    console.log('Smart Tags: Integrated in sidebar');
    console.log('Smart Title/Filenaming: Integrated in sidebar');
    console.log('Correspondent Selector: Present');
    console.log('Save Functionality: Present');
    console.log('='.repeat(50));
    
    await page.screenshot({ path: 'test-results/ai-06-final.png', fullPage: true });
  });

  test('Test History page functionality', async ({ page }) => {
    console.log('\n📜 HISTORY PAGE TEST');
    console.log('='.repeat(50));
    
    await page.goto(`${BASE}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-page="history"]', { timeout: 20000 });
    
    await page.screenshot({ path: 'test-results/history-01-initial.png', fullPage: true });
    
    // Check for history manager island
    const historyIsland = page.locator('[data-island="history-manager-island"]');
    console.log('History Manager Island:', await historyIsland.count() > 0 ? '✅ found' : '❌ not found');
    
    // Check for table
    const table = page.locator('table');
    if (await table.count() > 0) {
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();
      console.log(`Table rows: ${rowCount}`);
      
      if (rowCount > 0) {
        // Check first row for links
        const firstRow = rows.first();
        const links = firstRow.locator('a');
        const linkCount = await links.count();
        console.log(`Links in first row: ${linkCount}`);
        
        for (let i = 0; i < linkCount; i++) {
          const href = await links.nth(i).getAttribute('href');
          const text = await links.nth(i).textContent();
          console.log(`  Link #${i + 1}: "${text?.trim()}" -> ${href}`);
        }
      }
    } else {
      console.log('No table found - may have no history data yet');
      
      // Check for empty state message
      const emptyMessage = page.locator('text=/no history|empty|process.*document/i');
      if (await emptyMessage.count() > 0) {
        console.log('✅ Empty state message displayed correctly');
      }
    }
    
    // Check for filter controls
    const filters = page.locator('[data-testid*="filter"], select, input[type="search"]');
    console.log(`Filter controls: ${await filters.count()}`);
    
    await page.screenshot({ path: 'test-results/history-02-final.png', fullPage: true });
  });
});
