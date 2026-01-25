import { test, expect } from '@playwright/test';

// Position verification requires a fixture with known visual_overlays payload and a document image available.
// This scaffold is for test-agent to fill in once fixtures/infra are available.

test.describe('Visual overlay position verification', () => {
  test('overlay DOM positions match stored boxes within IoU tolerance (scaffold)', async ({ page }) => {
    test.skip(true, 'Requires fixture and infra to run');
  });
});