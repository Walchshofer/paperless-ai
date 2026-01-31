/**
 * Manual Route Live Enumeration Test
 *
 * Tests against the REAL running Docker stack with REAL Paperless-ngx data.
 * No mocks - captures actual UI state showing legacy vs island elements.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Manual Route Live Enumeration', () => {
  test('Enumerate all interactive elements, islands, and legacy components with real data', async ({ page }) => {
    // Navigate to manual route - uses real data from running stack
    await page.goto('/manual');

    // Wait for page to load and documents dropdown to populate
    await page.waitForSelector('#documentSelect', { timeout: 15000 });

    // Wait for documents to be fetched from real Paperless-ngx
    await page.waitForFunction(
      () => {
        const select = document.getElementById('documentSelect') as HTMLSelectElement;
        return select && select.options.length > 1;
      },
      { timeout: 20000 }
    );

    // Get list of real documents available
    const docOptions = await page.evaluate(() => {
      const select = document.getElementById('documentSelect') as HTMLSelectElement;
      return Array.from(select.options).slice(1).map(opt => ({
        id: opt.value,
        title: opt.textContent
      }));
    });

    console.log('[LIVE] Real documents found:', docOptions.length);
    console.log('[LIVE] First 5 documents:', docOptions.slice(0, 5));

    // Select first real document if available
    if (docOptions.length > 0) {
      const firstDoc = docOptions[0];
      console.log('[LIVE] Selecting document:', firstDoc.id, '-', firstDoc.title);
      await page.selectOption('#documentSelect', firstDoc.id);

      // Wait for document preview to load
      await page.waitForFunction(
        () => {
          const preview = document.getElementById('contentPreview');
          return preview && preview.textContent && preview.textContent.trim().length > 0;
        },
        { timeout: 15000 }
      );
    }

    // Wait for island runtime to mount
    await page.waitForFunction(
      () => (window as unknown as { __islandRuntimeMounted?: boolean }).__islandRuntimeMounted === true,
      { timeout: 10000 }
    ).catch(() => console.log('[LIVE] Island runtime not yet mounted'));

    // === ENUMERATE ALL ELEMENTS ===
    const enumeration = await page.evaluate(() => {
      const results = {
        islands: [] as unknown[],
        legacyElements: [] as unknown[],
        buttons: [] as unknown[],
        inputs: [] as unknown[],
        selects: [] as unknown[],
        stats: {
          totalElements: 0,
          islandCount: 0,
          buttonCount: 0,
          inputCount: 0
        }
      };

      // Find all island anchors
      document.querySelectorAll('[data-island]').forEach(el => {
        const rect = el.getBoundingClientRect();
        results.islands.push({
          name: el.getAttribute('data-island'),
          testid: el.getAttribute('data-testid'),
          hydrated: el.querySelector('[data-hydrated="true"]') !== null,
          visible: rect.width > 0 && rect.height > 0,
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
        });
        results.stats.islandCount++;
      });

      // Find all buttons
      document.querySelectorAll('button').forEach(el => {
        const rect = el.getBoundingClientRect();
        const testid = el.getAttribute('data-testid');
        const id = el.id;
        const text = el.textContent?.trim().slice(0, 50) || '';
        const isIsland = el.closest('[data-island]') !== null;

        results.buttons.push({
          id: id || null,
          testid: testid || null,
          text,
          disabled: el.disabled,
          visible: rect.width > 0 && rect.height > 0 && !el.closest('.hidden'),
          isIsland,
          type: isIsland ? 'ISLAND' : 'LEGACY',
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
        });
        results.stats.buttonCount++;
      });

      // Find all inputs
      document.querySelectorAll('input, textarea').forEach(el => {
        const input = el as HTMLInputElement | HTMLTextAreaElement;
        const rect = el.getBoundingClientRect();
        const testid = el.getAttribute('data-testid');
        const isIsland = el.closest('[data-island]') !== null;

        results.inputs.push({
          id: input.id || null,
          testid: testid || null,
          type: input.type || 'textarea',
          value: input.value?.slice(0, 100) || '',
          placeholder: input.placeholder || null,
          visible: rect.width > 0 && rect.height > 0,
          isIsland,
          category: isIsland ? 'ISLAND' : 'LEGACY',
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
        });
        results.stats.inputCount++;
      });

      // Find selects
      document.querySelectorAll('select').forEach(el => {
        const select = el as HTMLSelectElement;
        const rect = el.getBoundingClientRect();
        const isIsland = el.closest('[data-island]') !== null;

        results.selects.push({
          id: select.id || null,
          optionCount: select.options.length,
          selectedValue: select.value,
          visible: rect.width > 0 && rect.height > 0,
          isIsland,
          category: isIsland ? 'ISLAND' : 'LEGACY'
        });
      });

      // Find legacy-specific elements (not inside islands)
      const legacyIds = [
        'documentSelect',
        'contentPreview',
        'overlayContainer',
        'textPreviewSection',
        'visualPreviewSection'
      ];

      legacyIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.closest('[data-island]')) {
          const rect = el.getBoundingClientRect();
          results.legacyElements.push({
            id,
            tag: el.tagName.toLowerCase(),
            visible: rect.width > 0 && rect.height > 0 && !el.classList.contains('hidden'),
            rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
          });
        }
      });

      results.stats.totalElements = document.querySelectorAll('*').length;
      return results;
    });

    // === OUTPUT RESULTS ===
    console.log('\n=== MANUAL ROUTE ENUMERATION RESULTS ===\n');

    console.log('--- ISLANDS ---');
    enumeration.islands.forEach((island, i) => {
      console.log(`  ${i + 1}. ${island.name} [testid=${island.testid}] hydrated=${island.hydrated} visible=${island.visible}`);
    });

    console.log('\n--- BUTTONS BY TYPE ---');
    const legacyButtons = enumeration.buttons.filter(b => b.type === 'LEGACY' && b.visible);
    const islandButtons = enumeration.buttons.filter(b => b.type === 'ISLAND' && b.visible);

    console.log('  LEGACY BUTTONS:');
    legacyButtons.forEach((btn, i) => {
      console.log(`    ${i + 1}. id=${btn.id || 'none'} testid=${btn.testid || 'none'} text="${btn.text}" disabled=${btn.disabled}`);
    });

    console.log('  ISLAND BUTTONS:');
    islandButtons.forEach((btn, i) => {
      console.log(`    ${i + 1}. id=${btn.id || 'none'} testid=${btn.testid || 'none'} text="${btn.text}" disabled=${btn.disabled}`);
    });

    console.log('\n--- INPUTS BY TYPE ---');
    const legacyInputs = enumeration.inputs.filter(i => i.category === 'LEGACY' && i.visible);
    const islandInputs = enumeration.inputs.filter(i => i.category === 'ISLAND' && i.visible);

    console.log('  LEGACY INPUTS:', legacyInputs.length);
    console.log('  ISLAND INPUTS:', islandInputs.length);

    console.log('\n--- SELECTS ---');
    enumeration.selects.forEach((sel, i) => {
      console.log(`  ${i + 1}. id=${sel.id} options=${sel.optionCount} type=${sel.category}`);
    });

    console.log('\n--- LEGACY ELEMENTS ---');
    enumeration.legacyElements.forEach((el, i) => {
      console.log(`  ${i + 1}. #${el.id} <${el.tag}> visible=${el.visible}`);
    });

    console.log('\n--- STATS ---');
    console.log(`  Total DOM elements: ${enumeration.stats.totalElements}`);
    console.log(`  Islands: ${enumeration.stats.islandCount}`);
    console.log(`  Buttons: ${enumeration.stats.buttonCount} (${legacyButtons.length} legacy, ${islandButtons.length} island)`);
    console.log(`  Inputs: ${enumeration.stats.inputCount} (${legacyInputs.length} legacy, ${islandInputs.length} island)`);

    // === SAVE ARTIFACTS ===
    const outDir = path.join(process.cwd(), 'test-output');
    fs.mkdirSync(outDir, { recursive: true });

    // Take full page screenshot
    const screenshotPath = path.join(outDir, 'manual-live-enumeration.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n[ARTIFACT] Screenshot saved: ${screenshotPath}`);

    // Save enumeration JSON
    const jsonPath = path.join(outDir, 'manual-live-enumeration.json');
    const report = {
      url: page.url(),
      timestamp: new Date().toISOString(),
      documentsAvailable: docOptions.length,
      selectedDocument: docOptions[0] || null,
      ...enumeration
    };
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`[ARTIFACT] JSON saved: ${jsonPath}`);

    // === SWITCH TO VISUAL VIEW AND RE-ENUMERATE ===
    const viewVisualBtn = page.locator('[data-testid="view-visual-btn"]');
    const isDisabled = await viewVisualBtn.isDisabled().catch(() => true);

    if (!isDisabled) {
      console.log('\n--- SWITCHING TO VISUAL VIEW ---');
      await viewVisualBtn.click();

      // Wait for visual section to become visible
      await page.waitForSelector('#visualPreviewSection:not(.hidden)', { timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(1000); // Allow rendering

      // Re-enumerate visual view elements
      const visualEnum = await page.evaluate(() => {
        const results = {
          overlayContainerVisible: false,
          overlayViewerIsland: null as unknown | null,
          pageIndicator: null as string | null
        };

        const overlayContainer = document.getElementById('overlayContainer') ||
          document.querySelector('[data-testid="overlay-container"]');
        if (overlayContainer) {
          results.overlayContainerVisible = !overlayContainer.classList.contains('hidden') &&
            overlayContainer.getBoundingClientRect().width > 0;
        }

        const overlayIsland = document.querySelector('[data-island="overlay-viewer-island"]');
        if (overlayIsland) {
          results.overlayViewerIsland = {
            present: true,
            hydrated: overlayIsland.querySelector('[data-hydrated="true"]') !== null,
            hasImage: overlayIsland.querySelector('img') !== null
          };
        }

        const pageIndicator = document.querySelector('[data-testid="overlay-page-indicator"]');
        if (pageIndicator) {
          results.pageIndicator = pageIndicator.textContent;
        }

        return results;
      });

      console.log('  Overlay container visible:', visualEnum.overlayContainerVisible);
      console.log('  Overlay viewer island:', visualEnum.overlayViewerIsland);
      console.log('  Page indicator:', visualEnum.pageIndicator);

      // Take visual view screenshot
      const visualScreenshotPath = path.join(outDir, 'manual-live-visual-view.png');
      await page.screenshot({ path: visualScreenshotPath, fullPage: true });
      console.log(`[ARTIFACT] Visual view screenshot saved: ${visualScreenshotPath}`);
    } else {
      console.log('\n[INFO] Visual view button disabled - no document selected or visual not available');
    }

    // === ASSERTIONS ===
    // Verify islands are present
    expect(enumeration.islands.length).toBeGreaterThan(0);
    expect(enumeration.islands.some(i => i.name === 'manual-editor-island')).toBeTruthy();

    // Verify we have both legacy and island elements
    expect(enumeration.legacyElements.length).toBeGreaterThan(0);
    expect(legacyButtons.length).toBeGreaterThan(0);

    console.log('\n=== TEST COMPLETE ===\n');
  });
});
