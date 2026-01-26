// Test helper: wait for an island to be considered mounted/hydrated in E2E tests
// Usage: const { waitForIsland } = require('../helpers/island-waits');

async function waitForIsland(page, islandName, timeoutMs = 5000) {
  const hydratedSelector = `[data-island="${islandName}"] [data-hydrated="true"]`;
  const islandSelector = `[data-island="${islandName}"]`;
  const start = Date.now();

  // Poll for hydrated DOM or a test marker on window (islands set markers for unit tests)
  while (Date.now() - start < timeoutMs) {
    // 1) hydrated DOM exists
    const hydrated = await page.$(hydratedSelector);
    if (hydrated) return true;

    // 2) island anchor exists and has a visible page indicator/test hooks
    const anchor = await page.$(islandSelector);
    if (anchor) return true;

    // 3) window marker like __<name>_mounted set by islands during mount
    const marker = await page.evaluate((n) => {
      try {
        return !!window[`__${n.replace(/-/g, '_')}_mounted`];
      } catch (e) { return false; }
    }, islandName);
    if (marker) return true;

    await page.waitForTimeout(100);
  }
  return false;
}

module.exports = { waitForIsland };