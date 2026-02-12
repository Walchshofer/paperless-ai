import { test, expect } from '@playwright/test';

/**
 * Prompt Lab Full Audit
 * 
 * Verifies that both multimodal and text expert prompts:
 * 1. Correcty process document context.
 * 2. Return valid JSON output via Guidance/Ollama.
 * 3. Benefit from the 300dpi visual context and robust extraction.
 */

const ALL_PROMPTS = [
  // Multimodal
  { id: 'SYS_ROUTER_V1', baseId: 'sys-router', domain: 'system', expectedType: 'json' },
  { id: 'VIS_OCR_V1', baseId: 'vis-ocr', domain: 'system', expectedType: 'text' },
  { id: 'VIS_SIGNAL_ANALYZER_V1', baseId: 'vis-signal-analyzer', domain: 'system', expectedType: 'json' },
  { id: 'MED_RADIOLOGY_V1', baseId: 'med-radiology', domain: 'medical', expectedType: 'json' },
  // Text
  { id: 'MED_DOCTOR_V1', baseId: 'med-doctor', domain: 'medical', expectedType: 'json' },
  { id: 'FIN_EXTRACT_V1', baseId: 'fin-extract', domain: 'financial', expectedType: 'json' },
  { id: 'LEGAL_EXTRACTOR_V1', baseId: 'legal-extractor', domain: 'legal', expectedType: 'json' },
  { id: 'FIN_VAT_EXPERT_V1', baseId: 'fin-vat-expert', domain: 'financial', expectedType: 'json' }
];

test.describe('Prompt Lab Full Audit', () => {
  
  test.beforeEach(async ({ page }) => {
    test.setTimeout(900000); // 15 minutes for full sweep
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'elfman');
    await page.fill('input[name="password"]', 'P2tr3ck!1976');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  for (const prompt of ALL_PROMPTS) {
    test(`Audit ${prompt.id} - ${prompt.domain} domain`, async ({ page }) => {
      console.log(`\n>>> AUDITING PROMPT: ${prompt.id}`);
      
      // Go to Prompts settings
      await page.goto('http://localhost:3000/settings#prompts', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="prompts-settings-root"]', { timeout: 30000 });

      // Expand domain group
      const domainHeader = page.locator(`[data-testid="domain-header-${prompt.domain.toLowerCase()}"]`);
      await domainHeader.scrollIntoViewIfNeeded();
      if (await domainHeader.getAttribute('aria-expanded') === 'false') {
          await domainHeader.click();
          await page.waitForTimeout(1000);
      }

      // Open prompt row
      const rowBtn = page.locator(`[data-testid="prompt-row-btn-${prompt.baseId}"]`);
      await expect(rowBtn).toBeVisible({ timeout: 10000 });
      await rowBtn.click();

      // Verify editor panel
      const editorId = `prompt-editor-${prompt.id.toLowerCase().replace(/_/g, '-')}`;
      const editor = page.locator(`[data-testid="${editorId}"]`);
      await expect(editor).toBeVisible({ timeout: 10000 });

      // Open Test Lab
      const testBtnId = `prompt-test-${prompt.id.toLowerCase().replace(/_/g, '-')}`;
      await editor.locator(`[data-testid="${testBtnId}"]`).click();

      // Wait for modal
      const modal = page.locator('[data-testid="prompt-test-modal"]');
      await expect(modal).toBeVisible({ timeout: 10000 });

      // Select Real Document
      console.log('  - Loading real document context...');
      await modal.getByRole('button', { name: 'Real Document' }).click();
      
      // Select first document
      const picker = modal.locator('button.flex.flex-col').first();
      await expect(picker).toBeVisible({ timeout: 30000 });
      await picker.click();

      // IF multimodal, wait for image. IF text, wait for variables.
      if (prompt.id.includes('VIS') || prompt.id.includes('ROUTER') || prompt.id.includes('RADIOLOGY')) {
          console.log('  - Verifying 300dpi visual pipeline context...');
          const imagePreview = modal.locator('img[alt="Document Preview (300 DPI)"]');
          await expect(imagePreview).toBeVisible({ timeout: 45000 });
      } else {
          await page.waitForTimeout(2000); // Give time for text extraction to populate
      }

      // Switch to Execute mode
      console.log('  - Switching to Neural Execution mode...');
      const execBtn = modal.getByRole('button', { name: 'Execute', exact: true });
      await execBtn.click();
      await page.waitForTimeout(500);

      // Run simulation
      console.log('  - Triggering synthesis...');
      const runBtn = modal.locator('[data-testid="prompt-test-run"]');
      
      const responsePromise = page.waitForResponse(resp => 
          resp.url().includes('/test') && resp.status() === 200, 
          { timeout: 300000 }
      );
      
      await runBtn.click();
      const response = await responsePromise;
      console.log('  - Response received.');
      
      // Verify Results
      const results = modal.locator('[data-testid="prompt-test-results"]');
      await expect(results).toBeVisible({ timeout: 30000 });

      const pass = await results.locator('span:has-text("Execution Successful")').isVisible();
      if (!pass) {
          const errorMsg = await results.locator('.text-rose-600').innerText();
          console.error(`  - [FAIL] ${prompt.id} failed execution: ${errorMsg}`);
          throw new Error(`${prompt.id} execution failed`);
      }
      
      if (prompt.expectedType === 'json') {
          const jsonVerified = await results.locator('span:has-text("JSON Verified")').isVisible();
          if (!jsonVerified) {
              const outputContainer = results.locator('div.text-rose-900, div.dark\\:text-rose-50, div.text-slate-900');
              const rawOutput = await outputContainer.innerText();
              console.error(`  - [FAIL] JSON schema integrity failed for ${prompt.id}. Raw:`, rawOutput);
          }
          expect(jsonVerified).toBeTruthy();
          console.log('  - [PASS] JSON schema integrity verified.');
      } else {
          console.log('  - [PASS] Text extraction successful.');
      }

      // Check Metadata
      const modelLabel = await results.locator('i.fa-microchip + span').innerText();
      console.log(`  - [METRIC] Neural Model: ${modelLabel}`);
      
      console.log(`>>> SUCCESS: ${prompt.id} Audit Complete.`);
      
      // Cleanup
      await modal.locator('button:has-text("Close Lab")').click();
      await expect(modal).toBeHidden();
    });
  }
});
