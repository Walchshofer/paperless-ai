import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';
const PAPERLESS_API_URL = process.env.PAPERLESS_API_URL;
const PAPERLESS_BASE = PAPERLESS_API_URL
  ? PAPERLESS_API_URL.replace(/\/api\/?$/, '')
  : null;
const STORAGE_STATE = process.env.PLAYWRIGHT_STORAGE_STATE || 'test/.auth/storageState.json';

test.describe('Paperless /documents redirect middleware', () => {
  test('redirects /documents/* to Paperless when configured', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: BASE,
      storageState: STORAGE_STATE
    });
    const response = await api.get('/documents/74/', { maxRedirects: 0 });

    if (response.status() !== 302) {
      test.skip(true, 'Paperless redirect not configured on server');
    }

    const location = response.headers()['location'];
    expect(location).toBeTruthy();
    expect(location).toContain('/documents/74/');
    if (PAPERLESS_BASE) {
      expect(location).toBe(`${PAPERLESS_BASE}/documents/74/`);
    }
    await api.dispose();
  });

  test('preserves path segments and query params', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: BASE,
      storageState: STORAGE_STATE
    });
    const response = await api.get(
      '/documents/74/download/original/?page=2',
      { maxRedirects: 0 }
    );

    if (response.status() !== 302) {
      test.skip(true, 'Paperless redirect not configured on server');
    }

    const location = response.headers()['location'];
    expect(location).toContain('/documents/74/download/original/?page=2');
    if (PAPERLESS_BASE) {
      expect(location).toBe(
        `${PAPERLESS_BASE}/documents/74/download/original/?page=2`
      );
    }
    await api.dispose();
  });

  test('returns 503 with setup instructions when not configured', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: BASE,
      storageState: STORAGE_STATE
    });
    const response = await api.get('/documents/74/', { maxRedirects: 0 });

    if (response.status() === 302) {
      test.skip(true, 'Paperless configured on server; 503 path not applicable');
    }

    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body.error).toBe('Paperless not configured');
    expect(body.setupUrl).toBe('/setup');
    expect(body.requestedPath).toBe('/documents/74/');
    await api.dispose();
  });
});
