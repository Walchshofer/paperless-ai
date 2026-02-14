import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
const { waitForIsland } = require('../helpers/island-waits');
const fixtures = require('../helpers/fixtures');

const BASE =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.PAPERLESS_BASE_URL ||
  'http://localhost:3000';

async function openChatWorkspace(page: import('@playwright/test').Page) {
  const docId = fixtures.getTestDocId();
  await page.goto(`${BASE}/workspace/doc/${docId}?tab=chat`, {
    waitUntil: 'networkidle'
  });

  await waitForIsland(page, 'context-sidebar-island', 15000);
  await page.click('[data-testid="tab-chat"]', { force: true });
  await expect(page.locator('[data-testid="tab-panel-chat"]')).toBeVisible();
  await expect(page.locator('[data-testid="chat-workspace-root"]')).toBeVisible();
  await expect(page.locator('[data-testid="chat-document-title"]')).toBeVisible();

  return docId;
}

test.describe('Chat Route Live E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __DISABLE_GITHUB_FETCH__?: boolean })
        .__DISABLE_GITHUB_FETCH__ = true;
    });
  });

  test(
    'initializes chat, sends a message, and receives assistant reply (live)',
    async ({ page }) => {
      const docId = await openChatWorkspace(page);

      const modelsResponse = await page.evaluate(async () => {
        try {
          const resp = await fetch('/api/ollama/models');
          const text = await resp.text();
          try {
            return { status: resp.status, data: JSON.parse(text) };
          } catch (_err) {
            return { status: resp.status, text };
          }
        } catch (err) {
          return { error: String(err) };
        }
      });
      console.log('[LIVE] /api/ollama/models ->', modelsResponse);

      await expect(page.locator('[data-testid="chat-model-select"]')).toBeVisible();
      const modelSelection = await page.evaluate(() => {
        const select = document.querySelector(
          '[data-testid="chat-model-select"]'
        ) as HTMLSelectElement | null;
        if (!select) {
          return {
            selected: '',
            firstSelectable: null,
            optionCount: 0
          };
        }

        const options = Array.from(select.options)
          .map((opt) => ({ value: opt.value, label: opt.textContent || '' }));
        const firstSelectable = options.find((opt) => Boolean(opt.value));

        return {
          selected: select.value,
          firstSelectable: firstSelectable ? firstSelectable.value : null,
          optionCount: options.length
        };
      });

      console.log('[LIVE] model selection state:', modelSelection);
      expect(modelSelection.optionCount).toBeGreaterThan(0);
      expect(modelSelection.firstSelectable).not.toBeNull();

      if (!modelSelection.selected && modelSelection.firstSelectable) {
        await page.selectOption(
          '[data-testid="chat-model-select"]',
          modelSelection.firstSelectable
        );
      }

      const message = `Playwright live test for doc ${docId}: hello`;
      await page.fill('[data-testid="chat-input"]', message);
      await expect(page.locator('[data-testid="chat-send-button"]')).toBeEnabled();
      await page.click('[data-testid="chat-send-button"]');

      await page.waitForSelector('[data-testid="chat-message-user"]', {
        timeout: 10000
      });
      await expect(
        page.locator('[data-testid="chat-message-user"]').last()
      ).toContainText(message);

      await page.waitForFunction(() => {
        const assistantMessages = document.querySelectorAll(
          '[data-testid="chat-message-assistant"]'
        );
        if (assistantMessages.length > 0) {
          const last = assistantMessages[
            assistantMessages.length - 1
          ] as HTMLElement;
          if (last.textContent && last.textContent.trim().length > 0) {
            return true;
          }
        }

        const err = document.querySelector(
          '[data-testid="chat-error"]'
        ) as HTMLElement | null;
        if (err && err.textContent && err.textContent.trim().length > 0) {
          return true;
        }

        return false;
      }, { timeout: 120000 });

      const streamError = await page.evaluate(() => {
        const err = document.querySelector(
          '[data-testid="chat-error"]'
        ) as HTMLElement | null;
        return err ? err.textContent?.trim() || null : null;
      });
      if (streamError) {
        console.error('[LIVE] Stream error:', streamError);
      }
      expect(streamError).toBeFalsy();

      const outDir = path.join(process.cwd(), 'test-output');
      fs.mkdirSync(outDir, { recursive: true });

      const screenshotPath = path.join(outDir, 'chat-live.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('[ARTIFACT] Screenshot saved:', screenshotPath);

      const messages = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-testid^="chat-message-"]'))
          .map((el) => ({
            testid: el.getAttribute('data-testid'),
            text: el.textContent?.trim() || ''
          }));
      });

      const jsonPath = path.join(outDir, 'chat-live.json');
      fs.writeFileSync(
        jsonPath,
        JSON.stringify({ url: page.url(), documentId: docId, messages }, null, 2)
      );
      console.log('[ARTIFACT] JSON saved:', jsonPath);

      const assistantText = messages
        .filter((m) => m.testid === 'chat-message-assistant')
        .pop()?.text || '';
      expect(assistantText.length).toBeGreaterThan(0);
    }
  );
});
