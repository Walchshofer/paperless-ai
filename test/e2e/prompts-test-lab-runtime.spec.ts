import { test, expect } from '@playwright/test';
const { loadFixtureData } = require('../helpers/fixtures');

test.describe('Prompt Test Lab Runtime Context', () => {
  let fixture;

  test.beforeAll(async () => {
    fixture = loadFixtureData();
  });

  test.beforeEach(async ({ page }) => {
    // Mock the documents API globally for this suite
    await page.route('**/api/documents/recent', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          documents: [
            { id: fixture.docId, title: 'E2E Test Document', created: '2023-01-01' }
          ]
        })
      });
    });

    // Navigate to Prompts category
    await page.goto('/settings#prompts', { waitUntil: 'domcontentloaded' });
    
    // Enable High-Privilege Mode (Developer Mode) via sidebar
    const devToggle = page.locator('[data-testid="developer-toggle"]');
    await expect(devToggle).toBeVisible({ timeout: 15000 });
    const isChecked = await devToggle.getAttribute('aria-checked');
    if (isChecked === 'false') {
      await devToggle.click();
    }

    // Wait for the Prompts Island to be mounted and ready
    const promptsIsland = page.locator('[data-island="prompts-settings-island"]');
    await expect(promptsIsland).toHaveAttribute('data-mounted', 'true', { timeout: 60000 });

    // Open any prompt editor (e.g., first one in System domain)
    const domainHeader = page.locator('[data-testid="domain-header-system"]');
    if (await domainHeader.getAttribute('aria-expanded') === 'false') {
      await domainHeader.click();
    }
    const firstRow = page.locator('[data-testid^="prompt-row-"]').first();
    await firstRow.click();

    // Open Test Lab
    const testLabBtn = page.locator('[data-testid^="prompt-test-"]').filter({ hasText: 'Test Lab' });
    await expect(testLabBtn).toBeVisible({ timeout: 15000 });
    await testLabBtn.click();

    // Verify Modal is visible
    const modal = page.locator('[data-testid="prompt-test-modal"]');
    await expect(modal).toBeVisible({ timeout: 15000 });
  });

  async function selectTestDocument(page, docId) {
    const modal = page.locator('[data-testid="prompt-test-modal"]');
    const docItem = modal.locator(`[data-testid="test-subject-doc-${docId}"]`);
    
    if (!(await docItem.isVisible())) {
      const loadDocsBtn = modal.locator('[data-testid="test-lab-load-docs-btn"]');
      if (await loadDocsBtn.count() > 0) {
        await loadDocsBtn.click({ force: true });
      }
    }

    await expect(docItem).toBeVisible({ timeout: 20000 });
    await docItem.click();
  }

  test('Scenario 1: Document Selection with Pipeline Execution', async ({ page }) => {
    await page.route('**/api/prompts-runtime/context', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay to catch spinner
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          variables: {
            ocr_text: 'Decoded text from E2E fixture',
            domain: 'legal',
            filename: 'legal-document.pdf'
          },
          pipelineMetadata: {
            pipelineId: 'legal_pipeline_v1',
            duration: 1500,
            confidence: 0.95,
            stages: []
          },
          documentMetadata: {
            id: fixture.docId,
            title: 'E2E Test Document',
            filename: 'legal-document.pdf'
          }
        })
      });
    });

    await selectTestDocument(page, fixture.docId);

    // Verify loading message
    const processingMsg = page.locator('text=Executing Pipeline...');
    await expect(processingMsg).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/screenshots/test-lab-runtime-executing.png' });

    const ocrInput = page.locator('[data-testid="test-var-ocr_text"]');
    await expect(ocrInput).toBeVisible({ timeout: 15000 });
    await expect(ocrInput).toHaveValue('Decoded text from E2E fixture');
    await expect(ocrInput).toBeDisabled();
    
    await page.screenshot({ path: 'test-results/screenshots/test-lab-runtime-populated.png' });
  });

  test('Scenario 2: Variable Lock/Unlock Interaction', async ({ page }) => {
    await page.route('**/api/prompts-runtime/context', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          variables: { ocr_text: 'Sample text' },
          pipelineMetadata: { stages: [] },
          documentMetadata: { id: fixture.docId, title: 'Test' }
        })
      });
    });

    await selectTestDocument(page, fixture.docId);

    const ocrInput = page.locator('[data-testid="test-var-ocr_text"]');
    await expect(ocrInput).toBeVisible({ timeout: 15000 });
    await expect(ocrInput).toBeDisabled();

    const lockBtn = page.locator(`[data-testid="test-var-lock-ocr_text"]`);
    await lockBtn.click();
    await expect(ocrInput).toBeEnabled();
    
    await page.screenshot({ path: 'test-results/screenshots/test-lab-variable-unlocked.png' });

    await ocrInput.fill('Manually overridden text');
    await lockBtn.click();
    await expect(ocrInput).toBeDisabled();
    await expect(ocrInput).toHaveValue('Manually overridden text');
  });

  test('Scenario 3: Per-User Execution Limit (429 handling)', async ({ page }) => {
    await page.route('**/api/prompts-runtime/context', async route => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'You have an active test execution. Please wait.'
        })
      });
    });

    await selectTestDocument(page, fixture.docId);
    await expect(page.locator('text=You have an active test execution. Please wait.')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/test-lab-limit-error.png' });
  });

  test('Scenario 4: Detailed Error Panel', async ({ page }) => {
    await page.route('**/api/prompts-runtime/context', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Pipeline execution failed',
          variables: { ocr_text: 'Partial text' },
          pipelineMetadata: {
            stages: [
              { name: 'ocr', status: 'success', duration: 500 },
              { name: 'classification', status: 'error', error: 'Model timeout', duration: 5000 }
            ]
          },
          documentMetadata: { id: fixture.docId, title: 'Error Doc' }
        })
      });
    });

    await selectTestDocument(page, fixture.docId);

    const errorPanel = page.locator('[data-testid="pipeline-error-toggle"]');
    await expect(errorPanel).toBeVisible();
    await expect(errorPanel).toContainText('1 of 2 stages failed');

    // Details should be auto-expanded on error
    const details = page.locator('[data-testid="pipeline-error-details"]');
    await expect(details).toBeVisible();
    
    await expect(page.locator('[data-testid="pipeline-stage-ocr"] .fa-circle-check')).toBeVisible();
    await expect(page.locator('[data-testid="pipeline-stage-classification"] .fa-circle-xmark')).toBeVisible();
    
    await page.screenshot({ path: 'test-results/screenshots/test-lab-error-panel-details.png' });
  });

  test('Scenario 5: Test Execution with Real Variables', async ({ page }) => {
    await page.route('**/api/prompts-runtime/context', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          variables: { ocr_text: 'Initial text', domain: 'medical' },
          pipelineMetadata: { stages: [] },
          documentMetadata: { id: fixture.docId, title: 'Test' }
        })
      });
    });

    await selectTestDocument(page, fixture.docId);

    const lockBtn = page.locator('[data-testid="test-var-lock-ocr_text"]');
    await expect(lockBtn).toBeVisible({ timeout: 15000 });
    await lockBtn.click();
    await page.locator('[data-testid="test-var-ocr_text"]').fill('Edited text');

    await page.route('**/api/prompts/*/test', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          promptId: 'TEST_PROMPT',
          model: 'test-model',
          source: 'guidance-service-execution',
          duration: 100,
          testResult: 'Simulation result using Edited text'
        })
      });
    });

    await page.locator('[data-testid="prompt-test-run"]').click();
    await expect(page.locator('[data-testid="prompt-test-results"]')).toContainText('Simulation result using Edited text');
    await page.screenshot({ path: 'test-results/screenshots/test-lab-results.png' });
  });

  test('Scenario 6: Manual Reprocessing Trigger', async ({ page }) => {
    await page.route('**/api/prompts-runtime/context', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          variables: { ocr_text: 'Initial execution' },
          pipelineMetadata: { stages: [] },
          documentMetadata: { id: fixture.docId, title: 'Test' }
        })
      });
    });

    await selectTestDocument(page, fixture.docId);
    await expect(page.locator('[data-testid="test-var-ocr_text"]')).toHaveValue('Initial execution', { timeout: 15000 });

    await page.route('**/api/prompts-runtime/context', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          variables: { ocr_text: 'Manual re-execution' },
          pipelineMetadata: { stages: [] },
          documentMetadata: { id: fixture.docId, title: 'Test' }
        })
      });
    });

    await page.locator('[data-testid="test-lab-process-btn"]').click();
    await expect(page.locator('[data-testid="test-var-ocr_text"]')).toHaveValue('Manual re-execution', { timeout: 15000 });
  });
});
