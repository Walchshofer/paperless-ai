import { test, expect, Page } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', USERNAME);
  await page.fill('#password', PASSWORD);
  await page.click('[data-testid="login-submit-btn"]');
  await page.waitForURL(url => !url.pathname.includes('/login'));
}

test.describe('P4.4 Workspace Accessibility Audit', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('keyboard navigation and ARIA roles in workspace', async ({ page }) => {
    const docId = getTestDocId();
    await page.goto(`${BASE}/workspace/doc/${docId}`, { waitUntil: 'domcontentloaded' });
    
    // 1. Verify Landmark Roles
    await expect(page.locator('[role="tablist"]')).toBeVisible();
    
    // 2. Tab Navigation between Sidebar Tabs
    console.log('Testing sidebar tab keyboard navigation...');
    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    await metadataTab.click(); // Ensure focus starts somewhere
    await metadataTab.focus();
    
    await page.keyboard.press('ArrowRight');
    const contentTab = page.locator('[data-testid="tab-content"]');
    await expect(contentTab).toHaveAttribute('aria-selected', 'true');
    
    await page.keyboard.press('ArrowRight');
    const chatTab = page.locator('[data-testid="tab-chat"]');
    await expect(chatTab).toHaveAttribute('aria-selected', 'true');

    // 3. Document Viewer Shortcuts
    console.log('Testing viewer keyboard shortcuts...');
    const zoomPct = page.locator('[data-testid="overlay-zoom-percentage"]');
    const initialZoom = await zoomPct.textContent();
    
    await page.keyboard.press('+');
    await page.waitForTimeout(300);
    const zoomedIn = await zoomPct.textContent();
    expect(Number(zoomedIn?.replace('%', ''))).toBeGreaterThan(Number(initialZoom?.replace('%', '')));
    
    await page.keyboard.press('-');
    await page.keyboard.press('-');
    await page.waitForTimeout(300);
    const zoomedOut = await zoomPct.textContent();
    expect(Number(zoomedOut?.replace('%', ''))).toBeLessThan(Number(zoomedIn?.replace('%', '')));

    // 4. Mode Toggles
    console.log('Testing mode toggle shortcuts...');
    const drawBtn = page.locator('[data-testid="draw-mode-btn"]');
    await page.keyboard.press('d');
    await expect(drawBtn).toHaveAttribute('aria-pressed', 'true');
    
    await page.keyboard.press('Escape');
    await expect(drawBtn).toHaveAttribute('aria-pressed', 'false');
    
    const panBtn = page.locator('[data-testid="pan-mode-btn"]');
    await page.keyboard.press('Space');
    await expect(panBtn).toHaveAttribute('aria-pressed', 'true');
    
    // 5. Focus Visibility Check
    console.log('Verifying focus ring visibility...');
    await page.keyboard.press('Tab'); // Navigate through elements
    await page.screenshot({ path: 'test-results/accessibility-focus-check.png' });
    
    // 6. Aria Labels for Icon Buttons
    const rotateBtn = page.locator('[data-testid="overlay-rotate-cw"]');
    await expect(rotateBtn).toHaveAttribute('aria-label', /rotate/i);
    
    const fitWBtn = page.locator('[data-testid="overlay-fit-width"]');
    await expect(fitWBtn).toHaveAttribute('aria-label', /fit/i);

    // 7. Viewer Container Accessibility
    console.log('Verifying viewer container accessibility...');
    const container = page.locator('[data-testid="overlay-container"]');
    await expect(container).toHaveAttribute('tabindex', '0');
    await expect(container).toHaveAttribute('role', 'region');
    await expect(container).toHaveAttribute('aria-label', /viewer/i);
  });

  test('contrast and visual clarity (screenshots)', async ({ page }) => {
    const docId = getTestDocId();
    await page.goto(`${BASE}/workspace/doc/${docId}`, { waitUntil: 'domcontentloaded' });
    
    // Metadata Panel
    await page.locator('[data-testid="tab-metadata"]').click();
    await page.screenshot({ path: 'test-results/accessibility-contrast-metadata.png' });
    
    // Chat Panel
    await page.locator('[data-testid="tab-chat"]').click();
    await page.screenshot({ path: 'test-results/accessibility-contrast-chat.png' });
    
    // Visual Tab (Labels)
    await page.locator('[data-testid="tab-visual"]').click();
    await page.screenshot({ path: 'test-results/accessibility-contrast-visual.png' });
  });
});
