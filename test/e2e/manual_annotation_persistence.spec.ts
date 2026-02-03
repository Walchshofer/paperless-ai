import { test, expect, Page, BrowserContext, Locator } from '@playwright/test';
import jwt from 'jsonwebtoken';

// Helpers
async function ensureLoggedInAs(page: Page, ctx: BrowserContext, base: string, userId = 1, username = 'testuser') {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const token = jwt.sign({ id: userId, username }, secret);
  // clear existing cookies and set jwt cookie for the test domain
  await ctx.clearCookies();
  const url = new URL(base);
  await ctx.addCookies([{ name: 'jwt', value: token, domain: url.hostname, path: '/' }]);
}

async function selectFirstDocument(page: Page): Promise<number> {
  // Wait for document select to be populated and choose the first real option
  const select = page.locator('[data-testid="manual-document-select"]');
  await expect(select).toBeVisible({ timeout: 10000 });
  // wait until there is at least one non-empty option
  await page.waitForFunction(() => {
    const s = document.getElementById('documentSelect') as HTMLSelectElement | null;
    if (!s) return false;
    return Array.from(s.options).some(o => o.value && o.value !== '');
  }, null, { timeout: 10000 });

  const options = await select.locator('option').all();
  let pickValue = null;
  for (const opt of options) {
    const v = await opt.getAttribute('value');
    if (v && v !== '') { pickValue = v; break; }
  }
  if (!pickValue) throw new Error('No document options available to select');
  await select.selectOption(pickValue);
  return Number(pickValue);
}

// Draw a box on the annotation canvas. coords are relative percentages of width/height
async function drawBoxOnCanvas(page: Page, canvasLocator: Locator, startPct: [number, number], endPct: [number, number]) {
  const box = await canvasLocator.boundingBox();
  if (!box) throw new Error('Canvas bounding box not found');
  const sx = box.x + box.width * startPct[0];
  const sy = box.y + box.height * startPct[1];
  const ex = box.x + box.width * endPct[0];
  const ey = box.y + box.height * endPct[1];
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(ex, ey, { steps: 8 });
  await page.mouse.up();
}

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

// Tests
test.describe('Manual - Annotation persistence & per-user isolation', () => {
  test('save → reload → update → delete flow persists annotations for user', async ({ page, context }) => {
    await ensureLoggedInAs(page, context, base, 100, 'user100');

    // open manual and select a document
    await page.goto(`${base}/manual`, { waitUntil: 'load' });
    const _docId = await selectFirstDocument(page);

    // ensure annotation island is mounted
    await page.waitForSelector('[data-testid="visual-annotation-island-root"]', { timeout: 10000 });

    const drawToggle = page.locator('[data-testid="draw-toggle"]').first();
    const canvas = page.locator('[data-testid="annotation-canvas"]').first();

    await drawToggle.click();

    // draw a box (10%,10% to 40%,40%)
    await drawBoxOnCanvas(page, canvas, [0.1, 0.1], [0.4, 0.4]);

    // fill label and save
    const labelInput = page.locator('[data-testid="annotation-label-0"]').first();
    await expect(labelInput).toBeVisible({ timeout: 2000 });
    await labelInput.fill('E2E Test Annotation');

    // Intercept the POST to /api/annotations
    const postPromise = page.waitForResponse(resp => resp.url().endsWith('/api/annotations') && resp.request().method() === 'POST');

    await page.click('[data-testid="save-annotations"]');

    const postResp = await postPromise;
    expect(postResp.ok()).toBeTruthy();
    const payload = await postResp.json();
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.created)).toBe(true);
    const created = payload.created[0];
    expect(created).toBeTruthy();
    const annotationId = created.id;

    // Reload and re-select doc, then assert annotation present
    await page.reload({ waitUntil: 'load' });
    await selectFirstDocument(page);
    // wait for annotations to load into island
    await page.waitForSelector('[data-testid="annotation-item"]', { timeout: 5000 });
    const labelAfter = await page.locator('[data-testid="annotation-label-0"]').inputValue();
    expect(labelAfter).toBe('E2E Test Annotation');

    // Update the label and assert PUT to /api/annotations/:id
    const putPromise = page.waitForResponse(resp => resp.url().endsWith(`/api/annotations/${annotationId}`) && resp.request().method() === 'PUT');
    await page.locator('[data-testid="annotation-label-0"]').fill('Updated Annotation');
    // small wait for the island to send the PUT
    const putResp = await putPromise;
    expect(putResp.ok()).toBeTruthy();
    const putJson = await putResp.json();
    expect(putJson.success).toBeTruthy();

    // Delete annotation and assert it is removed server-side and UI
    const delPromise = page.waitForResponse(resp => resp.url().endsWith(`/api/annotations/${annotationId}`) && resp.request().method() === 'DELETE');
    // Click remove on first item
    await page.click('[data-testid="remove-btn-0"]');
    const delResp = await delPromise;
    expect(delResp.ok()).toBeTruthy();

    // reload and confirm it's gone
    await page.reload({ waitUntil: 'load' });
    await selectFirstDocument(page);
    // allow some time for island to fetch; if none present, test passes
    const count = await page.locator('[data-testid="annotation-item"]').count();
    expect(count).toBe(0);
  });

  test('per-user isolation: user A annotations not visible to user B', async ({ page, context }) => {
    // Save as user A (id=500)
    await ensureLoggedInAs(page, context, base, 500, 'userA');
    await page.goto(`${base}/manual`, { waitUntil: 'load' });
    const _docId = await selectFirstDocument(page);

    await page.waitForSelector('[data-testid="visual-annotation-island-root"]', { timeout: 10000 });
    await page.locator('[data-testid="draw-toggle"]').click();
    await drawBoxOnCanvas(page, page.locator('[data-testid="annotation-canvas"]').first(), [0.2, 0.2], [0.35, 0.35]);
    await page.locator('[data-testid="annotation-label-0"]').fill('UserA Only');

    const post = page.waitForResponse(resp => resp.url().endsWith('/api/annotations') && resp.request().method() === 'POST');
    await page.click('[data-testid="save-annotations"]');
    const postResp = await post;
    const created = (await postResp.json()).created[0];
    expect(created).toBeTruthy();

    // Now switch to user B (id=600)
    await ensureLoggedInAs(page, context, base, 600, 'userB');
    await page.reload({ waitUntil: 'load' });
    await selectFirstDocument(page);

    // Wait briefly and assert no annotations present for this user
    // If an annotation appears, it's a failure
    await page.waitForTimeout(500); // let UI fetch
    const countUserB = await page.locator('[data-testid="annotation-item"]').count();
    expect(countUserB).toBe(0);
  });
});
