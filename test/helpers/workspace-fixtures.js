const { getTestDocId, getHistoryDocId } = require('./fixtures');

const DEFAULT_TIMEOUT_MS = 20000;

async function navigateToWorkspace(page, docId) {
  const id = docId != null ? docId : getTestDocId();
  const target = id ? `/workspace/doc/${id}` : '/workspace/latest';
  await page.goto(target, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-page="document-workspace"]', {
    timeout: DEFAULT_TIMEOUT_MS
  });
  return id;
}

async function navigateToHistoryDoc(page, docId) {
  const id = docId != null ? docId : getHistoryDocId();
  await page.goto(`/history/doc/${id}`, { waitUntil: 'networkidle' });
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
  const map = {
    metadata: '[data-testid="tab-metadata"]',
    content: '[data-testid="tab-content"]',
    chat: '[data-testid="tab-chat"]',
    visual: '[data-testid="tab-visual"]',
    debug: '[data-testid="tab-debug"]'
  };
  const selector = map[tabName];
  if (!selector) throw new Error(`Unknown tab: ${tabName}`);
  await page.locator(selector).click();
}

module.exports = {
  navigateToWorkspace,
  navigateToHistoryDoc,
  waitForIslandMount,
  clickToolbarButton,
  switchTab
};
