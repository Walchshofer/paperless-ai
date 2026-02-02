import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');
const fixtures = require('../helpers/fixtures');

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('Sidebar Tab Restructuring', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure predictable test environment
    await page.addInitScript(() => {
      window.__DISABLE_GITHUB_FETCH__ = true;
      try { localStorage.removeItem('paperless:context-sidebar.activeTab'); } catch (e) { /* ignore */ }
    });
  });

  test('should show renamed tabs with correct icons', async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);

    // Verify Smart Metadata tab
    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    await expect(metadataTab).toContainText('Smart Metadata');
    await expect(metadataTab.locator('.fa-wand-magic-sparkles')).toBeVisible();
    
    // Verify OCR Text tab
    const contentTab = page.locator('[data-testid="tab-content"]');
    await expect(contentTab).toContainText('OCR Text');
    await expect(contentTab.locator('.fa-file-lines')).toBeVisible();
    
    // Verify Chat tab
    const chatTab = page.locator('[data-testid="tab-chat"]');
    await expect(chatTab).toContainText('Chat');
    await expect(chatTab.locator('.fa-comments')).toBeVisible();
    
    // Verify Visual tab
    const visualTab = page.locator('[data-testid="tab-visual"]');
    await expect(visualTab).toContainText('Visual');
    await expect(visualTab.locator('.fa-draw-polygon')).toBeVisible();

    await page.screenshot({ path: 'test-results/sidebar-tabs/screenshot-renamed-tabs.png', fullPage: true });
  });

  test('should show tooltips on hover', async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);

    // Verify Smart Metadata tab tooltip
    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    const metadataTooltip = await metadataTab.getAttribute('title');
    expect(metadataTooltip).toContain('AI-assisted');

    // Verify OCR Text tab tooltip
    const contentTab = page.locator('[data-testid="tab-content"]');
    const contentTooltip = await contentTab.getAttribute('title');
    expect(contentTooltip).toContain('Tesseract OCR');
    expect(contentTooltip).toContain('read-only');

    // Verify Chat tab tooltip
    const chatTab = page.locator('[data-testid="tab-chat"]');
    const chatTooltip = await chatTab.getAttribute('title');
    expect(chatTooltip).toContain('Chat with AI');
    expect(chatTooltip).toContain('RAG');

    // Verify Visual tab tooltip
    const visualTab = page.locator('[data-testid="tab-visual"]');
    const visualTooltip = await visualTab.getAttribute('title');
    expect(visualTooltip).toContain('Label fields');
    expect(visualTooltip).toContain('visual search');
  });

  test('should have increased sidebar width', async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);

    const sidebar = page.locator('.workspace-sidebar');
    const boundingBox = await sidebar.boundingBox();
    
    // Sidebar width should be at least 480px (the new default)
    expect(boundingBox?.width).toBeGreaterThanOrEqual(480);

    await page.screenshot({ path: 'test-results/sidebar-tabs/screenshot-sidebar-width.png', fullPage: true });
  });

  test('should show panel headers with context', async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);

    // Verify Smart Metadata panel header
    const metadataHeader = page.locator('[data-testid="panel-header-metadata"]');
    await expect(metadataHeader).toBeVisible();
    await expect(metadataHeader).toContainText('AI-powered metadata extraction');

    // Switch to OCR Text tab and verify header
    await page.click('[data-testid="tab-content"]');
    const contentHeader = page.locator('[data-testid="panel-header-content"]');
    await expect(contentHeader).toBeVisible();
    await expect(contentHeader).toContainText('Tesseract OCR extracted text');
    await expect(contentHeader).toContainText('read-only');

    // Switch to Visual tab and verify header
    await page.click('[data-testid="tab-visual"]');
    const visualHeader = page.locator('[data-testid="panel-header-visual"]');
    await expect(visualHeader).toBeVisible();
    await expect(visualHeader).toContainText('Visual field overlay labeling');

    await page.screenshot({ path: 'test-results/sidebar-tabs/screenshot-panel-headers.png', fullPage: true });
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);

    // Verify tablist role
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();
    await expect(tablist).toHaveAttribute('aria-label', 'Context Sidebar Tabs');

    // Verify active tab has aria-selected=true
    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    await expect(metadataTab).toHaveAttribute('role', 'tab');
    await expect(metadataTab).toHaveAttribute('aria-selected', 'true');
    await expect(metadataTab).toHaveAttribute('aria-controls', 'panel-metadata');

    // Verify inactive tab has aria-selected=false
    const contentTab = page.locator('[data-testid="tab-content"]');
    await expect(contentTab).toHaveAttribute('aria-selected', 'false');

    // Verify panel has proper role
    const metadataPanel = page.locator('[data-testid="tab-panel-metadata"]');
    await expect(metadataPanel).toHaveAttribute('role', 'tabpanel');
    await expect(metadataPanel).toHaveAttribute('aria-labelledby', 'tab-metadata');
  });

  test('should support keyboard navigation between tabs', async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);

    // Focus on metadata tab
    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    await metadataTab.focus();

    // Press ArrowRight to move to OCR Text tab
    await page.keyboard.press('ArrowRight');
    const contentTab = page.locator('[data-testid="tab-content"]');
    await expect(contentTab).toBeFocused();
    await expect(page.locator('[data-testid="tab-panel-content"]')).toBeVisible();

    // Press ArrowRight to move to Chat tab
    await page.keyboard.press('ArrowRight');
    const chatTab = page.locator('[data-testid="tab-chat"]');
    await expect(chatTab).toBeFocused();
    await expect(page.locator('[data-testid="tab-panel-chat"]')).toBeVisible();

    // Press ArrowLeft to move back to OCR Text tab
    await page.keyboard.press('ArrowLeft');
    await expect(contentTab).toBeFocused();
    await expect(page.locator('[data-testid="tab-panel-content"]')).toBeVisible();
  });

  test('debug tab only visible for admin users', async ({ page }) => {
    const docId = fixtures.getTestDocId();

    // Non-admin: should NOT show debug tab
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);
    await expect(page.locator('[data-testid="tab-debug"]')).toHaveCount(0);

    // Admin override via test hook: set global before navigation
    await page.addInitScript(() => { 
      const w = window as unknown as Record<string, unknown>; 
      w.__TEST_IS_ADMIN = true; 
    });
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);

    // Debug tab should be visible and have correct styling
    const debugTab = page.locator('[data-testid="tab-debug"]');
    await expect(debugTab).toBeVisible();
    await expect(debugTab).toContainText('Debug');
    await expect(debugTab.locator('.fa-bug')).toBeVisible();

    // Verify debug tab tooltip
    const debugTooltip = await debugTab.getAttribute('title');
    expect(debugTooltip).toContain('Developer debugging');
  });
});
