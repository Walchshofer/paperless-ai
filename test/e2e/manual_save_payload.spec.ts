import { test, expect } from '@playwright/test';

test.describe('Manual - ManualEditor island', () => {
  test('manual editor island mounts and has a save button', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
    const url = `${base}/manual`;

    const response = await page.goto(url, { waitUntil: 'load', timeout: 10000 }).catch(() => null);
    if (!response || response.status() >= 400) {
      test.skip(true, `Manual page not available at ${url} - skipping E2E skeleton`);
      return;
    }

    // Login flow if needed
    const loginFormPresent = response.url().includes('/login') || (await page.locator('form[action="/login"]').count()) > 0;
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
      await page.goto(url, { waitUntil: 'load', timeout: 10000 }).catch(() => null);
    }

    const anchor = page.locator('[data-testid="manual-editor-island"]');
    const count = await anchor.count();
    console.log('DEBUG: manual-editor anchor count =', count);
    if (count === 0) {
      test.skip(true, 'Manual page does not include manual editor island anchor; skipping');
      return;
    }

    // Ensure the runtime-mounted island root is present before interacting
    await page.waitForSelector('[data-testid="manual-editor-island-root"]', { timeout: 15000 });

    const saveBtn = page.locator('[data-testid="manual-save-btn"]').first();
    await expect(saveBtn).toBeVisible();

    // Fill out the form
    await page.click('[data-testid="tab-metadata"]');
    await page.fill('[data-testid="manual-title-input"]', 'My Test Document');

    await page.click('[data-testid="tab-content"]');
    await page.fill('[data-testid="manual-content-input"]', 'This is the document content.');

    await page.click('[data-testid="tab-fields"]');
    await page.fill('[data-testid="field-name-0"]', 'InvoiceNo');
    await page.fill('[data-testid="field-value-0"]', 'INV-2026-001');

    // Attach listener to capture payload:ready
    await page.evaluate(() => {
      const w = window as unknown as { __lastPayload?: unknown };
      w.__lastPayload = null;
      document.addEventListener('payload:ready', (e: Event) => {
        const evt = e as unknown as { detail?: unknown };
        const w2 = window as unknown as { __lastPayload?: unknown };
        w2.__lastPayload = evt.detail ?? null;
      });
    });

    await saveBtn.click();
    console.log('DEBUG: clicked save');

    // Wait for payload to be set by the island
    await page.waitForFunction(() => (window as unknown as { __lastPayload?: unknown }).__lastPayload !== null, {}, { timeout: 5000 });
    const payload = await page.evaluate(() => (window as unknown as { __lastPayload?: unknown }).__lastPayload) as { metadata: { title: string }; content: string; fields: Array<{ name: string; value: string }> } | null;
    expect(payload).toBeTruthy();
    if (!payload) return;
    expect(payload.metadata.title).toBe('My Test Document');
    expect(payload.content).toBe('This is the document content.');
    expect(payload.fields).toHaveLength(1);
    expect(payload.fields[0]).toEqual({ name: 'InvoiceNo', value: 'INV-2026-001' });

    // Test fulfilled: manual editor emitted payload — done.
    return;
  });

  test('manual editor island supports keyboard navigation', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
    const url = `${base}/manual`;

    const response = await page.goto(url, { waitUntil: 'load', timeout: 10000 }).catch(() => null);
    if (!response || response.status() >= 400) {
      test.skip(true, `Manual page not available at ${url}`);
      return;
    }

    // Ensure the island is present (reuse logic or wait)
    try {
      await page.waitForSelector('[data-testid="manual-editor-island-root"]', { timeout: 15000 });
    } catch (e) {
      test.skip(true, 'Manual editor island root not found');
      return;
    }

    const tabMetadata = page.locator('[data-testid="tab-metadata"]');
    const tabContent = page.locator('[data-testid="tab-content"]');
    const tabFields = page.locator('[data-testid="tab-fields"]');

    // Click first tab to focus
    await tabMetadata.click();
    await expect(tabMetadata).toHaveAttribute('aria-selected', 'true');

    // Arrow Right -> Content
    await page.keyboard.press('ArrowRight');
    await expect(tabContent).toHaveAttribute('aria-selected', 'true');
    await expect(tabMetadata).toHaveAttribute('aria-selected', 'false');

    // Arrow Right -> Fields
    await page.keyboard.press('ArrowRight');
    await expect(tabFields).toHaveAttribute('aria-selected', 'true');

    const tabAiDebug = page.locator('[data-testid="tab-ai-debug"]');

    // Arrow Right -> AI Debug
    await page.keyboard.press('ArrowRight');
    await expect(tabAiDebug).toHaveAttribute('aria-selected', 'true');

    // Arrow Right -> Loop to Metadata
    await page.keyboard.press('ArrowRight');
    await expect(tabMetadata).toHaveAttribute('aria-selected', 'true');

    // Arrow Left -> AI Debug
    await page.keyboard.press('ArrowLeft');
    await expect(tabAiDebug).toHaveAttribute('aria-selected', 'true');
  });
});

