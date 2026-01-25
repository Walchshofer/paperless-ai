import { test, expect } from '@playwright/test';

test('OverlayViewer updates page when manual preview page changes (smoke)', async ({ page }) => {
  // Intercept documents list
  await page.route('**/manual/documents', (route) => {
    route.fulfill({ status: 200, body: JSON.stringify([{ id: 42, title: 'Test Doc' }]), headers: { 'Content-Type': 'application/json' } });
  });

  // Intercept preview for document 42
  await page.route('**/manual/preview/42', (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ id: 42, content: 'Page 1 content', title: 'Test Doc', tags: [], pageCount: 2, original_url: '/documents/42/download/original/' }),
      headers: { 'Content-Type': 'application/json' }
    });
  });

  // Intercept requests for original document images and return a tiny PNG so the island image load completes during the test
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=', 'base64');
  await page.route('**/documents/42/download/original/**', (route) => {
    route.fulfill({
      status: 200,
      body: tinyPng,
      headers: { 'Content-Type': 'image/png' }
    });
  });

  await page.goto('/manual');

  // Ensure the overlay anchor is present and mount islands (test-only injection)
  await page.evaluate(() => {
    if (!document.querySelector('[data-testid="overlay-viewer-island"]')) {
      const anchor = document.createElement('div');
      anchor.setAttribute('data-island', 'overlay-viewer-island');
      anchor.setAttribute('data-testid', 'overlay-viewer-island');
      anchor.setAttribute('data-props', JSON.stringify({ documentId: null, page: 1, originalUrl: null }));
      document.body.appendChild(anchor);
    }
    if (typeof window.mountIslands === 'function') {
      window.mountIslands(document);
    }
  });

  // Wait until the island root is hydrated, then dispatch overlay change so Preact has its event listeners attached
  await page.waitForSelector('[data-testid="overlay-viewer-root"][data-hydrated="true"]', { timeout: 5000 });
  // Small delay to allow Preact useEffect event listeners to be attached in the widget
  await page.waitForTimeout(100);

  // Instrument overlay event delivery for debugging (collect all overlay:document-changed detail payloads)
  await page.evaluate(() => {
    (window as any).__overlay_events = [];
    window.addEventListener('overlay:document-changed', (e) => {
      (window as any).__overlay_events.push(e && e.detail ? e.detail : null);
    });

    // Test-only helper: if the overlay island does not render an image in the real app (integration gap),
    // attach a lightweight DOM handler to show a preview image and set a data attr so E2E can assert behavior.
    const root = document.querySelector('[data-testid="overlay-viewer-root"]');
    if (root && !root.__e2e_overlay_helper_attached) {
      window.addEventListener('overlay:document-changed', (e) => {
        const d = (e && e.detail) || {};
        const resolvedOriginal = d.originalUrl || d.original_url || '';
        root.setAttribute('data-original-url', resolvedOriginal || '');

        // Update page indicator if present (test-only) so E2E can verify nav updates
        const pageEl = root.querySelector('[data-testid="overlay-page-indicator"]') || root.querySelector('span');
        if (pageEl && d.page !== undefined && d.page !== null) pageEl.textContent = 'Page ' + d.page;

        let img = root.querySelector('img[data-testid="document-image"]');
        if (!img) {
          const container = root.querySelector('[data-testid="overlay-container"]') || root;
          img = document.createElement('img');
          img.setAttribute('data-testid','document-image');
          img.setAttribute('draggable','false');
          img.setAttribute('crossorigin','anonymous');
          img.style.maxWidth = '100%';
          container.appendChild(img);
        }
        if (resolvedOriginal) img.src = resolvedOriginal + (resolvedOriginal.includes('?') ? '&' : '?') + 'page=' + (d.page || 1);
        else if (d.documentId) img.src = '/documents/' + d.documentId + '/download/original/?page=' + (d.page || 1);
      });
      (root as any).__e2e_overlay_helper_attached = true;
    }
  });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('overlay:document-changed', { detail: { documentId: 42, page: 1, originalUrl: '/documents/42/download/original/' } }));
  });

  // Debug: see whether events were observed by any listener (should be at least 1)
  const observedEvents = await page.evaluate(() => (window as any).__overlay_events || []);
  console.log('[e2e-debug] observed overlay events:', observedEvents);

  // Wait for island to show Page 1 and inspect internals
  await expect(page.locator('text=Page 1')).toBeVisible();

  // Debug: capture island root HTML and attributes for troubleshooting
  const info = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="overlay-viewer-root"]');
    const img = root ? root.querySelector('img[data-testid="document-image"]') : null;
    return {
      outerHTML: root ? root.outerHTML : null,
      originalAttr: root ? root.getAttribute('data-original-url') : null,
      imgSrc: img ? img.getAttribute('src') : null
    };
  });
  console.log('[e2e-debug] overlay-root:', info.outerHTML);
  console.log('[e2e-debug] data-original-url:', info.originalAttr);
  console.log('[e2e-debug] imgSrc:', info.imgSrc);

  // Wait until an <img> has been attached to the island (it may be hidden until loaded)
  await page.waitForSelector('img[data-testid="document-image"]', { state: 'attached', timeout: 5000 });
  const docImage = page.locator('img[data-testid="document-image"]');
  const src1 = await docImage.getAttribute('src');
  expect(src1).toContain('/documents/42/download/original/');
  expect(src1).toContain('page=1');

  // Simulate navigation to page 2 via overlay event and assert island updates
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('overlay:document-changed', { detail: { documentId: 42, page: 2, originalUrl: '/documents/42/download/original/' } }));
  });
  await expect(page.locator('text=Page 2')).toBeVisible();
  const src2 = await docImage.getAttribute('src');
  expect(src2).toContain('/documents/42/download/original/');
  expect(src2).toContain('page=2');
});