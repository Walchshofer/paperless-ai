import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test('Legacy manual route returns 410', async ({ request }) => {
  const res = await request.get(`${BASE}/manual`);
  expect(res.status()).toBe(410);
});
