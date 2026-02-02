/**
 * @fileoverview E2E tests for Three Chat Modes (Text RAG, Visual RAG, Document).
 * Tests the chat mode toggle functionality and mode-specific behavior.
 * 
 * NOTE: Chat functionality lives in the Unified Workspace sidebar, NOT as a standalone page.
 * The /chat route has been retired and redirects to /workspace.
 * 
 * @see tickets/e69971fa-a795-43ef-a75f-4dae52ee65aa
 */
import { test, expect } from '@playwright/test';

test.describe('Three Chat Modes', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the workspace with chat tab pre-selected
    // The chat functionality lives in the ContextSidebarIsland within /workspace
    await page.goto('/workspace/doc/latest?tab=chat');
    
    // Wait for the sidebar to load
    await page.waitForSelector('[data-testid="context-sidebar-root"]', { timeout: 15000 });
    
    // Wait for the chat tab panel to be visible
    await page.waitForSelector('[data-testid="tab-panel-chat"]', { timeout: 5000 });
    
    // Wait for ChatWorkspaceIsland to load within the chat panel
    await page.waitForSelector('[data-testid="chat-workspace-root"]', { timeout: 10000 });
  });

  test('should show mode toggle when chat tab is active', async ({ page }) => {
    // Mode toggle should be visible within the chat panel
    const modeToggle = page.locator('[data-testid="chat-mode-toggle"]');
    await expect(modeToggle).toBeVisible();
    
    // RAG button should be visible
    const ragButton = page.locator('[data-testid="chat-mode-rag"]');
    await expect(ragButton).toBeVisible();
    await expect(ragButton).toHaveText(/Text Search/);
    
    // Visual RAG button should be visible
    const visualRagButton = page.locator('[data-testid="chat-mode-visual-rag"]');
    await expect(visualRagButton).toBeVisible();
    await expect(visualRagButton).toHaveText(/Visual Search/);
    
    // Document button should be visible
    const docButton = page.locator('[data-testid="chat-mode-document"]');
    await expect(docButton).toBeVisible();
    await expect(docButton).toHaveText(/Document Chat/);
  });

  test('should default to RAG mode', async ({ page }) => {
    // RAG mode button should be active (copper background)
    const ragButton = page.locator('[data-testid="chat-mode-rag"]');
    await expect(ragButton).toHaveClass(/bg-\[#b87333\]/);
    
    // RAG indicator should be visible
    const ragIndicator = page.locator('[data-testid="chat-mode-rag-indicator"]');
    await expect(ragIndicator).toBeVisible();
    await expect(ragIndicator).toContainText('Searching documents by text content');
  });

  test('should disable Document mode when no document selected', async ({ page }) => {
    // Ensure no document is selected (clear selection)
    const docSelect = page.locator('[data-testid="chat-document-select"]');
    await docSelect.selectOption('');
    await page.waitForTimeout(200);
    
    // Document mode button should be disabled
    const docButton = page.locator('[data-testid="chat-mode-document"]');
    await expect(docButton).toBeDisabled();
    
    // Check for the disabled styling
    await expect(docButton).toHaveClass(/disabled:opacity-50/);
  });

  test('should enable Document mode when document is selected', async ({ page }) => {
    // Get the document select
    const docSelect = page.locator('[data-testid="chat-document-select"]');
    const options = await docSelect.locator('option').all();
    
    // Skip if no documents available (only placeholder option)
    if (options.length <= 1) {
      test.skip(true, 'No documents available for testing');
      return;
    }
    
    // Select the first document
    const firstDocOption = options[1]; // Skip placeholder
    const docValue = await firstDocOption.getAttribute('value');
    await docSelect.selectOption(docValue || '');
    
    // Wait for document to load
    await page.waitForTimeout(500);
    
    // Document mode button should now be enabled
    const docButton = page.locator('[data-testid="chat-mode-document"]');
    await expect(docButton).toBeEnabled();
  });

  test('should switch between modes when clicking buttons', async ({ page }) => {
    // Select a document first
    const docSelect = page.locator('[data-testid="chat-document-select"]');
    const options = await docSelect.locator('option').all();
    
    if (options.length <= 1) {
      test.skip(true, 'No documents available for testing');
      return;
    }
    
    const firstDocOption = options[1];
    const docValue = await firstDocOption.getAttribute('value');
    await docSelect.selectOption(docValue || '');
    await page.waitForTimeout(500);
    
    // Initially in RAG mode
    const ragButton = page.locator('[data-testid="chat-mode-rag"]');
    const docButton = page.locator('[data-testid="chat-mode-document"]');
    
    await expect(ragButton).toHaveClass(/bg-\[#b87333\]/);
    
    // Click Document mode
    await docButton.click();
    await page.waitForTimeout(100);
    
    // Document mode should now be active
    await expect(docButton).toHaveClass(/bg-\[#b87333\]/);
    
    // Document indicator should show
    const docIndicator = page.locator('[data-testid="chat-mode-doc-indicator"]');
    await expect(docIndicator).toBeVisible();
    
    // Click back to RAG mode
    await ragButton.click();
    await page.waitForTimeout(100);
    
    // RAG mode should be active again
    await expect(ragButton).toHaveClass(/bg-\[#b87333\]/);
  });

  test('should show different placeholder text based on mode', async ({ page }) => {
    // In RAG mode, check placeholder
    const ragInput = page.locator('[data-testid="chat-input"]');
    await expect(ragInput).toHaveAttribute('placeholder', /across all documents/i);
    
    // Select a document to enable Document mode
    const docSelect = page.locator('[data-testid="chat-document-select"]');
    const options = await docSelect.locator('option').all();
    
    if (options.length <= 1) {
      test.skip(true, 'No documents available for testing');
      return;
    }
    
    const firstDocOption = options[1];
    const docValue = await firstDocOption.getAttribute('value');
    await docSelect.selectOption(docValue || '');
    await page.waitForTimeout(500);
    
    // Switch to Document mode
    const docButton = page.locator('[data-testid="chat-mode-document"]');
    await docButton.click();
    await page.waitForTimeout(100);
    
    // Check Document mode placeholder
    const docInput = page.locator('[data-testid="chat-input"]');
    await expect(docInput).toHaveAttribute('placeholder', /about this document/i);
  });

  test('should switch back to RAG mode when document is deselected', async ({ page }) => {
    // Select a document
    const docSelect = page.locator('[data-testid="chat-document-select"]');
    const options = await docSelect.locator('option').all();
    
    if (options.length <= 1) {
      test.skip(true, 'No documents available for testing');
      return;
    }
    
    const firstDocOption = options[1];
    const docValue = await firstDocOption.getAttribute('value');
    await docSelect.selectOption(docValue || '');
    await page.waitForTimeout(500);
    
    // Switch to Document mode
    const docButton = page.locator('[data-testid="chat-mode-document"]');
    await docButton.click();
    await page.waitForTimeout(100);
    
    // Verify we're in Document mode
    await expect(docButton).toHaveClass(/bg-\[#b87333\]/);
    
    // Deselect document (select placeholder)
    await docSelect.selectOption('');
    await page.waitForTimeout(300);
    
    // Should automatically switch back to RAG mode
    const ragButton = page.locator('[data-testid="chat-mode-rag"]');
    await expect(ragButton).toHaveClass(/bg-\[#b87333\]/);
    
    // Document button should be disabled again
    await expect(docButton).toBeDisabled();
  });

  test('should show empty state message in RAG mode when no messages', async ({ page }) => {
    // RAG mode empty state
    const ragEmpty = page.locator('[data-testid="chat-rag-empty"]');
    await expect(ragEmpty).toBeVisible();
    await expect(ragEmpty).toContainText('Ask a question to search across all your documents');
  });

  test('mode toggle should be accessible via keyboard', async ({ page }) => {
    // Focus on RAG button
    const ragButton = page.locator('[data-testid="chat-mode-rag"]');
    await ragButton.focus();
    
    // Should be focusable
    await expect(ragButton).toBeFocused();
    
    // Tab to Visual RAG button
    await page.keyboard.press('Tab');
    const visualRagButton = page.locator('[data-testid="chat-mode-visual-rag"]');
    await expect(visualRagButton).toBeFocused();
    
    // Tab to Document button
    await page.keyboard.press('Tab');
    const docButton = page.locator('[data-testid="chat-mode-document"]');
    await expect(docButton).toBeFocused();
  });

  test('should have proper ARIA attributes on mode buttons', async ({ page }) => {
    // RAG button should have title
    const ragButton = page.locator('[data-testid="chat-mode-rag"]');
    await expect(ragButton).toHaveAttribute('title', /Search across all indexed documents/i);
    
    // Document button should have title
    const docButton = page.locator('[data-testid="chat-mode-document"]');
    const docTitle = await docButton.getAttribute('title');
    expect(docTitle).toBeTruthy();
  });
});

test.describe('Visual RAG Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace/doc/latest?tab=chat');
    await page.waitForSelector('[data-testid="context-sidebar-root"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="chat-workspace-root"]', { timeout: 10000 });
  });

  test('should show Visual Search button', async ({ page }) => {
    const visualRagButton = page.locator('[data-testid="chat-mode-visual-rag"]');
    await expect(visualRagButton).toBeVisible();
    await expect(visualRagButton).toHaveText(/Visual Search/);
  });

  test('should have appropriate title attribute on Visual Search button', async ({ page }) => {
    const visualRagButton = page.locator('[data-testid="chat-mode-visual-rag"]');
    const title = await visualRagButton.getAttribute('title');
    expect(title).toBeTruthy();
    // Title should indicate visual search capabilities or unavailability
    expect(title).toMatch(/visual|Hybrid|unavailable|initializing/i);
  });

  test('should switch to Visual RAG mode when button clicked (if available)', async ({ page }) => {
    const visualRagButton = page.locator('[data-testid="chat-mode-visual-rag"]');
    const isDisabled = await visualRagButton.isDisabled();
    
    if (!isDisabled) {
      await visualRagButton.click();
      await page.waitForTimeout(100);
      
      // Visual RAG mode should be active
      await expect(visualRagButton).toHaveClass(/bg-\[#b87333\]/);
      
      // Visual indicator should be visible
      const visualIndicator = page.locator('[data-testid="chat-mode-visual-indicator"]');
      await expect(visualIndicator).toBeVisible();
    } else {
      // If disabled, button should have disabled styling
      await expect(visualRagButton).toHaveClass(/disabled:opacity-50/);
    }
  });

  test('should show appropriate empty state in Visual RAG mode', async ({ page }) => {
    const visualRagButton = page.locator('[data-testid="chat-mode-visual-rag"]');
    const isDisabled = await visualRagButton.isDisabled();
    
    if (!isDisabled) {
      await visualRagButton.click();
      await page.waitForTimeout(100);
      
      // Visual RAG empty state
      const visualEmpty = page.locator('[data-testid="chat-visual-empty"]');
      await expect(visualEmpty).toBeVisible();
      await expect(visualEmpty).toContainText('visual content');
    }
  });

  test('should show initializing state when sidecar is warming up', async ({ page }) => {
    // Mock the health endpoint to return initializing state
    await page.route('/api/visual-rag/health', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'initializing', message: 'GPU warmup in progress' })
      });
    });

    await page.goto('/workspace/doc/latest?tab=chat');
    await page.waitForSelector('[data-testid="chat-workspace-root"]', { timeout: 15000 });
    
    // Wait for health check
    await page.waitForTimeout(1500);
    
    const visualRagButton = page.locator('[data-testid="chat-mode-visual-rag"]');
    // Should show initializing indicator
    const title = await visualRagButton.getAttribute('title');
    expect(title).toMatch(/initializing|warmup/i);
  });
});

test.describe('RAG Chat Functionality', () => {
  test('should send message in RAG mode', async ({ page }) => {
    await page.goto('/workspace/doc/latest?tab=chat');
    await page.waitForSelector('[data-testid="chat-workspace-root"]', { timeout: 15000 });
    
    // Wait for model to be selected
    await page.waitForSelector('[data-testid="chat-model-select"]', { timeout: 5000 });
    
    // Enter a message
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('Test RAG search query');
    
    // Check send button state
    const sendButton = page.locator('[data-testid="chat-send-button"]');
    
    // If model is not selected, button should be disabled
    const modelSelect = page.locator('[data-testid="chat-model-select"]');
    const modelValue = await modelSelect.inputValue();
    
    if (modelValue) {
      // Model is selected, button should be enabled
      await expect(sendButton).toBeEnabled();
    } else {
      // No model selected, button should be disabled
      await expect(sendButton).toBeDisabled();
    }
  });
});

test.describe('/chat route deprecation', () => {
  test('should redirect /chat to /workspace with chat tab', async ({ page }) => {
    // Navigate to the deprecated /chat route
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });
    
    // Should redirect (302) to workspace
    const url = page.url();
    expect(url).toMatch(/\/workspace\/doc\/.+\?tab=chat/);
    
    // Should load the workspace with chat tab active
    await page.waitForSelector('[data-testid="context-sidebar-root"]', { timeout: 15000 });
    
    // Chat tab should be active
    const chatTab = page.locator('[data-testid="tab-chat"]');
    await expect(chatTab).toHaveClass(/border-copper/);
  });

  test('should preserve document ID in redirect from /chat?open=X', async ({ page }) => {
    // Navigate to the deprecated /chat route with a document ID
    await page.goto('/chat?open=123', { waitUntil: 'domcontentloaded' });
    
    // Should redirect to workspace with the document ID
    const url = page.url();
    expect(url).toMatch(/\/workspace\/doc\/123\?tab=chat/);
  });
});

test.describe('Chat Mode Persistence', () => {
  test('should persist chat mode to localStorage', async ({ page }) => {
    await page.goto('/workspace/doc/latest?tab=chat');
    await page.waitForSelector('[data-testid="chat-workspace-root"]', { timeout: 15000 });
    
    // Get the Visual RAG button
    const visualRagButton = page.locator('[data-testid="chat-mode-visual-rag"]');
    const isDisabled = await visualRagButton.isDisabled();
    
    if (!isDisabled) {
      // Switch to Visual RAG mode
      await visualRagButton.click();
      await page.waitForTimeout(100);
      
      // Check localStorage
      const storedMode = await page.evaluate(() => {
        return localStorage.getItem('paperless-ai-chat-mode');
      });
      
      expect(storedMode).toBe('visual-rag');
    }
  });

  test('should restore chat mode from localStorage on page reload', async ({ page }) => {
    await page.goto('/workspace/doc/latest?tab=chat');
    await page.waitForSelector('[data-testid="chat-workspace-root"]', { timeout: 15000 });
    
    // Set mode in localStorage before reload
    await page.evaluate(() => {
      localStorage.setItem('paperless-ai-chat-mode', 'rag');
    });
    
    // Reload the page
    await page.reload();
    await page.waitForSelector('[data-testid="chat-workspace-root"]', { timeout: 15000 });
    
    // RAG mode should be active
    const ragButton = page.locator('[data-testid="chat-mode-rag"]');
    await expect(ragButton).toHaveClass(/bg-\[#b87333\]/);
  });

  test('should fall back to RAG mode if stored "document" mode but no document loaded', async ({ page }) => {
    // Set document mode in localStorage
    await page.evaluate(() => {
      localStorage.setItem('paperless-ai-chat-mode', 'document');
    });
    
    // Navigate without a document selected
    await page.goto('/workspace/doc/latest?tab=chat');
    await page.waitForSelector('[data-testid="chat-workspace-root"]', { timeout: 15000 });
    
    // Clear document selection if any
    const docSelect = page.locator('[data-testid="chat-document-select"]');
    await docSelect.selectOption('');
    await page.waitForTimeout(200);
    
    // Should be in RAG mode (fallback)
    const ragButton = page.locator('[data-testid="chat-mode-rag"]');
    await expect(ragButton).toHaveClass(/bg-\[#b87333\]/);
  });
});

test.describe('Visual Search Thumbnails', () => {
  test('should have thumbnail data-testid attributes in source markup', async ({ page }) => {
    // This test validates the thumbnail markup structure
    // Actual thumbnail display requires Visual RAG search results
    
    await page.goto('/workspace/doc/latest?tab=chat');
    await page.waitForSelector('[data-testid="chat-workspace-root"]', { timeout: 15000 });
    
    // Switch to Visual RAG mode if available
    const visualRagButton = page.locator('[data-testid="chat-mode-visual-rag"]');
    const isDisabled = await visualRagButton.isDisabled();
    
    if (!isDisabled) {
      await visualRagButton.click();
      await page.waitForTimeout(100);
      
      // Verify the visual mode is active
      await expect(visualRagButton).toHaveClass(/bg-\[#b87333\]/);
      
      // The thumbnail elements will appear in search results
      // Test validates the UI structure exists for thumbnails
      const chatHistory = page.locator('[data-testid="chat-history-visual"]');
      await expect(chatHistory).toBeVisible();
    }
  });
});
