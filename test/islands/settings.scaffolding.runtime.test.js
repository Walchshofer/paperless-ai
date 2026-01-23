const { JSDOM } = require('jsdom');
const assert = require('assert');

const { mountIslands } = require('../../src/islands/runtime');

function runScaffoldingTest() {
  let dom;
  let window;
  let document;

  dom = new JSDOM(`<!doctype html><html><body></body></html>`);
  window = dom.window;
  document = window.document;
  global.document = document;
  global.window = window;

  try {
    const overview = document.createElement('div');
    overview.setAttribute('data-island', 'overview-dashboard-island');
    overview.setAttribute('data-testid', 'overview-dashboard-island');

    const sidebar = document.createElement('div');
    sidebar.setAttribute('data-island', 'settings-sidebar-island');
    sidebar.setAttribute('data-testid', 'settings-sidebar-island');

    const banner = document.createElement('div');
    banner.setAttribute('data-island', 'restart-banner-island');
    banner.setAttribute('data-testid', 'restart-banner-island');
    banner.setAttribute('data-props', JSON.stringify({ visible: true }));

    document.body.appendChild(overview);
    document.body.appendChild(sidebar);
    document.body.appendChild(banner);

    mountIslands(document);

    const oRoot = overview.querySelector('[data-testid="overview-dashboard-root"]');
    const sRoot = sidebar.querySelector('[data-testid="settings-sidebar-root"]');
    const bRoot = banner.querySelector('[data-testid="restart-banner-root"]');

    assert.ok(oRoot, 'Expected overview dashboard island root to be rendered');
    assert.ok(sRoot, 'Expected settings sidebar island root to be rendered');
    assert.ok(bRoot, 'Expected restart banner island root to be rendered');
  } finally {
    delete global.document;
    delete global.window;
  }
}

let maybeTest = null;
try {
  maybeTest = (typeof test === 'function') ? test : require('vitest').test;
} catch (e) { /* not running under vitest */ }

if (maybeTest) {
  maybeTest('mounts overview, sidebar and restart banner placeholders', runScaffoldingTest);
} else if (typeof describe === 'function') {
  describe('island runtime - Settings scaffolding (P1.3)', function () {
    it('mounts overview, sidebar and restart banner placeholders', runScaffoldingTest);
  });
} else {
  // Fallback for environments without test frameworks (allows direct node execution)
  runScaffoldingTest();
}
