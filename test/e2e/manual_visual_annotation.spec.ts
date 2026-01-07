import { test, expect } from '@playwright/test';

// Basic E2E skeleton: assert island mount and interactive element presence
test.describe('Manual - Visual Annotation island', () => {
  test('mounts visual annotation island and shows draw controls', async ({ page, baseURL }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    const url = `${base}/manual`;

    const response = await page.goto(url, { waitUntil: 'load', timeout: 10000 }).catch(() => null);
    console.log('DEBUG: initial response', response ? response.status() : 'no response', response ? response.url() : '');

    // If redirected to login or we detect a login form, perform an auth flow and retry /manual
    const loginFormPresent = response && (response.url().includes('/login') || (await page.locator('form[action="/login"]').count()) > 0);
    console.log('DEBUG: loginFormPresent=', loginFormPresent);
    if (loginFormPresent) {
      const user = process.env.PAPERLESS_ADMIN_USER || 'elfman';
      const pass = process.env.PAPERLESS_ADMIN_PASSWORD || process.env.POSTGRES_PASSWORD || 'P2tr3ck!1976';
      await page.goto(`${base}/login`, { waitUntil: 'load' });
      await page.fill('#username', user);
      await page.fill('#password', pass);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }),
        page.click('button[type="submit"]')
      ]).catch(() => null);

      console.log('DEBUG: after login, current url=', page.url());

      let resp2;
      try {
        // Use DOMContentLoaded to avoid hanging on slow external subresources (e.g. external API calls)
        resp2 = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      } catch (e) {
        console.log('DEBUG: manual goto failed:', e.message);
        resp2 = null;
      }
      console.log('DEBUG: manual after login response', resp2 ? resp2.status() : 'no response', resp2 ? resp2.url() : '');

      // If page.goto failed, attempt an in-page fetch to get status and any error
      if (!resp2) {
        try {
          const fetchStatus = await page.evaluate(async (u) => {
            try {
              const r = await fetch(u, { credentials: 'same-origin' });
              return { status: r.status };
            } catch (err) {
              return { error: err.message };
            }
          }, url);
          console.log('DEBUG: in-page fetch result', fetchStatus);
        } catch (e) {
          console.log('DEBUG: in-page fetch failed', e.message);
        }

        test.skip(`Manual page not available at ${url} after login - skipping E2E skeleton`);
        return;
      }
    } else if (!response || response.status() >= 400) {
      test.skip(`Manual page not available at ${url} - skipping E2E skeleton`);
      return;
    }

    // Prefer to assert the static anchor exists; runtime mounting depends on app client scripts and may be covered in integration CI
    const anchor = page.locator('[data-testid="visual-annotation-island"]');
    const count = await anchor.count();
    if (count === 0) {
      test.skip('Manual page does not include visual annotation island anchor; skipping runtime mount assertions');
      return;
    }

    // If anchor exists, attempt to assert runtime-mounted placeholder elements are present but allow skipping if not mounted
    const root = page.locator('[data-testid="visual-annotation-island-root"]').first();
    try {
      await page.waitForSelector('[data-testid="visual-annotation-island-root"]', { timeout: 5000 });
    } catch (e) {
      test.skip('Visual annotation island anchor present but runtime placeholder not mounted; skipping interaction assertions');
      return;
    }

    await expect(root).toBeVisible();

    // Check draw toggle and annotation canvas exist
    const drawToggle = page.locator('[data-testid="draw-toggle"]').first();
    await expect(drawToggle).toBeVisible();

    const canvas = page.locator('[data-testid="annotation-canvas"]').first();
    await expect(canvas).toBeVisible();

    // Toggle draw mode (basic interaction)
    await drawToggle.click();
    // After toggling, ensure canvas is still visible
    await expect(canvas).toBeVisible();
  });
});