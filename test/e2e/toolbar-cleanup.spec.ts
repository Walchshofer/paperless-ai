import { test, expect } from '@playwright/test';

/**
 * E2E tests for toolbar cleanup - ticket 379a6a87
 *
 * Tests:
 * - Single draw mode control (no duplicates)
 * - Pan/Draw mode toggle group functionality
 * - Keyboard shortcuts (D for draw, Escape to cancel)
 * - Visual feedback for draw mode active state
 * - State synchronization across components
 */
test.describe('Toolbar cleanup and mode controls', () => {
  test.beforeEach(async ({ page }) => {
    try {
      // Navigate to workspace with a test document (ID 74)
      await page.goto('/workspace/doc/74', { waitUntil: 'domcontentloaded' });
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'message' in e
          ? (e as { message?: string }).message
          : String(e);
      test.skip(true, 'Backend not reachable for E2E run: ' + msg);
      return;
    }

    // Wait for the overlay viewer island to hydrate
    await page.waitForSelector('[data-testid="overlay-viewer-root"]', {
      timeout: 30000,
    });
    await page.waitForTimeout(500);
  });

  test('should have single draw mode button with correct data-testid', async ({
    page,
  }) => {
    // Verify there's only one draw mode button
    const drawButtons = page.locator('[data-testid="draw-mode-btn"]');
    await expect(drawButtons).toHaveCount(1);

    // Verify the button has proper attributes
    const drawBtn = drawButtons.first();
    await expect(drawBtn).toHaveAttribute('aria-label', 'Draw Mode');
    await expect(drawBtn).toHaveAttribute('title', /Draw Mode/);
  });

  test('should have single pan mode button with correct data-testid', async ({
    page,
  }) => {
    // Verify there's only one pan mode button
    const panButtons = page.locator('[data-testid="pan-mode-btn"]');
    await expect(panButtons).toHaveCount(1);

    // Verify the button has proper attributes
    const panBtn = panButtons.first();
    await expect(panBtn).toHaveAttribute('aria-label', 'Pan Mode');
    await expect(panBtn).toHaveAttribute('title', /Pan Mode/);
  });

  test('should toggle draw mode with D key', async ({ page }) => {
    const container = page.locator('[data-testid="overlay-container"]');
    const drawBtn = page.locator('[data-testid="draw-mode-btn"]');

    // Initially not in draw mode
    await expect(container).toHaveAttribute('data-draw-mode', 'inactive');

    // Press D to activate draw mode
    await page.keyboard.press('d');
    await page.waitForTimeout(100);

    // Verify draw mode is active
    await expect(container).toHaveAttribute('data-draw-mode', 'active');
    await expect(drawBtn).toHaveAttribute('aria-pressed', 'true');

    // Press D again to deactivate
    await page.keyboard.press('d');
    await page.waitForTimeout(100);

    // Verify draw mode is inactive
    await expect(container).toHaveAttribute('data-draw-mode', 'inactive');
    await expect(drawBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('should cancel draw mode with Escape key', async ({ page }) => {
    const container = page.locator('[data-testid="overlay-container"]');
    const drawBtn = page.locator('[data-testid="draw-mode-btn"]');

    // Activate draw mode
    await page.keyboard.press('d');
    await page.waitForTimeout(100);
    await expect(container).toHaveAttribute('data-draw-mode', 'active');

    // Press Escape to cancel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Verify draw mode is cancelled
    await expect(container).toHaveAttribute('data-draw-mode', 'inactive');
    await expect(drawBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('should show visual feedback when draw mode is active', async ({
    page,
  }) => {
    const container = page.locator('[data-testid="overlay-container"]');

    // Activate draw mode
    await page.keyboard.press('d');
    await page.waitForTimeout(100);

    // Check for visual feedback via data-draw-mode attribute.
    // Note: Cannot use class-based /ring-2/ check because Tailwind's
    // focus:ring-2 utility is always present in the class string.
    await expect(container).toHaveAttribute('data-draw-mode', 'active', { timeout: 5000 });

    // Deactivate and verify draw mode is removed
    await page.keyboard.press('Escape');
    await expect(container).toHaveAttribute('data-draw-mode', 'inactive', { timeout: 5000 });
  });

  test('should toggle between pan and draw modes correctly', async ({
    page,
  }) => {
    const container = page.locator('[data-testid="overlay-container"]');
    const drawBtn = page.locator('[data-testid="draw-mode-btn"]');
    const panBtn = page.locator('[data-testid="pan-mode-btn"]');

    // Initially neither should be pressed
    await expect(drawBtn).toHaveAttribute('aria-pressed', 'false');

    // Click draw mode button
    await drawBtn.click();
    await page.waitForTimeout(100);

    // Draw should be active, pan should be inactive
    await expect(drawBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(panBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(container).toHaveAttribute('data-draw-mode', 'active');

    // Click pan mode button
    await panBtn.click();
    await page.waitForTimeout(100);

    // Pan should be active, draw should be inactive
    await expect(panBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(drawBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(container).toHaveAttribute('data-draw-mode', 'inactive');
  });

  test('should dispatch overlay:draw-mode-changed event', async ({ page }) => {
    // Set up event listener
    const eventPromise = page.evaluate(() => {
      return new Promise<{ drawMode: boolean }>((resolve) => {
        window.addEventListener(
          'overlay:draw-mode-changed',
          (e: Event) => {
            const detail = (e as CustomEvent).detail;
            resolve(detail);
          },
          { once: true }
        );
      });
    });

    // Toggle draw mode
    await page.keyboard.press('d');

    // Verify event was dispatched with correct detail
    const eventDetail = await eventPromise;
    expect(eventDetail.drawMode).toBe(true);
  });

  test('should have correct cursor styles for each mode', async ({ page }) => {
    const container = page.locator('[data-testid="overlay-container"]');

    // Default mode - default cursor
    let classes = await container.getAttribute('class');
    expect(classes).toContain('cursor-default');

    // Draw mode - crosshair cursor
    await page.keyboard.press('d');
    await page.waitForTimeout(100);
    classes = await container.getAttribute('class');
    expect(classes).toContain('cursor-crosshair');

    // Exit draw mode and enable pan mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    const panBtn = page.locator('[data-testid="pan-mode-btn"]');
    await panBtn.click();
    await page.waitForTimeout(100);

    // Pan mode - grab cursor
    classes = await container.getAttribute('class');
    expect(classes).toContain('cursor-grab');
  });

  test('should have toolbar with correct data-testid', async ({ page }) => {
    const toolbar = page.locator('[data-testid="overlay-toolbar"]');
    await expect(toolbar).toBeVisible();

    // Verify toolbar contains expected controls
    await expect(toolbar.locator('[data-testid="pan-mode-btn"]')).toBeVisible();
    await expect(
      toolbar.locator('[data-testid="draw-mode-btn"]')
    ).toBeVisible();
    await expect(
      toolbar.locator('[data-testid="overlay-zoom-in"]')
    ).toBeVisible();
    await expect(
      toolbar.locator('[data-testid="overlay-zoom-out"]')
    ).toBeVisible();
  });
});
