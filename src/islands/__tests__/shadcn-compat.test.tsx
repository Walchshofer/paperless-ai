import { render, fireEvent, screen } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';

// Mock Radix primitives for unit tests (shallow)
vi.mock('@radix-ui/react-dialog', () => {
  const { h } = require('preact');
  return {
    Root: (props) => h('div', props),
    Trigger: (props) => h('div', props),
    Portal: (props) => h('div', props),
    Overlay: (props) => h('div', props),
    Content: (props) => h('div', props),
    Title: (props) => h('div', props),
    Description: (props) => h('div', props),
  };
});
vi.mock('@radix-ui/react-switch', () => {
  const { h } = require('preact');
  return {
    Root: (props) => h('div', props),
    Thumb: (props) => h('div', props),
  };
});
vi.mock('@radix-ui/react-tabs', () => {
  const { h } = require('preact');
  return {
    Root: (props) => h('div', props),
    List: (props) => h('div', props),
    Trigger: (props) => h('button', props),
    Content: (props) => h('div', props),
  };
});

import ShadcnCompat from '../shadcn-compat';

describe('shadcn/ui compatibility smoke', () => {
  it('is a Preact component (function)', () => {
    expect(typeof ShadcnCompat).toBe('function');
  });
});
