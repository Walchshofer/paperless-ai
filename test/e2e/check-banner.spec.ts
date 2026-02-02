import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test('Check deprecation banner on manual page', async ({ page }) => {
  // First clear any cookies
  await page.context().clearCookies();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"], input[type="text"]', USERNAME);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });

  // Now go to manual page
  await page.goto(`${BASE}/manual`, { waitUntil: 'networkidle' });

  // Log page content for debugging
  const html = await page.content();
  const hasBannerInHtml = html.includes('legacy-route-banner');
  console.log('Banner HTML present:', hasBannerInHtml);

  // Check for banner
  const banner = page.locator('[data-testid="legacy-route-banner"]');
  const bannerCount = await banner.count();
  console.log('Banner element count:', bannerCount);

  if (bannerCount > 0) {
    const isVisible = await banner.isVisible();
    console.log('Banner visible:', isVisible);
    const text = await banner.textContent();
    console.log('Banner text:', text);
  }

  // Check cookies
  const cookies = await page.context().cookies();
  const legacyCookie = cookies.find(c => c.name === 'legacy_banner_dismissed');
  console.log('Legacy cookie:', legacyCookie);

  // Check page source for showLegacyBanner
  const hasShowLegacy = html.includes('showLegacyBanner');
  console.log('showLegacyBanner in source:', hasShowLegacy);

  await page.screenshot({ path: 'test-results/manual-banner-check.png', fullPage: true });
});
