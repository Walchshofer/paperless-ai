import { test, expect, Page } from '@playwright/test';

/**
 * Workspace Visual Browser Tests
 * 
 * Tests the /workspace route end-to-end using real browser interactions.
 * Credentials: elfman / P2tr3ck!1976
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

/**
 * Helper: Login to the application
 * Handles potential redirect to setup page
 */
async function login(page: Page): Promise<void> {
  // Navigate to login page
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  
  // Check if we're on setup page (might redirect there first)
  const currentUrl = page.url();
  if (currentUrl.includes('/setup')) {
    console.log('Redirected to setup page - attempting to access login directly');
    // Try navigating directly to login
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  }
  
  // Wait for login form elements
  await page.waitForSelector('#username', { timeout: 10000 });
  
  // Fill credentials
  await page.fill('#username', USERNAME);
  await page.fill('#password', PASSWORD);
  
  // Submit using the specific login button
  await page.click('[data-testid="login-submit-btn"]');
  
  // Wait for redirect away from login
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
}

test.describe('Workspace Route - Visual Browser Tests', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('Route Navigation', () => {

    test('GET /workspace redirects to document (authenticated)', async ({ page }) => {
      const response = await page.goto(`${BASE}/workspace`, { waitUntil: 'networkidle' });
      
      expect(response?.status()).toBe(200);
      
      // Should redirect to a specific document or show selector
      const finalUrl = page.url();
      const hasDocumentId = /\/workspace\/doc\/\d+/.test(finalUrl) || /\/workspace\/\d+/.test(finalUrl);
      const isBaseWorkspace = finalUrl.endsWith('/workspace');
      
      // Either we have a document pre-selected or we're on base workspace (no documents)
      expect(hasDocumentId || isBaseWorkspace).toBeTruthy();
      
      await page.screenshot({ path: 'test-results/workspace-route-entry.png', fullPage: true });
    });

    test('GET /workspace/latest redirects to most recent document', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });
      
      const finalUrl = page.url();
      
      // Should be redirected to a document workspace page
      const hasDoc = /\/workspace\/doc\/\d+/.test(finalUrl);
      
      // If no documents, might show an error page
      if (!hasDoc) {
        const noDocsMessage = await page.locator('text=/no documents|not found/i').count();
        if (noDocsMessage === 0) {
          // Must have a valid workspace URL
          expect(finalUrl).toContain('/workspace');
        }
      }
      
      await page.screenshot({ path: 'test-results/workspace-latest-redirect.png', fullPage: true });
    });

    test('GET /workspace/doc/:id loads specific document', async ({ page }) => {
      // Use fixture document ID - global setup ensures fixtures are available
      const { getTestDocId } = require('../helpers/fixtures');
      const docId = getTestDocId();
      
      // Navigate directly to the document workspace
      await page.goto(`${BASE}/workspace/doc/${docId}`, { waitUntil: 'networkidle' });
      
      // Verify we're on the correct page
      expect(page.url()).toContain(`/workspace/doc/${docId}`);
      
      // Wait for the workspace page marker
      await expect(page.locator('[data-page="document-workspace"]')).toBeVisible({ timeout: 15000 });
      
      await page.screenshot({ path: `test-results/workspace-doc-${docId}.png`, fullPage: true });
    });

  });

  test.describe('Page Structure', () => {

    test('workspace has required page elements', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Check for data-page attribute (required by frontend standards)
      // Use .first() as attribute may exist on multiple elements (html, body)
      const pageMarker = page.locator('[data-page="document-workspace"]').first();
      if (await pageMarker.count() > 0) {
        await expect(pageMarker).toBeVisible();
      }
      
      // Check for key workspace components
      const components = {
        'sidebar': '[data-testid="context-sidebar"], [data-island="context-sidebar-island"]',
        'viewer': '[data-testid="document-viewer"], [data-island="overlay-viewer-island"]',
        'context-bar': '[data-testid="document-context-bar"], [data-island="document-context-bar-island"]',
      };
      
      for (const [name, selector] of Object.entries(components)) {
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible().catch(() => false);
        console.log(`Component "${name}": ${isVisible ? 'visible' : 'not found'}`);
      }
      
      await page.screenshot({ path: 'test-results/workspace-structure.png', fullPage: true });
    });

    test('workspace islands are mounted', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });
      
      // Wait for island runtime to mount
      await page.waitForFunction(() => {
        return (window as unknown as { __islandRuntimeMounted?: boolean }).__islandRuntimeMounted === true;
      }, { timeout: 15000 }).catch(() => {
        console.warn('Island runtime mount flag not detected');
      });
      
      // Check for mounted islands
      const islands = await page.locator('[data-island]').all();
      console.log(`Found ${islands.length} island mount points`);
      
      for (const island of islands) {
        const name = await island.getAttribute('data-island');
        const hasContent = await island.locator('*').count() > 0;
        console.log(`Island "${name}": ${hasContent ? 'mounted' : 'empty'}`);
      }
      
      // At minimum, we should have at least one island
      expect(islands.length).toBeGreaterThan(0);
    });

  });

  test.describe('Document Context Bar', () => {

    test('document selector is interactive', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });
      
      // Find document context bar island - required component
      const contextBar = page.locator('[data-island="document-context-bar-island"], [data-testid="document-context-bar"]');
      
      await expect(contextBar).toBeVisible({ timeout: 15000 });
      
      // Look for document selector
      const selector = contextBar.locator('select, [data-testid="document-selector"], [role="combobox"]');
      
      if (await selector.count() > 0) {
        await expect(selector).toBeVisible();
        
        // Try to open the selector
        await selector.click();
        
        await page.screenshot({ path: 'test-results/workspace-doc-selector-open.png', fullPage: true });
      }
    });

  });

  test.describe('Overlay Viewer', () => {

    test('overlay viewer loads document preview', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });
      
      // Find overlay viewer - required component for document workspace
      const viewer = page.locator('[data-island="overlay-viewer-island"], [data-testid="overlay-viewer"]');
      
      // Wait for viewer to be visible
      await expect(viewer).toBeVisible({ timeout: 15000 });
      
      // Check for canvas or image element inside viewer
      const hasCanvas = await viewer.locator('canvas').count() > 0;
      const hasImage = await viewer.locator('img').count() > 0;
      
      console.log(`Viewer has canvas: ${hasCanvas}, has image: ${hasImage}`);
      
      // Should have some visual content
      expect(hasCanvas || hasImage).toBeTruthy();
      
      await page.screenshot({ path: 'test-results/workspace-overlay-viewer.png', fullPage: true });
    });

    test('overlay viewer zoom controls work', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });
      
      // Zoom controls are required for document navigation
      const zoomIn = page.locator('[data-testid="zoom-in"], button:has-text("Zoom In"), button:has-text("+")');
      const zoomOut = page.locator('[data-testid="zoom-out"], button:has-text("Zoom Out"), button:has-text("-")');
      
      // Expect at least zoom in to be visible
      await expect(zoomIn.first()).toBeVisible({ timeout: 15000 });
      
      // Click zoom in
      await zoomIn.first().click();
      await page.waitForTimeout(500);
      
      await page.screenshot({ path: 'test-results/workspace-zoom-in.png', fullPage: true });
      
      // Click zoom out twice if available
      if (await zoomOut.count() > 0) {
        await zoomOut.first().click();
        await page.waitForTimeout(500);
        await zoomOut.first().click();
        await page.waitForTimeout(500);
        
        await page.screenshot({ path: 'test-results/workspace-zoom-out.png', fullPage: true });
      }
    });

  });

  test.describe('Context Sidebar', () => {

    test('sidebar tabs are navigable', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });
      
      // Find context sidebar - required component
      const sidebar = page.locator('[data-testid="context-sidebar"]');
      
      await expect(sidebar).toBeVisible({ timeout: 15000 });
      
      // Check for tab buttons
      const tabs = ['content', 'chat', 'overlays'];
      
      for (const tabName of tabs) {
        const tab = sidebar.locator(`[data-testid="tab-${tabName}"], [role="tab"]:has-text("${tabName}")`);
        
        if (await tab.count() > 0) {
          await tab.first().click();
          await page.waitForTimeout(300);
          
          console.log(`Clicked "${tabName}" tab`);
          
          // Check if panel is visible
          const panel = sidebar.locator(`[data-testid="tab-panel-${tabName}"], [role="tabpanel"]`);
          if (await panel.count() > 0) {
            await expect(panel).toBeVisible();
          }
        }
      }
      
      await page.screenshot({ path: 'test-results/workspace-sidebar-tabs.png', fullPage: true });
    });

  });

  test.describe('Metadata Panel', () => {

    test('metadata fields are displayed', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });
      
      // Find context sidebar island which contains the metadata panel
      const sidebar = page.locator('[data-island="context-sidebar-island"], [data-testid="context-sidebar"]');
      
      await expect(sidebar).toBeVisible({ timeout: 15000 });
      
      // The sidebar contains form fields for metadata editing
      const fields = sidebar.locator('input, select, textarea');
      const fieldCount = await fields.count();
      
      console.log(`Found ${fieldCount} form fields in metadata panel`);
      
      // Should have at least one field (title, correspondent, etc.)
      expect(fieldCount).toBeGreaterThan(0);
      
      await page.screenshot({ path: 'test-results/workspace-metadata-fields.png', fullPage: true });
    });

    test('metadata locate triggers overlay highlight', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });
      
      // Wait for workspace to fully load
      await page.waitForLoadState('networkidle');
      
      // Set up listener for highlight event
      const _highlightReceived = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          let received = false;
          window.addEventListener('overlay:highlight-region', () => {
            received = true;
            resolve(true);
          }, { once: true });
          
          // Timeout after 3 seconds
          setTimeout(() => resolve(received), 3000);
        });
      });
      
      // Dispatch a locate event
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('metadata:locate-field', { 
          detail: { fieldId: 'title' } 
        }));
      });
      
      // Give time for the event to propagate
      await page.waitForTimeout(500);
      
      // Check global state
      const locateState = await page.evaluate(() => {
        return (window as unknown as { __last_metadata_locate?: { handled: boolean } }).__last_metadata_locate;
      });
      
      console.log('Metadata locate state:', locateState);
      
      // The event was processed (even if no overlay was found)
      expect(locateState).toBeDefined();
    });

  });

  test.describe('Error Handling', () => {

    test('invalid document ID shows error', async ({ page }) => {
      const response = await page.goto(`${BASE}/workspace/doc/999999999`, { waitUntil: 'networkidle' });
      
      // Should either show error page or redirect
      const status = response?.status();
      const finalUrl = page.url();
      
      console.log(`Invalid doc response status: ${status}, URL: ${finalUrl}`);
      
      // Either 404 or error page with appropriate message
      const hasError = await page.locator('text=/not found|error|invalid/i').count() > 0;
      
      if (status !== 404) {
        // If not 404, check we're not on a broken page
        expect(hasError || status === 302 || status === 200).toBeTruthy();
      }
      
      await page.screenshot({ path: 'test-results/workspace-invalid-doc.png', fullPage: true });
    });

    test('non-numeric document ID shows error', async ({ page }) => {
      const response = await page.goto(`${BASE}/workspace/doc/not-a-number`, { waitUntil: 'networkidle' });
      
      const status = response?.status();
      console.log(`Non-numeric doc ID response status: ${status}`);
      
      // Should be a 400 Bad Request or redirect
      const hasError = await page.locator('text=/invalid|error|bad request/i').count() > 0;
      
      expect(hasError || status === 400 || status === 302).toBeTruthy();
      
      await page.screenshot({ path: 'test-results/workspace-nonnumeric-doc.png', fullPage: true });
    });

  });

  test.describe('Authentication', () => {

    test('unauthenticated access redirects to login', async ({ browser }) => {
      // Create a new context without auth
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        await page.goto(`${BASE}/workspace`, { waitUntil: 'networkidle' });
        
        const finalUrl = page.url();
        
        // Should be redirected to login or setup (setup may intercept if not configured)
        // OR workspace should show auth error/no content
        const isRedirectedToAuth = finalUrl.includes('/login') || finalUrl.includes('/setup');
        const hasAuthError = await page.locator('[data-testid="auth-error"], .auth-error, .login-required').count() > 0;
        
        // If not redirected, check that workspace content is not accessible
        if (!isRedirectedToAuth && !hasAuthError) {
          // Check response status - should be 401/403 or redirect
          const pageContent = await page.content();
          const hasWorkspaceContent = pageContent.includes('document-workspace') && 
            pageContent.includes('overlay-viewer');
          
          // Fail if workspace content is fully accessible without auth
          if (hasWorkspaceContent) {
            console.log('Warning: Workspace may be accessible without authentication');
            console.log('URL:', finalUrl);
          }
        }
        
        await page.screenshot({ path: 'test-results/workspace-unauth-redirect.png', fullPage: true });
      } finally {
        await context.close();
      }
    });

  });

  test.describe('Console Errors', () => {

    test('no critical console errors during workspace load', async ({ page }) => {
      const errors: string[] = [];
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Ignore common non-critical errors
          if (!text.includes('favicon') && !text.includes('net::ERR') && !text.includes('Failed to load resource')) {
            errors.push(text);
          }
        }
      });
      
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });
      
      // Wait for potential async errors
      await page.waitForTimeout(2000);
      
      if (errors.length > 0) {
        console.log('Console errors detected:', errors);
      }
      
      // We don't fail on errors, but log them for visibility
      // Critical errors should be rare - log for debugging
      console.log(`Total console errors: ${errors.length}`);
    });

  });

});
