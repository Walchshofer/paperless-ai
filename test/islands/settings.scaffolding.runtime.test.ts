import { JSDOM } from 'jsdom';
import { test, expect } from 'vitest';

const { mountIslands } = require('../../src/islands/runtime');

test('island runtime - Settings scaffolding (P1.3) mounts overview, sidebar and restart banner placeholders', () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`);
  const { window } = dom;
  const { document } = window;
  // Expose to runtime which expects global.document/window in some paths
  // (the test harness will clean up after process exit)
  (global as unknown as Record<string, unknown>).document = document;
  (global as unknown as Record<string, unknown>).window = window;

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

    expect(oRoot).toBeTruthy();
    expect(sRoot).toBeTruthy();
    expect(bRoot).toBeTruthy();
  } finally {
    const g = global as unknown as Record<string, unknown>;
    delete g.document;
    delete g.window;
  }
});