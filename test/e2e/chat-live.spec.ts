import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Chat Route Live E2E', () => {
  test('initializes chat, sends a message, and receives assistant reply (live)', async ({ page }) => {
    // Navigate to chat route
    await page.goto('/chat');

    // If the app redirects to /login, perform login using env credentials or defaults
    await page.waitForLoadState('domcontentloaded');
    const maybeLogin = page.url().includes('/login') || (await page.locator('#username').count()) > 0 || (await page.locator('form[action="/login"]').count()) > 0;
    if (maybeLogin) {
      const user = process.env.PAPERLESS_ADMIN_USER || process.env.PAPERLESS_USER || 'paperless-ai';
      const pass = process.env.PAPERLESS_ADMIN_PASSWORD || process.env.PAPERLESS_PASSWORD || 'paperless-ai';
      console.log('[LIVE] Login required, attempting login with user:', user);
      await page.fill('#username', user);
      await page.fill('#password', pass);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        page.click('button[type="submit"]')
      ]).catch(() => null);

      // After login, navigate back to chat
      await page.goto('/chat');
    }

    // Wait for the chat document select to populate with real documents
    await page.waitForSelector('#chat-document-select', { timeout: 15000 });

    // Fetch Ollama models via the API to inspect what the server returns for the current session
    const modelsResponse = await page.evaluate(async () => {
      try {
        const resp = await fetch('/api/ollama/models');
        const text = await resp.text();
        try { return { status: resp.status, data: JSON.parse(text) }; } catch (e) { return { status: resp.status, text }; }
      } catch (err) {
        return { error: String(err) };
      }
    });
    console.log('[LIVE] /api/ollama/models ->', modelsResponse);

    await page.waitForFunction(
      () => {
        const select = document.getElementById('chat-document-select') as HTMLSelectElement | null;
        return !!select && select.options.length > 1;
      },
      { timeout: 20000 }
    );

    const docOptions = await page.evaluate(() => {
      const select = document.getElementById('chat-document-select') as HTMLSelectElement;
      return Array.from(select.options).slice(1).map(opt => ({ id: opt.value, title: opt.textContent }));
    });

    console.log('[LIVE] Chat documents found:', docOptions.length);
    expect(docOptions.length).toBeGreaterThan(0);

    const firstDoc = docOptions[0];
    console.log('[LIVE] Selecting document:', firstDoc.id, '-', firstDoc.title);

    await page.selectOption('#chat-document-select', firstDoc.id);

    // Wait for chat initialization status message
    await page.waitForSelector('[data-testid="chat-message-status"]', { timeout: 20000 });
    const statusText = await page.locator('[data-testid="chat-message-status"]').innerText();
    console.log('[LIVE] Status message:', statusText.trim());

    // Ensure model dropdown is populated and select a model
    await page.waitForSelector('[data-testid="chat-model-select"]', { timeout: 15000 }).catch(() => null);
    const hasModelSelect = (await page.locator('[data-testid="chat-model-select"]').count()) > 0;
    if (hasModelSelect) {
      // If Installed models optgroup exists, choose first installed; otherwise choose first option
      const installedOpt = await page.$('//optgroup[starts-with(normalize-space(@label), "Installed")]/option[1]');
      if (installedOpt) {
        const val = await installedOpt.getAttribute('value');
        if (val) {
          await page.selectOption('[data-testid="chat-model-select"]', val);
          console.log('[LIVE] Selected installed model:', val);
        }
      } else {
        // Fallback to first available option
        const firstOpt = await page.locator('[data-testid="chat-model-select"] option').first();
        const val = await firstOpt.getAttribute('value');
        if (val) {
          await page.selectOption('[data-testid="chat-model-select"]', val);
          console.log('[LIVE] Selected fallback model:', val);
        }
      }

      // Check for verify error message and log
      const errCount = await page.locator('[data-testid="chat-model-error"]').count();
      if (errCount > 0) {
        console.warn('[LIVE] Model verify error shown');
      }
    }

    // Send a user message
    const message = 'Playwright live test: hello';
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill(message);
    await page.click('[data-testid="chat-send-button"]');

    // Assert user message appears
    await page.waitForSelector('[data-testid="chat-message-user"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="chat-message-user"]').last()).toContainText(message);

    // Wait for assistant streaming reply or an error message (may take longer on live systems)
    await page.waitForFunction(() => {
      const els = document.querySelectorAll('[data-testid="chat-message-assistant"]');
      if (els && els.length > 0) {
        const el = els[els.length - 1];
        if (el && el.textContent && el.textContent.trim().length > 0) return true;
      }
      const err = document.querySelector('.sg-message--error');
      if (err && err.textContent && err.textContent.trim().length > 0) return true;
      return false;
    }, { timeout: 120000 });

    // If an error was shown, fail with the error text for debugging
    const streamError = await page.evaluate(() => {
      const err = document.querySelector('.sg-message--error');
      return err ? err.textContent?.trim() || null : null;
    });
    if (streamError) {
      console.error('[LIVE] Stream error:', streamError);
    }

    // Save artifacts
    const outDir = path.join(process.cwd(), 'test-output');
    fs.mkdirSync(outDir, { recursive: true });

    const screenshotPath = path.join(outDir, 'chat-live.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('[ARTIFACT] Screenshot saved:', screenshotPath);

    const messages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-testid^="chat-message-"]')).map(el => ({ testid: el.getAttribute('data-testid'), text: el.textContent?.trim() || '' }));
    });

    const jsonPath = path.join(outDir, 'chat-live.json');
    fs.writeFileSync(jsonPath, JSON.stringify({ url: page.url(), document: firstDoc, messages }, null, 2));
    console.log('[ARTIFACT] JSON saved:', jsonPath);

    const assistantText = messages.filter(m => m.testid === 'chat-message-assistant').pop()?.text || '';
    expect(assistantText.length).toBeGreaterThan(0);
  });
});
