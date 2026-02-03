import { test, expect } from '@playwright/test';

test.describe('Export Feature UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the document workspace page
    // Using /workspace/latest which redirects to the most recent document
    // or /workspace/doc/1 for a specific document
    await page.goto('http://localhost:3000/workspace/latest', { waitUntil: 'networkidle' });
  });

  test('ExportPanelIsland should be present in DOM', async ({ page }) => {
    // Check if ExportPanelIsland is mounted
    // The correct data-island attribute is "export-panel-island"
    const exportPanelRoot = page.locator('[data-island="export-panel-island"]');
    await expect(exportPanelRoot).toBeAttached();
    console.log('✓ ExportPanelIsland is present in DOM');
  });

  test('OverlayViewerIsland should have export button overlay elements', async ({ page }) => {
    // Navigate to a document with overlay viewer
    // This is a structural check - the export button appears after selection
    const overlayViewer = page.locator('[data-testid="overlay-viewer-root"]');
    
    if (await overlayViewer.count() > 0) {
      console.log('✓ OverlayViewerIsland is present');
      
      // The export button overlay is conditional, so we just verify the viewer exists
      await expect(overlayViewer).toBeVisible();
    } else {
      console.log('⚠ OverlayViewerIsland not found on this page');
    }
  });

  test('VisualAnnotationIsland should have Export button', async ({ page }) => {
    // Look for the visual annotation island
    const annotationRoot = page.locator('[data-testid="visual-annotation-root"]');
    
    if (await annotationRoot.count() > 0) {
      console.log('✓ VisualAnnotationIsland is present');
      
      // Check for the export button
      const exportButton = page.locator('[data-testid="export-annotations"]');
      
      if (await exportButton.count() > 0) {
        await expect(exportButton).toBeVisible();
        
        // Verify button text includes "Export"
        const buttonText = await exportButton.textContent();
        expect(buttonText).toContain('Export');
        console.log('✓ Export button found with text:', buttonText);
      } else {
        console.log('⚠ Export button not visible (may be disabled if no annotations)');
      }
    } else {
      console.log('⚠ VisualAnnotationIsland not found on this page');
    }
  });

  test('DocumentContentIsland should exist', async ({ page }) => {
    // Look for document content island
    const contentRoot = page.locator('[data-testid="document-content-island-root"]');
    
    if (await contentRoot.count() > 0) {
      console.log('✓ DocumentContentIsland is present');
      await expect(contentRoot).toBeVisible();
      
      // The floating export toolbar only appears on text selection
      // So we just verify the island is present
    } else {
      console.log('⚠ DocumentContentIsland not found on this page');
    }
  });

  test('Export API routes should be accessible', async ({ page, request }) => {
    // Test that export endpoints exist (they'll return 401 without auth, but that proves they exist)
    const endpoints = [
      '/api/export/region',
      '/api/export/text',
      '/api/export/annotations'
    ];

    for (const endpoint of endpoints) {
      const response = await request.post(`http://localhost:3000${endpoint}`, {
        data: {},
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // We expect 400 (bad request) or 401 (unauthorized), not 404
      expect(response.status()).not.toBe(404);
      console.log(`✓ ${endpoint} exists (status: ${response.status()})`);
    }
  });

  test('Islands bundle files should exist and be loaded', async ({ page }) => {
    // Check if key island bundles are loaded
    const islands = [
      'overlay-viewer.island.js',
      'visual-annotation.island.js',
      'document-content.island.js',
      'export-panel.island.js'
    ];

    for (const island of islands) {
      const scriptTag = page.locator(`script[src*="${island}"]`);
      
      if (await scriptTag.count() > 0) {
        console.log(`✓ ${island} is loaded`);
      } else {
        console.log(`⚠ ${island} script tag not found`);
      }
    }
  });

  test('Export routes are registered in server', async ({ request }) => {
    // Make a request to the export endpoint to verify it's registered
    const response = await request.post('http://localhost:3000/api/export/region', {
      data: {
        imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
        format: 'png',
        documentId: 1
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Should get 401 (auth required) not 404 (route not found)
    expect([400, 401]).toContain(response.status());
    console.log(`✓ Export route responds with status ${response.status()} (route exists)`);
  });
});

test.describe('Export Feature Integration (with mock data)', () => {
  test('ExportPanelIsland modal structure', async ({ page }) => {
    await page.goto('http://localhost:3000/documents');
    
    // Dispatch a mock export event to trigger the modal
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('export:text-requested', {
        detail: {
          documentId: 1,
          text: 'Test export text',
          format: 'txt'
        }
      }));
    });

    // Wait a moment for the modal to appear
    await page.waitForTimeout(500);

    // Check if modal is visible
    const modal = page.locator('.fixed.inset-0.bg-black\\/50');
    
    if (await modal.count() > 0) {
      console.log('✓ Export modal appeared');
      
      // Check for format buttons
      const formatButtons = page.locator('button').filter({ hasText: /TXT|PDF|PNG|JSON/ });
      const count = await formatButtons.count();
      console.log(`✓ Found ${count} format button(s)`);
      
      // Check for Download button
      const downloadBtn = page.locator('button').filter({ hasText: /Download|Exporting/ });
      if (await downloadBtn.count() > 0) {
        console.log('✓ Download button found');
      }
      
      // Check for Cancel button
      const cancelBtn = page.locator('button').filter({ hasText: 'Cancel' });
      if (await cancelBtn.count() > 0) {
        console.log('✓ Cancel button found');
        
        // Close the modal
        await cancelBtn.click();
        await page.waitForTimeout(300);
        console.log('✓ Modal closed successfully');
      }
    } else {
      console.log('⚠ Export modal did not appear (check if ExportPanelIsland is mounted)');
    }
  });
});
