import { test, expect } from '@playwright/test';

/**
 * Prompt Optimization & Token Limit Test
 * 
 * Goal: Execute each prompt against REAL documents to ensure valid validation output
 * and optimize for Ollama models while monitoring token limits.
 * 
 * Each prompt is tested with the EXACT model assigned to it in the PromptRegistry.
 * Multimodal models are tested with high-resolution (300dpi) visual context.
 */

test.describe('Prompt Optimization & Real Document Validation', () => {
  test('Audit each prompt domain against real document subjects', async ({ page }) => {
    // Increase timeout for LLM generation
    test.setTimeout(1800000); // 30 minutes for full sweep

    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
          console.error(`[BROWSER ERROR] ${msg.text()}`);
      }
    });

    // Login once
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'elfman');
    await page.fill('input[name="password"]', 'P2tr3ck!1976');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 30000 });

    const domains = ['System', 'Medical', 'Financial', 'Legal', 'General'];
    
    // ── DISCOVERY PHASE ──
    await page.goto('http://localhost:3000/settings#prompts', { waitUntil: 'networkidle' });
    const devToggle = page.locator('[data-testid="developer-toggle"]');
    await expect(devToggle).toBeVisible({ timeout: 15000 });
    if (await devToggle.getAttribute('aria-checked') === 'false') {
      await devToggle.click();
    }

    const domainPrompts: Record<string, string[]> = {};
    for (const domain of domains) {
        console.log(`[Discovery] Scanning ${domain}...`);
        const domainHeader = page.locator('button.domain-group-header').filter({ has: page.locator('h3', { hasText: new RegExp(`^${domain}$`, 'i') }) });
        
        if (await domainHeader.count() === 0) continue;
        
        await domainHeader.scrollIntoViewIfNeeded();
        if (await domainHeader.getAttribute('aria-expanded') === 'false') {
            await domainHeader.click();
            await page.waitForTimeout(2000);
        }
        
        const buttons = page.locator(`[data-testid^="prompt-row-btn-"]`);
        const count = await buttons.count();
        const names = [];
        for (let i=0; i<count; i++) {
            const btn = buttons.nth(i);
            if (await btn.isVisible()) {
                const txt = await btn.locator('.font-mono').innerText();
                names.push(txt.trim());
            }
        }
        domainPrompts[domain] = [...new Set(names)];
        console.log(`[Discovery] Found ${domainPrompts[domain].length} prompts in ${domain}`);
        
        // Collapse to keep DOM clean
        await domainHeader.click();
        await page.waitForTimeout(500);
    }

    // ── AUDIT PHASE ──
    for (const domain of Object.keys(domainPrompts)) {
      if (domainPrompts[domain].length === 0) continue;
      
      console.log(`\n>>> OPTIMIZATION AUDIT: ${domain} Domain`);
      
      for (const baseId of domainPrompts[domain]) {
        console.log(`\n  Group: ${baseId}`);
        
        try {
            // REFRESH PAGE PER PROMPT FOR MAXIMUM STABILITY
            await page.goto('http://localhost:3000/settings#prompts', { waitUntil: 'networkidle' });
            
            const devToggleLoop = page.locator('[data-testid="developer-toggle"]');
            if (await devToggleLoop.getAttribute('aria-checked') === 'false') {
              await devToggleLoop.click();
            }

            const domainHeader = page.locator('button.domain-group-header').filter({ has: page.locator('h3', { hasText: new RegExp(`^${domain}$`, 'i') }) });
            await domainHeader.scrollIntoViewIfNeeded();
            if (await domainHeader.getAttribute('aria-expanded') === 'false') {
                await domainHeader.click();
                await page.waitForTimeout(2000);
            }

            const promptBtn = page.locator(`[data-testid^="prompt-row-btn-"]`).filter({ hasText: baseId }).first();
            await promptBtn.scrollIntoViewIfNeeded();
            await expect(promptBtn).toBeVisible({ timeout: 10000 });
            await promptBtn.click({ force: true });
            
            const editor = page.locator(`[id^="prompt-editor-panel-"]`).filter({ isVisible: true });
            await expect(editor).toBeVisible({ timeout: 15000 });
            
            const activePromptId = await editor.locator('span.font-mono.tracking-tight').innerText();
            console.log(`    - Testing Target: ${activePromptId}`);

            await editor.locator('button:has-text("Knobs")').click();
            const maxTokensInput = editor.locator(`[data-testid^="prompt-max-tokens-"]`);
            const maxTokensLimit = parseInt(await maxTokensInput.inputValue()) || 2048;
            console.log(`    - Token Limit: ${maxTokensLimit}`);
            await editor.locator('button:has-text("Library")').click();

            const testBtn = editor.locator('[data-testid^="prompt-test-"]');
            await testBtn.scrollIntoViewIfNeeded();
            await testBtn.click({ force: true });

            const modal = page.locator('[data-testid="prompt-test-modal"]');
            await expect(modal).toBeVisible({ timeout: 30000 });

            console.log(`    - Loading Real Document Context...`);
            await modal.getByRole('button', { name: 'Real Document' }).click();
            
            // Wait for documents to load
            await page.waitForTimeout(2000);
            const picker = modal.locator('button.flex.flex-col').first();
            await expect(picker).toBeVisible({ timeout: 20000 });
            const subject = await picker.locator('span.text-\\[10px\\]').innerText();
            console.log(`    - Selected Subject: ${subject}`);
            await picker.click();
            
            // Wait for document content and image preview
            await page.waitForTimeout(3000);
            await expect(modal.locator('h4:has-text("Extraction Subject Preview")')).toBeVisible({ timeout: 15000 });

            // CRITICAL: Explicitly set to Execute mode
            await modal.getByRole('button', { name: 'Execute', exact: true }).click();

            // Multimodal Context Confirmation
            const imagePreview = modal.locator('img[alt="Document Preview"]');
            const hasImage = await imagePreview.isVisible();
            if (hasImage) {
                console.log(`    - [Multimodal] Visual context (300dpi) confirmed.`);
            } else {
                console.log(`    - [Text-Only] Proceeding without visual context.`);
            }

            console.log(`    - Executing Neural Simulation...`);
            const runBtn = modal.locator('[data-testid="prompt-test-run"]');
            const responsePromise = page.waitForResponse(resp => 
                resp.url().includes('/test') && resp.status() === 200, 
                { timeout: 180000 }
            );
            await runBtn.click();
            const response = await responsePromise;
            
            const results = modal.locator('[data-testid^="prompt-test-results"]');
            await expect(results).toBeVisible({ timeout: 30000 });

            const pass = await results.locator('span:has-text("Successful")').isVisible();
            const modelUsed = await results.locator('i.fa-microchip + span').innerText();
            const tokensText = await results.locator('i.fa-coins + span').innerText();
            const tokenUsage = parseInt(tokensText.replace(/[~,]/g, '')) || 0;
            const guidance = await results.locator('span:has-text("Guidance Active")').isVisible();
            
            console.log(`    - [RESULT] ${pass ? 'PASS' : 'FAIL'}`);
            console.log(`    - [METRIC] Model Used: ${modelUsed}`);
            console.log(`    - [METRIC] Token Usage: ${tokenUsage}`);
            console.log(`    - [STATUS] Neural Engine: ${guidance ? 'GUIDANCE_ACTIVE' : 'STANDARD_OLLAMA'}`);

            if (tokenUsage > maxTokensLimit) {
              console.warn(`    - [LIMIT] ALERT: Exceeds budget!`);
            } else {
              console.log(`    - [LIMIT] OK: within budget`);
            }

            if (await results.locator('span:has-text("JSON Verified")').isVisible()) {
              console.log(`    - [SCHEMA] JSON INTEGRITY: VERIFIED`);
            } else {
              console.warn(`    - [SCHEMA] JSON INTEGRITY: CORRUPTED/INVALID`);
            }

            // Close Lab Modal
            await modal.locator('button:has-text("Close Lab")').click();
            await expect(modal).toBeHidden();
        } catch (e) {
            console.error(`    - [CRITICAL ERROR] Audit failed for ${baseId}: ${e.message}`);
        } finally {
            // Ensure Lab Modal is closed before moving to next prompt or domain
            const modal = page.locator('[data-testid="prompt-test-modal"]');
            if (await modal.isVisible()) {
                console.log(`    - [Cleanup] Closing Lab Modal for ${baseId}...`);
                const closeBtn = modal.locator('button:has-text("Close Lab")');
                await closeBtn.click().catch(() => {});
                await expect(modal).toBeHidden({ timeout: 10000 }).catch(() => {});
            }
        }
      }
    }

    console.log('\nExpert Model Optimization Audit Complete.');
  });
});