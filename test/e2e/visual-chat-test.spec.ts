import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test.describe('Visual Chat UI Test in Workspace', () => {
  test('Select document, navigate to chat, and ask a question', async ({ page }) => {
    // Step 1: Login
    console.log('Step 1: Logging in...');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="username"], input[type="text"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
    console.log('Login successful');

    // Step 2: Navigate to workspace
    console.log('Step 2: Navigating to workspace...');
    await page.goto(`${BASE}/workspace`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/chat-test-01-workspace.png', fullPage: true });
    console.log('Current URL:', page.url());

    // Step 3: Check if document selector dropdown is visible
    console.log('Step 3: Looking for document selector...');
    const selectorTrigger = page.locator('[data-testid="document-selector-trigger"]');

    if (await selectorTrigger.count() > 0) {
      console.log('Document selector found');

      // Check if dropdown is already open (should be open when no doc selected)
      const dropdown = page.locator('[data-testid="document-selector-dropdown"]');
      if (await dropdown.count() === 0) {
        await selectorTrigger.click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({ path: 'test-results/chat-test-02-dropdown-open.png', fullPage: true });

      // Step 4: Select a document
      console.log('Step 4: Selecting a document...');
      const docOptions = page.locator('[data-testid^="document-option-"]');
      const optionCount = await docOptions.count();
      console.log(`Found ${optionCount} document options`);

      if (optionCount > 0) {
        // Select the first available document
        const firstOption = docOptions.first();
        const optionText = await firstOption.textContent();
        console.log('Selecting document:', optionText?.trim());

        await firstOption.click();
        await page.waitForTimeout(2000);

        await page.screenshot({ path: 'test-results/chat-test-03-document-selected.png', fullPage: true });
        console.log('Document selected, URL:', page.url());
      }
    } else {
      console.log('Document selector not found, trying direct navigation');
      await page.goto(`${BASE}/workspace/doc/9`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/chat-test-03-direct-nav.png', fullPage: true });
    }

    // Step 5: Navigate to Chat tab
    console.log('Step 5: Looking for Chat tab...');
    const chatTab = page.locator('[data-testid="tab-chat"]');

    if (await chatTab.count() > 0) {
      console.log('Chat tab found, clicking...');
      await chatTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/chat-test-04-chat-tab.png', fullPage: true });
    } else {
      console.log('Chat tab not found via data-testid, trying text search...');
      const chatTabByText = page.locator('button:has-text("Chat")');
      if (await chatTabByText.count() > 0) {
        await chatTabByText.first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/chat-test-04-chat-tab.png', fullPage: true });
      }
    }

    // Step 6: Find the chat input area
    console.log('Step 6: Looking for chat input...');
    await page.waitForTimeout(1000);

    // Try different selectors for chat input
    const chatInputSelectors = [
      '[data-testid="chat-input"]',
      'textarea[placeholder*="message"]',
      'textarea[placeholder*="chat"]',
      'textarea[placeholder*="Ask"]',
      'input[placeholder*="message"]',
      '.chat-input textarea',
      '#chat-input',
      'textarea'
    ];

    let chatInput = null;
    for (const selector of chatInputSelectors) {
      const element = page.locator(selector).first();
      if (await element.count() > 0 && await element.isVisible()) {
        chatInput = element;
        console.log(`Chat input found with selector: ${selector}`);
        break;
      }
    }

    await page.screenshot({ path: 'test-results/chat-test-05-chat-interface.png', fullPage: true });

    if (chatInput) {
      // Step 7: Type a question about the document
      console.log('Step 7: Typing a question...');
      const question = 'What is this document about? Please summarize its main content.';
      await chatInput.fill(question);
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/chat-test-06-question-typed.png', fullPage: true });

      // Step 8: Submit the question
      console.log('Step 8: Submitting question...');
      const submitButton = page.locator('[data-testid="chat-submit"], button[type="submit"]:has-text("Send"), button:has-text("Send")').first();

      if (await submitButton.count() > 0) {
        await submitButton.click();
        console.log('Question submitted');

        // Wait for response (with timeout)
        console.log('Waiting for AI response...');
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'test-results/chat-test-07-response.png', fullPage: true });
      } else {
        // Try pressing Enter
        console.log('Submit button not found, trying Enter key...');
        await chatInput.press('Enter');
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'test-results/chat-test-07-response.png', fullPage: true });
      }
    } else {
      console.log('Chat input not found. Taking screenshot of current state...');
      await page.screenshot({ path: 'test-results/chat-test-06-no-chat-input.png', fullPage: true });

      // Log the page content for debugging
      const pageContent = await page.content();
      console.log('Page has textarea:', pageContent.includes('<textarea'));
      console.log('Page has chat-related elements:', pageContent.includes('chat'));
    }

    // Final screenshot
    console.log('Test completed. Taking final screenshot...');
    await page.screenshot({ path: 'test-results/chat-test-final.png', fullPage: true });
  });
});
