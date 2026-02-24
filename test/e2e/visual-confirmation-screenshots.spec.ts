/* eslint-env mocha */
/**
 * Visual confirmation screenshots for Workspace Intelligence Enhancements v2.
 * Run once manually — captures key UI states for human review.
 * NOT part of the regular CI suite.
 */
import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const fixtures = require('../helpers/fixtures');
const { navigateToWorkspace, waitForIslandMount } = require('../helpers/workspace-fixtures');

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'test', 'artifacts', 'visual-confirmation');

test.describe('Visual confirmation screenshots', () => {
  test.beforeAll(() => {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  });

  test('01 — workspace default view', async ({ page }) => {
    test.setTimeout(30000);
    const docId = fixtures.getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
    await page.waitForTimeout(1500); // let islands settle
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '01-workspace-default.png'),
      fullPage: true
    });
  });

  test('02 — tag pill cloud sidebar', async ({ page }) => {
    test.setTimeout(30000);
    const docId = fixtures.getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
    await page.waitForTimeout(1000);
    // Try to scroll to the tags section
    const tagCloud = page.locator('[data-testid^="tag-available-"], .flex.flex-wrap').first();
    await tagCloud.scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '02-tag-pill-cloud.png'),
      fullPage: false
    });
  });

  test('03 — visual insights section', async ({ page }) => {
    test.setTimeout(30000);
    const docId = fixtures.getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
    await page.waitForTimeout(1000);
    // Try to find visual insights area
    const visInsights = page.locator('[data-testid="visual-insights-section"], [data-section="visual-insights"], [data-testid="generate-high-res-cta"]').first();
    await visInsights.scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '03-visual-insights.png'),
      fullPage: false
    });
  });

  test('04 — overlay viewer toolbar', async ({ page }) => {
    test.setTimeout(30000);
    const docId = fixtures.getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'overlay-viewer-island', 15000);
    await page.waitForTimeout(1500);
    // Evaluate dark mode by checking body/html class
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    }).catch(() => {});
    const toolbar = page.locator('[data-testid="overlay-toolbar"], .overlay-toolbar, [class*="toolbar"]').first();
    await toolbar.scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '04-overlay-viewer-dark.png'),
      fullPage: false
    });
  });
});
