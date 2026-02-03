import { test, expect } from '@playwright/test';

test.describe('Manual Route Enhancements', () => {
  test.beforeEach(async ({ page }) => {
    // Mock document preview
    await page.route('/workspace/api/doc/*', async route => {
      const json = {
        id: 123,
        title: 'Test Document',
        content: 'This is a sample document content for testing search functionality. It contains keywords like invoice, total, and date.',
        tags: [],
        pageCount: 1,
        original_url: null
      };
      await route.fulfill({ json });
    });

    // Mock documents list
    await page.route('/workspace/api/documents', async route => {
      await route.fulfill({
        json: [
          { id: 123, title: 'Test Document' }
        ]
      });
    });

    // Mock visual search
    await page.route('/api/visual-rag/search/visual', async route => {
      await route.fulfill({
        json: {
          results: [
            { document_id: 123, page: 1, score: 0.95, title: 'Test Document', thumbnail: '' },
            { document_id: 456, page: 1, score: 0.88, title: 'Similar Doc', thumbnail: '' }
          ]
        }
      });
    });

    await page.goto('/manual');
    // Select document
    await page.selectOption('[data-testid="manual-document-select"]', '123');
    await expect(page.getByTestId('guided-rail')).toContainText('Reviewing Test Document');
  });

  test('Document Content Search', async ({ page }) => {
    // Check if content island is loaded
    await expect(page.getByTestId('document-content-island-root')).toBeVisible();
    
    // Type search
    await page.getByTestId('search-input').fill('invoice');
    
    // Check count
    await expect(page.getByTestId('search-count')).toContainText('1/');
    
    // Check highlight
    // Note: highlighting uses <mark>, we check if it exists
    await expect(page.locator('mark')).toContainText('invoice');
  });

  test('Visual Search Panel', async ({ page }) => {
    // Switch to Visual
    await page.getByTestId('view-mode-toggle-visual').click();
    await expect(page.getByTestId('overlay-viewer-root')).toBeVisible();

    // Mock drawing
    // We can't easily drag on canvas in this mock, but we can trigger the event if possible
    // Or try to simulate drag on the overlay-container
    
    const container = page.getByTestId('overlay-container');
    const box = await container.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 150);
      await page.mouse.up();
    }

    // Expect results panel to appear
    await expect(page.getByTestId('visual-search-results-panel')).toBeVisible();
    await expect(page.getByText('Visual Search Results')).toBeVisible();
    await expect(page.getByText('Similar Doc')).toBeVisible();
  });
});
