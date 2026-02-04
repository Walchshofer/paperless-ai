import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('Legacy Route Retirement', () => {
  test('legacy routes return 410', async ({ request }) => {
    const manual = await request.get(`${BASE}/manual`);
    const chat = await request.get(`${BASE}/chat`);
    const rag = await request.get(`${BASE}/rag`);

    expect(manual.status()).toBe(410);
    expect(chat.status()).toBe(410);
    expect(rag.status()).toBe(410);
  });

});
