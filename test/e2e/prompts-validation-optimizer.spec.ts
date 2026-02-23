import { test, expect } from '@playwright/test';
const { loadFixtureData } = require('../helpers/fixtures');

const TARGET_PROMPT_ID = 'VIS_OCR_V1';
const TARGET_DOMAIN = 'system';

test.describe('Prompt Template Optimization - SYS_ORCHESTRATOR_V1', () => {
  let fixture: { docId: number; historyDocId: number; title: string; correspondentId: number | null; tagIds: number[]; created: string | null; source: string; paperlessApiUrl: string };

  test.beforeAll(async () => {
    fixture = loadFixtureData();
  });

  test(`Full Optimization Flow for ${TARGET_PROMPT_ID}`, async ({ page }) => {
    test.setTimeout(1800000); // 30 minutes for high-res vision tests
    await page.goto('/settings#prompts', { waitUntil: 'networkidle' });
    
    // 1. Enable Developer Mode
    const devToggle = page.locator('[data-testid="developer-toggle"]');
    await expect(devToggle).toBeVisible({ timeout: 15000 });
    if (await devToggle.getAttribute('aria-checked') === 'false') {
      await devToggle.click();
    }

    const promptsIsland = page.locator('[data-island="prompts-settings-island"]');
    await expect(promptsIsland).toHaveAttribute('data-mounted', 'true', { timeout: 60000 });

    // Ensure Prompts category is active before selecting prompt rows.
    const promptsCategory = page.locator('[data-testid="category-prompts"]');
    await expect(promptsCategory).toBeVisible({ timeout: 15000 });
    await promptsCategory.click();
    await expect(
      page.locator('[data-testid="settings-section-prompts"]')
    ).toBeVisible({ timeout: 15000 });

    // 2. Expand Domain
    const domainHeader = page.locator(`[data-testid="domain-header-${TARGET_DOMAIN}"]`);
    if (await domainHeader.getAttribute('aria-expanded') === 'false') {
      await domainHeader.click();
      await page.waitForTimeout(1000);
    }

    // 3. Open Prompt Row
    const normalizedBaseId = TARGET_PROMPT_ID.replace(/_V\d+$/i, '').toLowerCase().replace(/_/g, '-');
    const promptRow = page.locator(`[data-testid="prompt-row-${normalizedBaseId}"]`);
    await promptRow.scrollIntoViewIfNeeded();
    await expect(promptRow).toBeVisible({ timeout: 10000 });
    await promptRow.click();
    
    // 4. Open Test Lab
    const testLabBtn = page.locator('button:has-text("Test Lab")');
    await expect(testLabBtn).toBeVisible({ timeout: 10000 });
    await testLabBtn.click();

    // 5. Wait for Modal
    const modal = page.locator('[data-testid="prompt-test-modal"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // 6. Load Documents
    const loadDocsBtn = modal.locator('[data-testid="test-lab-load-docs-btn"]');
    if (await loadDocsBtn.isVisible()) {
      await loadDocsBtn.click();
    }
    
    // Identify available test documents
    const docLocators = modal.locator('[data-testid^="test-subject-doc-"]');
    await expect(docLocators.first()).toBeVisible({ timeout: 30000 });
    const docCount = await docLocators.count();
    
    // Filter documents by type using more specific keywords for better targeting
    const domainKeywords: Record<string, string[]> = {
      'medical': ['labor', 'arzt', 'befund', 'doctor', 'medical', 'patient'],
      'financial': ['invoice', 'rechnung', 'receipt', 'quittung', 'bill', 'chf', 'eur', 'usd'],
      'legal': ['contract', 'vertrag', 'legal', 'law', 'agreement', 'clause'],
      'system': ['document', 'page']
    };
    
    const targetKeywords = domainKeywords[TARGET_DOMAIN.toLowerCase()] || [TARGET_DOMAIN.toLowerCase()];
    const candidateIndices: number[] = [];
    
    for (let i = 0; i < docCount; i++) {
      const text = (await docLocators.nth(i).innerText()).toLowerCase();
      if (targetKeywords.some((k: string) => text.includes(k))) {
        candidateIndices.push(i);
      }
    }
    
    // If we didn't find enough matches, add the first few
    let i = 0;
    while (candidateIndices.length < 3 && i < docCount) {
      if (!candidateIndices.includes(i)) candidateIndices.push(i);
      i++;
    }

    const testLimitCount = Math.min(candidateIndices.length, 3);
    console.log(`- Found ${docCount} documents, testing indices [${candidateIndices.slice(0, testLimitCount).join(', ')}]...`);
    let successfulExtractions = 0;

    for (let testIdx = 0; testIdx < testLimitCount; testIdx++) {
      const docIndex = candidateIndices[testIdx];
      const doc = docLocators.nth(docIndex);
      const docName = await doc.innerText();
      console.log(`\n>>> TESTING DOCUMENT ${testIdx + 1}/${testLimitCount}: ${docName.trim()} (Index: ${docIndex})`);
      
      await doc.click();
      await page.waitForTimeout(2000); // UI breathing room

      // 7. Wait for variables to populate
      console.log(`  - Waiting for runtime variables to populate...`);
      // Use first() to avoid strict mode violations if multiple loaders appear
      await expect(page.locator('text=Preparing Context...').first()).not.toBeVisible({ timeout: 600000 });
      
      const runBtn = modal.locator('[data-testid="prompt-test-run"]');

      // 8. Step 1: VALIDATE TEMPLATE (only once for the first doc)
      if (testIdx === 0) {
        console.log(`  - Step 1: Executing 'VALIDATE TEMPLATE'...`);
        await page.locator('[data-testid="test-mode-validate"]').click();
        await runBtn.click();

        const outputDiv = modal.locator('[data-testid="prompt-test-streaming-output"]');
        await expect(outputDiv).toContainText('syntax_valid', { timeout: 60000 });
        const validationDiagnostic = await outputDiv.innerText();
        
        console.log(`\n  [VALIDATION DIAGNOSTIC JSON for ${TARGET_PROMPT_ID}]:\n`);
        const jsonMatch = validationDiagnostic.match(/\{[\s\S]*\}/);
        console.log(jsonMatch ? jsonMatch[0] : validationDiagnostic);
      }

      // 9. Step 2: EXECUTE NEURAL SIMULATION
      console.log(`  - Step 2: Executing 'NEURAL SIMULATION'...`);
      await page.locator('[data-testid="test-mode-execute"]').click();
      await page.waitForTimeout(500);
      await runBtn.click();

      console.log(`  - Simulation triggered, awaiting completion...`);

      // Synchronize on the execute run lifecycle to avoid reusing stale
      // validation state from the previous step.
      await expect(runBtn).toBeDisabled({ timeout: 15000 });
      await expect(runBtn).toBeEnabled({ timeout: 900000 });

      const successBadge = modal.locator('text=Execution Successful');
      const failedBadge = modal.locator('text=Execution Failed');

      await Promise.race([
        successBadge.waitFor({ state: 'visible', timeout: 60000 }),
        failedBadge.waitFor({ state: 'visible', timeout: 60000 }),
      ]).catch(() => null);

      const executionSucceeded = await successBadge.isVisible().catch(() => false);
      if (!executionSucceeded) {
        const diagnostic = await modal
          .locator('[data-testid="prompt-test-results"]')
          .innerText()
          .catch(() => 'No diagnostics available.');
        console.log(`\n  [NEURAL SIMULATION FAILURE for ${docName.trim()}]:\n`);
        console.log(diagnostic.substring(0, 1000));
        console.log(`\n  --------------------------------------------------------------------------------`);
        continue;
      }

      const outputDiv = modal.locator('[data-testid="prompt-test-streaming-output"]');
      await expect(outputDiv).not.toBeEmpty({ timeout: 60000 });
      const simulationOutput = await outputDiv.innerText();
      if (!simulationOutput || !simulationOutput.trim()) {
        console.log(`\n  [NEURAL SIMULATION EMPTY for ${docName.trim()}]`);
        console.log(`\n  --------------------------------------------------------------------------------`);
        continue;
      }
      successfulExtractions += 1;
      
      console.log(`\n  [NEURAL SIMULATION OUTPUT for ${docName.trim()}]:\n`);
      console.log(simulationOutput.substring(0, 1000) + (simulationOutput.length > 1000 ? '...' : ''));
      console.log(`\n  --------------------------------------------------------------------------------`);
    }

    expect(successfulExtractions).toBeGreaterThan(0);
  });
});
