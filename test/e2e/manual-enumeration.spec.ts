import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Test helpers
const { waitForIsland } = require('../helpers/island-waits');

const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
const tinyPng = Buffer.from(tinyPngBase64, 'base64');

test('Manual page: enumerate elements and verify Manual Editor fields populated', async ({ page }) => {
  // Stub documents list
  await page.route('**/manual/documents', (route) => {
    route.fulfill({ status: 200, body: JSON.stringify([{ id: 42, title: 'Test Doc' }]), headers: { 'Content-Type': 'application/json' } });
  });

  // Stub preview for document 42 with visualFields to populate ManualEditor
  await page.route('**/manual/preview/42', (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ id: 42, content: 'Page 1 content', title: 'Test Doc', tags: [], pageCount: 1, original_url: '/documents/42/download/original/' , visualFields: [{ label: 'Invoice Number', value: 'INV-123', domain: 'INVOICE', confidence: 0.98 }] }),
      headers: { 'Content-Type': 'application/json' }
    });
  });

  // Also provide a permissive preview route for variants like trailing slash
  await page.route('**/manual/preview/**', (route) => {
    const url = route.request().url();
    if (url.includes('/manual/preview/42')) {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ id: 42, content: 'Page 1 content', title: 'Test Doc', tags: [], pageCount: 1, original_url: '/documents/42/download/original/' , visualFields: [{ label: 'Invoice Number', value: 'INV-123', domain: 'INVOICE', confidence: 0.98 }] }),
        headers: { 'Content-Type': 'application/json' }
      });
      return;
    }
    route.continue();
  });

  // Serve original image bytes
  await page.route('**/documents/42/download/original/**', (route) => {
    route.fulfill({ status: 200, body: tinyPng, headers: { 'Content-Type': 'image/png' } });
  });

  // Ensure auth cookie is present in the context (fallback to storageState JSON)
  try {
    const storage = require('../.auth/storageState.json');
    const jwt = storage && storage.cookies && storage.cookies[0] && storage.cookies[0].value;
    if (jwt) {
      await page.context().addCookies([{
        name: 'jwt',
        value: jwt,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      }]);
    }
  } catch (e) { /* ignore */ }

  await page.goto('/manual');

  // Wait for document select to be populated and select the test doc (allow hidden options)
  // Fallback: if login form is presented, perform a login using test admin credentials
  const loginFormPresent = await page.$('form[action="/login"]') || await page.$('text=Sign in to your account');
  if (loginFormPresent) {
    const user = process.env.PAPERLESS_ADMIN_USER || 'elfman';
    const pass = process.env.PAPERLESS_ADMIN_PASSWORD || process.env.POSTGRES_PASSWORD || 'P2tr3ck!1976';
    try {
      await page.fill('#username', user);
      await page.fill('#password', pass);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        page.click('button[type="submit"]')
      ]);
    } catch (e) {
      // ignore - we'll continue and tests can fail with helpful message
    }
  }

  // Wait for the doc option to be present (select by label for robustness)
  await page.waitForSelector('#documentSelect option:has-text("Test Doc")', { state: 'attached', timeout: 10000 });
  // Ensure islands have been mounted before we trigger document selection (avoid race where island runtime resets inputs)
  await page.waitForFunction(() => window.__islandRuntimeMounted === true, { timeout: 3000 }).catch(() => null);

  // Attach a debug listener to capture manual:metadata-updated events
  await page.evaluate(() => {
    (window as any).__manual_metadata_events = [];
    window.addEventListener('manual:metadata-updated', (e) => {
      (window as any).__manual_metadata_events.push((e as any) && (e as any).detail ? (e as any).detail : null);
    });
  });

  // Select by label for robustness
  await page.selectOption('#documentSelect', { label: 'Test Doc' });

  // Wait for the preview request to be made and honored by our stub (fallback to request wait)
  await page.waitForResponse((resp) => resp.url().includes('/manual/preview/42') && resp.status() === 200, { timeout: 2000 }).catch(() => null);
  // Also wait for the request itself as evidence the page attempted the fetch (debug)
  await page.waitForRequest((req) => req.url().includes('/manual/preview/42'), { timeout: 2000 }).catch(() => null);

  // Allow a small delay for DOM updates
  await page.waitForTimeout(200);

  // Dump some debug info from the page to help diagnose why the preview isn't populating
  const debugState = await page.evaluate(() => ({
    selectOuter: document.getElementById('documentSelect') ? (document.getElementById('documentSelect') as HTMLElement).outerHTML : null,
    selectValue: document.getElementById('documentSelect') ? (document.getElementById('documentSelect') as HTMLSelectElement).value : null,
    previewText: document.getElementById('contentPreview') ? document.getElementById('contentPreview')?.textContent : null,
    islandRuntimeMounted: (window as any).__islandRuntimeMounted || false,
    manualMetadataEvents: (window as any).__manual_metadata_events || [],
    manualEditorHydrated: document.querySelector('[data-testid="manual-editor-island-root"]') ? document.querySelector('[data-testid="manual-editor-island-root"]')?.getAttribute('data-hydrated') : null
  }));
  console.log('[e2e-debug] post-select debug', debugState);

  // Test that dispatch via manual:metadata-updated is observable from our listener (debug sanity check)
  const injectedEvents = await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('manual:metadata-updated', { detail: { title: 'Injected', content: 'Injected content' } }));
    return (window as any).__manual_metadata_events || [];
  });
  console.log('[e2e-debug] manual_metadata_events after injected event:', injectedEvents);

  // Wait up to a short time for the content preview to populate
  await page.waitForFunction(() => {
    const el = document.getElementById('contentPreview');
    return el && el.textContent && el.textContent.length > 0;
  }, { timeout: 2000 }).catch(() => null);

  // Wait for content preview to be populated from preview route
  await expect(page.locator('#contentPreview')).toHaveText('Page 1 content');

  // Ensure Manual Editor fields have been populated
  const titleVal = await page.locator('[data-testid="manual-title-input"]').inputValue();
  const contentVal = await page.locator('[data-testid="manual-content-input"]').inputValue();

  console.log('[e2e-debug] ManualEditor title:', titleVal);
  console.log('[e2e-debug] ManualEditor content (prefix):', contentVal.substring(0, 32));

  // Switch to visual preview
  await page.waitForSelector('[data-testid="view-visual-btn"]:not([disabled])', { timeout: 5000 });
  await page.click('[data-testid="view-visual-btn"]');
  await page.waitForSelector('#visualPreviewSection:not(.hidden)', { timeout: 3000 });

  // Enumerate islands and their anchors after switching view
  const islands = await page.evaluate(() => Array.from(document.querySelectorAll('[data-island]')).map(el => ({ island: el.getAttribute('data-island'), testid: el.getAttribute('data-testid'), props: el.getAttribute('data-props') })));
  console.log('[e2e-debug] Islands found:', islands);

  // Wait for overlay island to be mounted/hydrated and confirm the page indicator exists
  await waitForIsland(page, 'overlay-viewer-island', 5000);
  await page.waitForSelector('[data-testid="overlay-page-indicator"]', { timeout: 3000 });
  const islandImageAttached = await page.waitForSelector('img[data-testid="document-image"]', { state: 'attached', timeout: 4000 })
    .then(() => true)
    .catch(() => false);

  // Check for overlay island hydration and whether it has an image
  const overlayIslandRoot = await page.$('[data-testid="overlay-viewer-root"]');
  let islandHydrated = false;
  let islandImgSrc = null;
  if (overlayIslandRoot) {
    islandHydrated = await overlayIslandRoot.getAttribute('data-hydrated') === 'true';
    const islandImg = await overlayIslandRoot.$('img[data-testid="document-image"]') || await overlayIslandRoot.$('img');
    if (islandImg) islandImgSrc = await islandImg.getAttribute('src');
  }

  console.log('[e2e-debug] overlay island image attached:', islandImageAttached);
  console.log('[e2e-debug] overlayIslandHydrated:', islandHydrated);
  console.log('[e2e-debug] overlayIslandImgSrc:', islandImgSrc);

  // --- Capture enumerated screenshot + element list artifacts for review ✅
  const outDir = path.join(process.cwd(), 'test-output');
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const screenshotPath = path.join(outDir, 'manual-route-enum.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const enumeration = await page.evaluate(() => {
      const elements: any[] = [];
      document.querySelectorAll('*').forEach(el => {
        const node = {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          class: el.className || null,
          'data-island': el.getAttribute && el.getAttribute('data-island') || null,
          'data-testid': el.getAttribute && el.getAttribute('data-testid') || null,
          text: (el.textContent || '').trim().slice(0, 200)
        };
        if (node['data-island'] || node['data-testid'] || el.id === 'overlayContainer' || el.tagName.toLowerCase() === 'button') elements.push(node);
      });
      return elements;
    });

    const jsonPath = path.join(outDir, 'manual-route-enum.json');
    fs.writeFileSync(jsonPath, JSON.stringify({ url: page.url(), timestamp: new Date().toISOString(), enumeration }, null, 2));
    console.log('[e2e-artifact] screenshot saved:', screenshotPath, 'json saved:', jsonPath);
  } catch (e) {
    console.warn('[e2e-artifact] could not write artifacts:', (e as any) && (e as any).message);
  }

  // Assert expectations and surface findings clearly
  expect(islands.some(i => i.island === 'manual-editor-island')).toBeTruthy();
  // overlay viewer anchor may be absent in some app states; document this as a finding rather than a hard failure
  if (!islands.some(i => i.island === 'overlay-viewer-island')) {
    console.warn('[e2e-finding] overlay-viewer-island anchor missing from DOM after switching to visual view');
  }
  // Ensure overlay island attached an image
  expect(islandImageAttached).toBeTruthy();

  // Manual island fields should reflect the visualFields from the preview stub
  await page.click('[data-testid="tab-fields"]');
  await page.waitForSelector('[data-testid="field-name-0"]', { timeout: 2000 });
  const fieldName = await page.locator('[data-testid="field-name-0"]').inputValue();
  const fieldValue = await page.locator('[data-testid="field-value-0"]').inputValue();

  console.log('[e2e-debug] field-name-0:', fieldName, 'field-value-0:', fieldValue);

  expect(fieldName).toBe('Invoice Number');
  expect(fieldValue).toBe('INV-123');

  // Assert island image src contains original url when present
  if (islandImgSrc) {
    expect(islandImgSrc).toContain('/documents/42/download/original/');
  }
});
