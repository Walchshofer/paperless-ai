/**
 * Shallow mocks for Radix UI primitives
 *
 * These mocks provide minimal implementations sufficient for unit testing
 * Preact components that use Radix UI without requiring full DOM/hook environment.
 *
 * Usage:
 *   import { vi } from 'vitest';
 *   import { mockRadixDialog, mockRadixSwitch, mockRadixTabs } from '@test/mocks/radix';
 *
 *   vi.mock('@radix-ui/react-dialog', mockRadixDialog);
 *   vi.mock('@radix-ui/react-switch', mockRadixSwitch);
 *   vi.mock('@radix-ui/react-tabs', mockRadixTabs);
 */

import { h } from 'preact';

/** Common props type for Radix mock components */
interface MockRadixProps extends Record<string, unknown> {
  children?: preact.ComponentChildren;
  checked?: boolean;
  'aria-selected'?: boolean;
  'aria-expanded'?: boolean;
}

/**
 * Mock implementation for @radix-ui/react-dialog
 */
export const mockRadixDialog = () => ({
  Root: (props: MockRadixProps) => h('div', { ...props, 'data-radix-dialog-root': '' }),
  Trigger: (props: MockRadixProps) => h('button', { ...props, 'data-radix-dialog-trigger': '', type: 'button' }),
  Portal: (props: MockRadixProps) => h('div', { ...props, 'data-radix-dialog-portal': '' }),
  Overlay: (props: MockRadixProps) => h('div', { ...props, 'data-radix-dialog-overlay': '' }),
  Content: (props: MockRadixProps) => h('div', { ...props, 'data-radix-dialog-content': '' }),
  Title: (props: MockRadixProps) => h('h2', { ...props, 'data-radix-dialog-title': '' }),
  Description: (props: MockRadixProps) => h('p', { ...props, 'data-radix-dialog-description': '' }),
  Close: (props: MockRadixProps) => h('button', { ...props, 'data-radix-dialog-close': '', type: 'button' }),
});

/**
 * Mock implementation for @radix-ui/react-switch
 */
export const mockRadixSwitch = () => ({
  Root: (props: MockRadixProps) => h('button', {
    ...props,
    'data-radix-switch-root': '',
    type: 'button',
    role: 'switch',
    'aria-checked': props.checked || false
  }),
  Thumb: (props: MockRadixProps) => h('span', { ...props, 'data-radix-switch-thumb': '' }),
});

/**
 * Mock implementation for @radix-ui/react-tabs
 */
export const mockRadixTabs = () => ({
  Root: (props: MockRadixProps) => h('div', { ...props, 'data-radix-tabs-root': '' }),
  List: (props: MockRadixProps) => h('div', { ...props, 'data-radix-tabs-list': '', role: 'tablist' }),
  Trigger: (props: MockRadixProps) => h('button', {
    ...props,
    'data-radix-tabs-trigger': '',
    type: 'button',
    role: 'tab',
    'aria-selected': props['aria-selected'] || false
  }),
  Content: (props: MockRadixProps) => h('div', {
    ...props,
    'data-radix-tabs-content': '',
    role: 'tabpanel'
  }),
});

/**
 * Mock implementation for @radix-ui/react-label
 */
export const mockRadixLabel = () => ({
  Root: (props: MockRadixProps) => h('label', { ...props, 'data-radix-label-root': '' }),
});

/**
 * Mock implementation for @radix-ui/react-select
 */
export const mockRadixSelect = () => ({
  Root: (props: MockRadixProps) => h('div', { ...props, 'data-radix-select-root': '' }),
  Trigger: (props: MockRadixProps) => h('button', {
    ...props,
    'data-radix-select-trigger': '',
    type: 'button',
    role: 'combobox',
    'aria-expanded': props['aria-expanded'] || false
  }),
  Value: (props: MockRadixProps) => h('span', { ...props, 'data-radix-select-value': '' }),
  Icon: (props: MockRadixProps) => h('span', { ...props, 'data-radix-select-icon': '' }),
  Portal: (props: MockRadixProps) => h('div', { ...props, 'data-radix-select-portal': '' }),
  Content: (props: MockRadixProps) => h('div', {
    ...props,
    'data-radix-select-content': '',
    role: 'listbox'
  }),
  Viewport: (props: MockRadixProps) => h('div', { ...props, 'data-radix-select-viewport': '' }),
  Item: (props: MockRadixProps) => h('div', {
    ...props,
    'data-radix-select-item': '',
    role: 'option'
  }),
  ItemText: (props: MockRadixProps) => h('span', { ...props, 'data-radix-select-item-text': '' }),
  ItemIndicator: (props: MockRadixProps) => h('span', { ...props, 'data-radix-select-item-indicator': '' }),
});

/**
 * Mock implementation for @radix-ui/react-separator
 */
export const mockRadixSeparator = () => ({
  Root: (props: MockRadixProps) => h('div', {
    ...props,
    'data-radix-separator-root': '',
    role: 'separator'
  }),
});

/**
 * Mock implementation for @radix-ui/react-popover
 */
export const mockRadixPopover = () => ({
  Root: (props: MockRadixProps) => h('div', { ...props, 'data-radix-popover-root': '' }),
  Trigger: (props: MockRadixProps) => h('button', {
    ...props,
    'data-radix-popover-trigger': '',
    type: 'button',
    'aria-expanded': props['aria-expanded'] || false
  }),
  Portal: (props: MockRadixProps) => h('div', { ...props, 'data-radix-popover-portal': '' }),
  Content: (props: MockRadixProps) => h('div', { ...props, 'data-radix-popover-content': '' }),
  Arrow: (props: MockRadixProps) => h('div', { ...props, 'data-radix-popover-arrow': '' }),
  Close: (props: MockRadixProps) => h('button', {
    ...props,
    'data-radix-popover-close': '',
    type: 'button'
  }),
});

/**
 * Helper function to mock all commonly used Radix UI primitives
 *
 * Usage:
 *   import { vi } from 'vitest';
 *   import { mockAllRadixPrimitives } from '@test/mocks/radix';
 *
 *   mockAllRadixPrimitives(vi);
 */
export function mockAllRadixPrimitives(viInstance: typeof import('vitest')['vi']) {
  viInstance.mock('@radix-ui/react-dialog', mockRadixDialog);
  viInstance.mock('@radix-ui/react-switch', mockRadixSwitch);
  viInstance.mock('@radix-ui/react-tabs', mockRadixTabs);
  viInstance.mock('@radix-ui/react-label', mockRadixLabel);
  viInstance.mock('@radix-ui/react-select', mockRadixSelect);
  viInstance.mock('@radix-ui/react-separator', mockRadixSeparator);
  viInstance.mock('@radix-ui/react-popover', mockRadixPopover);
}
