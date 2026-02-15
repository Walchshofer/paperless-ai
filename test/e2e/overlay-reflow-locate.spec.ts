import { test, expect } from '@playwright/test';

const { waitForIslandMount } = require('../helpers/workspace-fixtures');

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const DOC_ID = process.env.TEST_DOC_ID ? Number(process.env.TEST_DOC_ID) : 40;

async function captureRelativeOverlayMetrics(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const image = document.querySelector(
      '[data-testid="overlay-document-image"]'
    ) as HTMLElement | null;
    const overlay = document.querySelector(
      '[data-testid="overlay-box"]'
    ) as HTMLElement | null;

    if (!image || !overlay) {
      return null;
    }

    const imageRect = image.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();

    return {
      relX: (overlayRect.x - imageRect.x) / imageRect.width,
      relY: (overlayRect.y - imageRect.y) / imageRect.height,
      relW: overlayRect.width / imageRect.width,
      relH: overlayRect.height / imageRect.height,
    };
  });
}

function maxRelDelta(
  first: { relX: number; relY: number; relW: number; relH: number },
  second: { relX: number; relY: number; relW: number; relH: number }
) {
  return Math.max(
    Math.abs(first.relX - second.relX),
    Math.abs(first.relY - second.relY),
    Math.abs(first.relW - second.relW),
    Math.abs(first.relH - second.relH)
  );
}

test.describe('Workspace overlay reflow and locate wiring', () => {
  test('overlay boxes stay aligned during zoom and viewport resize', async ({
    page,
  }) => {
    await page.goto(`${BASE}/workspace/doc/${DOC_ID}?tab=visual&page=1`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForIslandMount(page, 'overlay-viewer-island', 20000);
    await page.waitForSelector('[data-testid="overlay-document-image"]', {
      timeout: 20000,
    });
    await page.waitForTimeout(800);

    const overlayCount = await page.locator('[data-testid="overlay-box"]').count();
    test.skip(
      overlayCount === 0,
      `No overlays available on doc ${DOC_ID} page 1 for alignment check`
    );

    const base = await captureRelativeOverlayMetrics(page);
    expect(base).not.toBeNull();

    await page.click('[data-testid="overlay-zoom-in"]');
    await page.waitForTimeout(300);
    const zoomed = await captureRelativeOverlayMetrics(page);
    expect(zoomed).not.toBeNull();

    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
    const resized = await captureRelativeOverlayMetrics(page);
    expect(resized).not.toBeNull();

    await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="overlay-container"]'
      ) as HTMLElement | null;
      if (!container) {
        return;
      }
      container.scrollTop = Math.min(
        container.scrollHeight - container.clientHeight,
        container.scrollTop + 140
      );
      container.scrollLeft = Math.min(
        container.scrollWidth - container.clientWidth,
        container.scrollLeft + 80
      );
    });
    await page.waitForTimeout(300);
    const scrolled = await captureRelativeOverlayMetrics(page);
    expect(scrolled).not.toBeNull();

    const zoomDelta = maxRelDelta(
      base as { relX: number; relY: number; relW: number; relH: number },
      zoomed as { relX: number; relY: number; relW: number; relH: number }
    );
    const resizeDelta = maxRelDelta(
      base as { relX: number; relY: number; relW: number; relH: number },
      resized as { relX: number; relY: number; relW: number; relH: number }
    );
    const scrollDelta = maxRelDelta(
      base as { relX: number; relY: number; relW: number; relH: number },
      scrolled as { relX: number; relY: number; relW: number; relH: number }
    );

    expect(zoomDelta).toBeLessThanOrEqual(0.03);
    expect(resizeDelta).toBeLessThanOrEqual(0.03);
    expect(scrollDelta).toBeLessThanOrEqual(0.03);
  });

  test('smart tab keeps date prefilled and locate button dispatch is wired', async ({
    page,
  }) => {
    await page.goto(`${BASE}/workspace/doc/${DOC_ID}?tab=metadata`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForIslandMount(page, 'context-sidebar-island', 20000);
    await page.waitForSelector('[data-testid="smart-metadata-root"]', {
      timeout: 20000,
    });

    const dateValue = await page
      .locator('[data-testid="smart-date-input"]')
      .inputValue();
    expect(dateValue.trim().length).toBeGreaterThan(0);

    await page.evaluate(() => {
      (window as unknown as { __locateEvents: unknown[] }).__locateEvents = [];
      window.addEventListener('metadata:locate-field', (event) => {
        const payload = (event as CustomEvent).detail || null;
        (
          window as unknown as { __locateEvents: unknown[] }
        ).__locateEvents.push(payload);
      });
    });

    const locateButtons = page.locator(
      '[data-testid^="locate-required-"], [data-testid^="locate-optional-"], [data-testid^="locate-visual-"]'
    );
    const locateCount = await locateButtons.count();
    test.skip(locateCount === 0, 'No locate buttons available on metadata tab');

    await locateButtons.first().click();
    await page.waitForTimeout(300);

    const locateState = await page.evaluate(() => {
      return {
        events: (window as unknown as { __locateEvents?: unknown[] })
          .__locateEvents || [],
        lastResolved: (window as unknown as { __last_metadata_locate?: unknown })
          .__last_metadata_locate || null,
      };
    });

    expect(locateState.events.length).toBeGreaterThan(0);
    expect(locateState.lastResolved).toBeTruthy();
  });
});
