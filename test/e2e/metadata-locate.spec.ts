import { test, expect } from '@playwright/test';
const fixtures = require('../helpers/fixtures');
const { waitForIsland } = require('../helpers/island-waits');

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('Metadata locate -> Overlay highlight', () => {
  test('dispatching metadata:locate-field triggers overlay highlight', async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });

    await waitForIsland(page, 'overlay-viewer-island', 10000);

    // Dispatch the event from page context. Use a fieldId which is likely to exist in fixtures.
    // If fixtures don't contain such mappings, this test will act as a smoke check for the event plumbing.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('metadata:locate-field', { detail: { fieldId: 'total_amount' } }));
    });

    // Wait for the highlight region element to appear
    await page.waitForSelector('[data-testid="overlay-highlight-region"]', { timeout: 5000 });
    const highlight = await page.$('[data-testid="overlay-highlight-region"]');
    await expect(highlight).toBeTruthy();
  });
});
