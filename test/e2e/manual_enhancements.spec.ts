import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');
const { navigateToWorkspace, switchTab } = require('../helpers/workspace-fixtures');

test.describe('Workspace Enhancements', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('Document Content Search', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await switchTab(page, 'content');

    await expect(page.getByTestId('document-content-island-root')).toBeVisible();

    const contentText = await page.getByTestId('document-content-area').textContent();
    const wordMatch = contentText?.match(/\b[a-zA-Z]{4,}\b/);
    if (!wordMatch) {
      test.skip(true, 'No searchable content available in OCR panel');
      return;
    }

    const query = wordMatch[0];
    await page.getByTestId('search-input').fill(query);

    await expect(page.getByTestId('search-count')).not.toContainText('0/0');
    await expect(page.locator('mark')).toContainText(query);
  });

  test('Visual Search Panel', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await switchTab(page, 'visual');
    await expect(page.getByTestId('overlay-viewer-root')).toBeVisible();

    await page.getByTestId('visual-search-btn').click();

    const container = page.getByTestId('overlay-container');
    const box = await container.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 150);
      await page.mouse.up();
    }

    await expect(page.getByTestId('visual-search-results-panel')).toBeVisible();
    await expect(page.getByText('Visual Search Results')).toBeVisible();
    await expect(page.getByText('Similar Doc')).toBeVisible();
  });
});
