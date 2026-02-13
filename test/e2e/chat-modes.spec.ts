/**
 * @fileoverview E2E tests for workspace chat mode behavior in ContextSidebarIsland.
 * Chat is mounted inside `/workspace/doc/:id` and synchronized with localStorage.
 */
import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');
const fixtures = require('../helpers/fixtures');

const BASE =
  process.env.PLAYWRIGHT_BASE_URL
  || process.env.PAPERLESS_BASE_URL
  || 'http://localhost:3000';

async function openChatWorkspace(page: import('@playwright/test').Page) {
  const docId = fixtures.getTestDocId();
  await page.goto(`${BASE}/workspace/doc/${docId}?tab=chat`, {
    waitUntil: 'networkidle'
  });
  await waitForIsland(page, 'context-sidebar-island', 15000);
  await page.click('[data-testid="tab-chat"]', { force: true });
  await expect(page.locator('[data-testid="tab-panel-chat"]')).toBeVisible();
  await expect(page.locator('[data-testid="chat-workspace-root"]')).toBeVisible();
}

async function openChatWithoutDocument(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('paperless:context-sidebar.activeTab', 'chat');
  });
  await page.goto(`${BASE}/workspace`, { waitUntil: 'networkidle' });
  await waitForIsland(page, 'context-sidebar-island', 15000);
  await expect(page.locator('[data-testid="tab-panel-chat"]')).toBeVisible();
  await expect(page.locator('[data-testid="chat-workspace-root"]')).toBeVisible();
}

test.describe('Chat Modes (Workspace)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__DISABLE_GITHUB_FETCH__ = true;
      try {
        localStorage.removeItem('paperless-ai-chat-mode');
        localStorage.removeItem('paperless:context-sidebar.activeTab');
      } catch (_err) {
        // no-op
      }
    });
  });

  test('shows mode toggle and all mode buttons', async ({ page }) => {
    await openChatWorkspace(page);

    await expect(page.locator('[data-testid="chat-mode-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-mode-rag"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-mode-rag"]')).toContainText('Text Search');
    await expect(page.locator('[data-testid="chat-mode-visual-rag"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-mode-visual-rag"]')).toContainText('Visual RAG');
    await expect(page.locator('[data-testid="chat-mode-document"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-mode-document"]')).toContainText('Doc Context');
  });

  test('defaults to rag mode with rag indicator and placeholder', async ({ page }) => {
    await openChatWorkspace(page);

    await expect(page.locator('[data-testid="chat-input"]')).toHaveAttribute(
      'placeholder',
      'Execute global corpus search query...'
    );
  });

  test('enables document mode when a workspace document is loaded', async ({ page }) => {
    await openChatWorkspace(page);

    const docButton = page.locator('[data-testid="chat-mode-document"]');
    await expect(docButton).toBeEnabled();
    await docButton.click();
    const storedDocumentMode = await page.evaluate(
      () => localStorage.getItem('paperless-ai-chat-mode')
    );
    expect(storedDocumentMode).toBe('document');
    await expect(page.locator('[data-testid="chat-input"]')).toHaveAttribute(
      'placeholder',
      'Initiate document context analysis...'
    );
  });

  test('disables document mode when no workspace document is loaded', async ({ page }) => {
    await openChatWithoutDocument(page);

    await expect(page.locator('[data-testid="chat-document-title"]')).toContainText('NO_DOCUMENT_LOADED');
    await expect(page.locator('[data-testid="chat-mode-document"]')).toBeDisabled();
    await expect(page.locator('[data-testid="chat-input"]')).toHaveAttribute(
      'placeholder',
      'Execute global corpus search query...'
    );
  });

  test('switches between rag and document mode', async ({ page }) => {
    await openChatWorkspace(page);

    const ragButton = page.locator('[data-testid="chat-mode-rag"]');
    const docButton = page.locator('[data-testid="chat-mode-document"]');

    await docButton.click();
    await expect(page.locator('[data-testid="chat-input"]')).toHaveAttribute(
      'placeholder',
      'Initiate document context analysis...'
    );

    await ragButton.click();
    await expect(page.locator('[data-testid="chat-input"]')).toHaveAttribute(
      'placeholder',
      'Execute global corpus search query...'
    );
  });

  test('exposes visual rag availability state', async ({ page }) => {
    await openChatWorkspace(page);

    const visualButton = page.locator('[data-testid="chat-mode-visual-rag"]');
    await expect(visualButton).toBeVisible();

    const visualStatus = page.locator('[data-testid="chat-visual-rag-status"]');
    const statusCount = await visualStatus.count();

    if (statusCount > 0) {
      await expect(visualStatus.first()).toBeVisible();
      await expect(visualStatus.first()).toContainText(/GPU Warming Up|Sidecar Offline/i);
    } else {
      await expect(visualButton).toBeEnabled();
    }
  });

  test('persists chat mode in localStorage', async ({ page }) => {
    await openChatWorkspace(page);

    await page.click('[data-testid="chat-mode-document"]');
    await expect(page.locator('[data-testid="chat-input"]')).toHaveAttribute(
      'placeholder',
      'Initiate document context analysis...'
    );

    const storedDocumentMode = await page.evaluate(() => localStorage.getItem('paperless-ai-chat-mode'));
    expect(storedDocumentMode).toBe('document');

    await page.click('[data-testid="chat-mode-rag"]');
    await expect(page.locator('[data-testid="chat-input"]')).toHaveAttribute(
      'placeholder',
      'Execute global corpus search query...'
    );

    const storedRagMode = await page.evaluate(() => localStorage.getItem('paperless-ai-chat-mode'));
    expect(storedRagMode).toBe('rag');
  });

  test('falls back to rag mode when stored mode=document but no document is loaded', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('paperless-ai-chat-mode', 'document');
      localStorage.removeItem('paperless:context-sidebar.activeTab');
    });

    await openChatWithoutDocument(page);

    await expect(page.locator('[data-testid="chat-mode-document"]')).toBeDisabled();
    await expect(page.locator('[data-testid="chat-input"]')).toHaveAttribute(
      'placeholder',
      'Execute global corpus search query...'
    );
  });

  test('send button reflects model availability after input', async ({ page }) => {
    await openChatWorkspace(page);

    const sendButton = page.locator('[data-testid="chat-send-button"]');
    await expect(sendButton).toBeDisabled();

    await page.fill('[data-testid="chat-input"]', 'Test RAG query');
    const modelValue = await page.locator('[data-testid="chat-model-select"]').inputValue();
    if (modelValue) {
      await expect(sendButton).toBeEnabled();
    } else {
      await expect(sendButton).toBeDisabled();
    }
  });
});

test.describe('/chat route deprecation', () => {
  test('returns 410 for /chat', async ({ request }) => {
    const res = await request.get('/chat');
    expect(res.status()).toBe(410);
  });

  test('returns 410 for /chat?open=X', async ({ request }) => {
    const res = await request.get('/chat?open=123');
    expect(res.status()).toBe(410);
  });
});
