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

/**
 * Mock implementation for @radix-ui/react-dialog
 */
export const mockRadixDialog = () => ({
  Root: (props: any) => h('div', { ...props, 'data-radix-dialog-root': '' }),
  Trigger: (props: any) => h('button', { ...props, 'data-radix-dialog-trigger': '', type: 'button' }),
  Portal: (props: any) => h('div', { ...props, 'data-radix-dialog-portal': '' }),
  Overlay: (props: any) => h('div', { ...props, 'data-radix-dialog-overlay': '' }),
  Content: (props: any) => h('div', { ...props, 'data-radix-dialog-content': '' }),
  Title: (props: any) => h('h2', { ...props, 'data-radix-dialog-title': '' }),
  Description: (props: any) => h('p', { ...props, 'data-radix-dialog-description': '' }),
  Close: (props: any) => h('button', { ...props, 'data-radix-dialog-close': '', type: 'button' }),
});

/**
 * Mock implementation for @radix-ui/react-switch
 */
export const mockRadixSwitch = () => ({
  Root: (props: any) => h('button', {
    ...props,
    'data-radix-switch-root': '',
    type: 'button',
    role: 'switch',
    'aria-checked': props.checked || false
  }),
  Thumb: (props: any) => h('span', { ...props, 'data-radix-switch-thumb': '' }),
});

/**
 * Mock implementation for @radix-ui/react-tabs
 */
export const mockRadixTabs = () => ({
  Root: (props: any) => h('div', { ...props, 'data-radix-tabs-root': '' }),
  List: (props: any) => h('div', { ...props, 'data-radix-tabs-list': '', role: 'tablist' }),
  Trigger: (props: any) => h('button', {
    ...props,
    'data-radix-tabs-trigger': '',
    type: 'button',
    role: 'tab',
    'aria-selected': props['aria-selected'] || false
  }),
  Content: (props: any) => h('div', {
    ...props,
    'data-radix-tabs-content': '',
    role: 'tabpanel'
  }),
});

/**
 * Mock implementation for @radix-ui/react-label
 */
export const mockRadixLabel = () => ({
  Root: (props: any) => h('label', { ...props, 'data-radix-label-root': '' }),
});

/**
 * Mock implementation for @radix-ui/react-select
 */
export const mockRadixSelect = () => ({
  Root: (props: any) => h('div', { ...props, 'data-radix-select-root': '' }),
  Trigger: (props: any) => h('button', {
    ...props,
    'data-radix-select-trigger': '',
    type: 'button',
    role: 'combobox',
    'aria-expanded': props['aria-expanded'] || false
  }),
  Value: (props: any) => h('span', { ...props, 'data-radix-select-value': '' }),
  Icon: (props: any) => h('span', { ...props, 'data-radix-select-icon': '' }),
  Portal: (props: any) => h('div', { ...props, 'data-radix-select-portal': '' }),
  Content: (props: any) => h('div', {
    ...props,
    'data-radix-select-content': '',
    role: 'listbox'
  }),
  Viewport: (props: any) => h('div', { ...props, 'data-radix-select-viewport': '' }),
  Item: (props: any) => h('div', {
    ...props,
    'data-radix-select-item': '',
    role: 'option'
  }),
  ItemText: (props: any) => h('span', { ...props, 'data-radix-select-item-text': '' }),
  ItemIndicator: (props: any) => h('span', { ...props, 'data-radix-select-item-indicator': '' }),
});

/**
 * Mock implementation for @radix-ui/react-separator
 */
export const mockRadixSeparator = () => ({
  Root: (props: any) => h('div', {
    ...props,
    'data-radix-separator-root': '',
    role: 'separator'
  }),
});

/**
 * Mock implementation for @radix-ui/react-popover
 */
export const mockRadixPopover = () => ({
  Root: (props: any) => h('div', { ...props, 'data-radix-popover-root': '' }),
  Trigger: (props: any) => h('button', {
    ...props,
    'data-radix-popover-trigger': '',
    type: 'button',
    'aria-expanded': props['aria-expanded'] || false
  }),
  Portal: (props: any) => h('div', { ...props, 'data-radix-popover-portal': '' }),
  Content: (props: any) => h('div', { ...props, 'data-radix-popover-content': '' }),
  Arrow: (props: any) => h('div', { ...props, 'data-radix-popover-arrow': '' }),
  Close: (props: any) => h('button', {
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
