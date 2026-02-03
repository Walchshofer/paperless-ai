import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';
const PAPERLESS_API_URL = process.env.PAPERLESS_API_URL;
const PAPERLESS_BASE = PAPERLESS_API_URL
  ? PAPERLESS_API_URL.replace(/\/api\/?$/, '')
  : null;

const HAS_PAPERLESS = Boolean(PAPERLESS_BASE);

test.describe('Paperless /documents redirect middleware', () => {
  test('redirects /documents/* to Paperless when configured', async ({ request }) => {
    test.skip(!HAS_PAPERLESS, 'PAPERLESS_API_URL not set in test environment');

    const response = await request.get(`${BASE}/documents/74/`, {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toBe(`${PAPERLESS_BASE}/documents/74/`);
  });

  test('preserves path segments and query params', async ({ request }) => {
    test.skip(!HAS_PAPERLESS, 'PAPERLESS_API_URL not set in test environment');

    const response = await request.get(
      `${BASE}/documents/74/download/original/?page=2`,
      { maxRedirects: 0 }
    );

    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toBe(
      `${PAPERLESS_BASE}/documents/74/download/original/?page=2`
    );
  });

  test('returns 503 with setup instructions when not configured', async ({ request }) => {
    test.skip(HAS_PAPERLESS, 'PAPERLESS_API_URL is set in test environment');

    const response = await request.get(`${BASE}/documents/74/`);

    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body.error).toBe('Paperless not configured');
    expect(body.setupUrl).toBe('/setup');
    expect(body.requestedPath).toBe('/documents/74/');
  });
});
