const { chromium } = require('playwright');

(async () => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const loginUser = process.env.PAPERLESS_ADMIN_USER || 'elfman';
  const loginPass = process.env.PAPERLESS_ADMIN_PASSWORD || process.env.POSTGRES_PASSWORD || 'P2tr3ck!1976';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('[console]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[pageerror]', err.message));
  page.on('requestfailed', req => console.log('[requestfailed]', req.url(), req.failure() && req.failure().errorText));

  console.log('Navigating to', `${base}/manual`);
  let response = await page.goto(`${base}/manual`, { waitUntil: 'load', timeout: 15000 }).catch(e => null);
  if (!response) {
    console.log('No initial response for /manual');
  } else {
    console.log('Initial response:', response.status(), response.url());
  }

  // Check for login form
  const hasLoginForm = await page.locator('form[action="/login"]').count().catch(() => 0);
  console.log('Login form present:', hasLoginForm > 0);

  if (hasLoginForm > 0) {
    console.log('Attempting to login with', loginUser);
    await page.fill('#username', loginUser);
    await page.fill('#password', loginPass);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }).catch(() => null),
      page.click('button[type="submit"]')
    ]).catch(() => null);

    const after = page.url();
    console.log('After login, location:', after);
  }

  // Re-check manual page
  response = await page.goto(`${base}/manual`, { waitUntil: 'load', timeout: 15000 }).catch(() => null);
  console.log('Manual response after auth:', response ? response.status() : 'no response', response ? response.url() : '');

  // Check for anchor and runtime placeholder
  const anchorCount = await page.locator('[data-testid="visual-annotation-island"]').count();
  console.log('Anchor count:', anchorCount);

  const rootPresent = await page.locator('[data-testid="visual-annotation-island-root"]').count();
  console.log('Runtime placeholder root present:', rootPresent);

  // Dump a small HTML snippet around the anchor if present
  if (anchorCount > 0) {
    const snippet = await page.locator('[data-testid="visual-annotation-island"]').first().evaluate(node => node.outerHTML);
    console.log('Anchor HTML snippet:\n', snippet.substring(0, 1000));
  }

  // Check scripts loaded (e.g., manual.js)
  const scripts = await page.locator('script[src]').evaluateAll(nodes => nodes.map(n => n.getAttribute('src')));
  console.log('Scripts on page:', scripts);

  await browser.close();

  // Exit non-zero if placeholder not present (so CI can detect failures)
  if (rootPresent === 0) {
    console.error('Runtime placeholder not present — debug run indicates test would skip.');
    process.exit(2);
  }

  console.log('Runtime placeholder present — debug run succeeded.');
  process.exit(0);
})();