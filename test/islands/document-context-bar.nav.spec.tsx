import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DocumentContextBarIsland from '../../src/islands/DocumentContextBarIsland';

declare global {
  interface Window {
    __workspaceState?: Record<string, { isDirty?: boolean }>;
  }
}

describe('DocumentContextBarIsland - navigation blocking when dirty', () => {
  let originalConfirm: (message?: string) => boolean;
  
  beforeEach(() => {
    // reset workspace state
    window.__workspaceState = {};
    originalConfirm = window.confirm;
    // Mock window.location assign
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: { href: string } }).location = { href: '' };
  });

  afterEach(() => {
    window.confirm = originalConfirm;
    delete window.__workspaceState;
  });

  it('opens modal and cancels navigation when user clicks Cancel', async () => {
    const props = { 
      documentId: 1, 
      title: 'Doc1', 
      availableDocuments: [{ id: 1, title: 'Doc1' }, { id: 2, title: 'Doc2' }] 
    };
    const { container, getByTestId } = render(h(DocumentContextBarIsland, props));

    // Mark doc 1 as dirty
    if (window.__workspaceState) {
        window.__workspaceState['1'] = { isDirty: true };
    }

    // Open the selector dropdown explicitly
    const trigger = container.querySelector('[data-testid="document-selector-trigger"]');
    if (trigger) fireEvent.click(trigger);

    const btn = container.querySelector('[data-testid="document-option-2"]');
    expect(btn).toBeTruthy();
    if (btn) fireEvent.click(btn);

    // Modal should be visible
    const modal = getByTestId('nav-confirm-modal');
    expect(modal).toBeTruthy();

    // Click cancel
    const cancelBtn = getByTestId('nav-confirm-cancel');
    fireEvent.click(cancelBtn);
    
    expect(window.location.href).toBe('');
  });

  it('discards changes and navigates when Discard is clicked', async () => {
    const props = { 
      documentId: 1, 
      title: 'Doc1', 
      availableDocuments: [{ id: 1, title: 'Doc1' }, { id: 2, title: 'Doc2' }] 
    };
    const { container, getByTestId } = render(h(DocumentContextBarIsland, props));

    // Mark doc 1 as dirty
    if (window.__workspaceState) {
        window.__workspaceState['1'] = { isDirty: true };
    }

    // Open selector dropdown
    const trigger = container.querySelector('[data-testid="document-selector-trigger"]');
    if (trigger) fireEvent.click(trigger);

    const btn = container.querySelector('[data-testid="document-option-2"]');
    if (btn) fireEvent.click(btn);

    const discardBtn = getByTestId('nav-confirm-discard');
    fireEvent.click(discardBtn);

    expect(window.location.href).toBe('/document/2');
  });

  it('saves before navigating when Save is clicked', async () => {
    const props = { 
      documentId: 1, 
      title: 'Doc1', 
      availableDocuments: [{ id: 1, title: 'Doc1' }, { id: 2, title: 'Doc2' }] 
    };
    const { container, getByTestId } = render(h(DocumentContextBarIsland, props));

    // Mark doc 1 as dirty
    if (window.__workspaceState) {
        window.__workspaceState['1'] = { isDirty: true };
    }

    // Mock dispatchEvent to capture the event
    const _dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    // Listen for save request event simulation
    window.addEventListener('workspace:save-request', (e: Event) => {
        const detail = (e as CustomEvent).detail;
        expect(detail.documentId).toBe(1);
        // Simulate coordinator-driven success immediately
        window.dispatchEvent(new CustomEvent('workspace:save-complete', { detail: { documentId: 1 } }));
    });

    // Open selector dropdown
    const trigger = container.querySelector('[data-testid="document-selector-trigger"]');
    if (trigger) fireEvent.click(trigger);

    const btn = container.querySelector('[data-testid="document-option-2"]');
    if (btn) fireEvent.click(btn);

    const saveBtn = getByTestId('nav-confirm-save');
    fireEvent.click(saveBtn);

    // Wait for event loop
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(window.location.href).toBe('/document/2');
  });

  it('forces selector open when documentId is null', () => {
    const props = { 
      documentId: null, 
      title: null, 
      availableDocuments: [{ id: 1, title: 'Doc1' }] 
    };
    const { getByTestId } = render(h(DocumentContextBarIsland, props));
    
    // Selector should be open (dropdown visible)
    const dropdown = getByTestId('document-selector-dropdown');
    expect(dropdown).toBeTruthy();
    
    // Should show search input
    const searchInput = getByTestId('document-search-input');
    expect(searchInput).toBeTruthy();
  });
});
