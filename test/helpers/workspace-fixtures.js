const { getTestDocId, getHistoryDocId } = require('./fixtures');

const DEFAULT_TIMEOUT_MS = 20000;

async function navigateToWorkspace(page, docId) {
  const id = docId != null ? docId : getTestDocId();
  const target = id ? `/workspace/doc/${id}` : '/workspace/latest';
  // networkidle is fragile in this app (websockets/streaming); prefer deterministic DOM readiness.
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-page="document-workspace"]', {
    timeout: DEFAULT_TIMEOUT_MS
  });
  return id;
}

async function navigateToHistoryDoc(page, docId) {
  const id = docId != null ? docId : getHistoryDocId();
  await page.goto(`/history/doc/${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-page="history-document"]', {
    timeout: DEFAULT_TIMEOUT_MS
  });
  return id;
}

async function waitForIslandMount(page, islandName, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const selector = `[data-island="${islandName}"]`;
  await page.waitForSelector(selector, { timeout: timeoutMs });
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      if (el.getAttribute('data-hydrated') === 'true') return true;
      return el.querySelector('[data-testid]') != null || el.children.length > 0;
    },
    selector,
    { timeout: timeoutMs }
  );
}

async function clickToolbarButton(page, buttonName) {
  const map = {
    save: '[data-testid="save-all-btn"]',
    reprocess: '[data-testid="reprocess-btn"]',
    prev: '[data-testid="nav-prev-btn"]',
    next: '[data-testid="nav-next-btn"]',
    selector: '[data-testid="document-selector-trigger"]'
  };
  const selector = map[buttonName];
  if (!selector) throw new Error(`Unknown toolbar button: ${buttonName}`);
  await page.locator(selector).click();
}

async function switchTab(page, tabName) {
  const tabMap = {
    metadata: '[data-testid="tab-metadata"]',
    content: '[data-testid="tab-content"]',
    chat: '[data-testid="tab-chat"]',
    visual: '[data-testid="tab-visual"]',
    debug: '[data-testid="tab-debug"]'
  };
  const panelMap = {
    metadata: '[data-testid="tab-panel-metadata"]',
    content: '[data-testid="tab-panel-content"]',
    chat: '[data-testid="tab-panel-chat"]',
    visual: '[data-testid="tab-panel-visual"]',
    debug: '[data-testid="tab-panel-debug"]'
  };
  const tabSelector = tabMap[tabName];
  const panelSelector = panelMap[tabName];
  if (!tabSelector) throw new Error(`Unknown tab: ${tabName}`);

  // Click tab and verify the panel appeared; retry once if click was lost.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator(tabSelector).click();
    try {
      await page.waitForSelector(panelSelector, { timeout: 3000 });
      return; // Panel appeared — switch succeeded.
    } catch {
      // Panel didn't appear; retry click.
    }
  }
  // Final attempt — let it throw on failure.
  await page.waitForSelector(panelSelector, { timeout: 5000 });
}

async function waitForOverlayImage(page, timeoutMs = 15000) {
  await page.waitForFunction(
    () => {
      const img = document.querySelector(
        '[data-testid="overlay-document-image"]'
      );
      return img != null && img.naturalWidth > 0;
    },
    { timeout: timeoutMs }
  );
}

module.exports = {
  navigateToWorkspace,
  navigateToHistoryDoc,
  waitForIslandMount,
  clickToolbarButton,
  switchTab,
  waitForOverlayImage
};
