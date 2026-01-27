import { describe, it, expect, vi } from 'vitest';

// Mock Radix primitives for unit tests (using centralized mocks)
vi.mock('@radix-ui/react-dialog', async () => {
  const { mockRadixDialog } = await import('@test/mocks/radix');
  return mockRadixDialog();
});
vi.mock('@radix-ui/react-switch', async () => {
  const { mockRadixSwitch } = await import('@test/mocks/radix');
  return mockRadixSwitch();
});
vi.mock('@radix-ui/react-tabs', async () => {
  const { mockRadixTabs } = await import('@test/mocks/radix');
  return mockRadixTabs();
});

import ShadcnCompat from '../shadcn-compat';

describe('shadcn/ui compatibility smoke', () => {
  it('is a Preact component (function)', () => {
    expect(typeof ShadcnCompat).toBe('function');
  });
});
