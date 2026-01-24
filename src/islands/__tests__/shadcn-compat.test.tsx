import { render, fireEvent, screen } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import { mockRadixDialog, mockRadixSwitch, mockRadixTabs } from '@test/mocks/radix';

// Mock Radix primitives for unit tests (using centralized mocks)
vi.mock('@radix-ui/react-dialog', mockRadixDialog);
vi.mock('@radix-ui/react-switch', mockRadixSwitch);
vi.mock('@radix-ui/react-tabs', mockRadixTabs);

import ShadcnCompat from '../shadcn-compat';

describe('shadcn/ui compatibility smoke', () => {
  it('is a Preact component (function)', () => {
    expect(typeof ShadcnCompat).toBe('function');
  });
});
