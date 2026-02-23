import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const { getTestDocId, loadFixtureData } = require('../helpers/fixtures');
const { navigateToWorkspace, switchTab } = require('../helpers/workspace-fixtures');

interface PageNode {
  tag: string;
  id: string | null;
  class: string | null;
  'data-island': string | null;
  'data-testid': string | null;
  text: string;
}

const writeArtifacts = async (page: import('@playwright/test').Page) => {
  const outDir = path.join(process.cwd(), 'test-output');
  fs.mkdirSync(outDir, { recursive: true });
  const screenshotPath = path.join(outDir, 'workspace-enum.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const enumeration = await page.evaluate(() => {
    const elements: PageNode[] = [];
    document.querySelectorAll('*').forEach(el => {
      const node = {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        class: el.className || null,
        'data-island': el.getAttribute && el.getAttribute('data-island') || null,
        'data-testid': el.getAttribute && el.getAttribute('data-testid') || null,
        text: (el.textContent || '').trim().slice(0, 200)
      };
      if (node['data-island'] || node['data-testid']) elements.push(node);
    });
    return elements;
  });

  const jsonPath = path.join(outDir, 'workspace-enum.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ url: page.url(), timestamp: new Date().toISOString(), enumeration }, null, 2));
};

test.describe('Workspace page enumeration', () => {
  test('enumerate elements and verify Smart Metadata fields populated', async ({ page }) => {
    const docId = getTestDocId();
    const fixture = loadFixtureData();

    await navigateToWorkspace(page, docId);

    await expect(page.locator('[data-testid="overlay-viewer-root"]')).toBeVisible();
    await expect(page.locator('[data-testid="context-sidebar-root"]')).toBeVisible();

    const titleInput = page.locator('[data-testid="smart-title-input"]');
    await expect(titleInput).toBeVisible();

    const titleVal = await titleInput.inputValue();
    if (fixture && fixture.title) {
      expect(titleVal).toContain(fixture.title.slice(0, 16));
    }

    await switchTab(page, 'visual');
    await expect(page.locator('[data-testid="visual-tab-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="overlay-page-indicator"]')).toBeVisible();

    await writeArtifacts(page);
  });
});
