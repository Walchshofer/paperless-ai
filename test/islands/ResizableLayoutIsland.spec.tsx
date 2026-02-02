import { describe, it, expect, beforeEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, screen, act, waitFor } from '@testing-library/preact';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });

import ResizableLayoutIsland from '../../src/islands/ResizableLayoutIsland';

describe('ResizableLayoutIsland (Sidebar Resize)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Reset CSS variable
    document.documentElement.style.removeProperty('--sidebar-width');
    // Reset window width to desktop
    Object.defineProperty(window, 'innerWidth', { value: 1200 });
  });

  it('should render resize handle on desktop', async () => {
    render(<ResizableLayoutIsland />);
    
    await waitFor(() => {
      const handle = screen.queryByTestId('sidebar-resize-handle');
      expect(handle).toBeTruthy();
    });
  });

  it('should not render on mobile viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 800 });
    
    // Trigger resize event to update state
    render(<ResizableLayoutIsland />);
    
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
    
    await waitFor(() => {
      const handle = screen.queryByTestId('sidebar-resize-handle');
      expect(handle).toBeNull();
    });
  });

  it('should have correct ARIA attributes for accessibility', async () => {
    render(<ResizableLayoutIsland minWidth={300} maxWidth={600} defaultWidth={400} />);
    
    await waitFor(() => {
      const handle = screen.getByTestId('sidebar-resize-handle');
      expect(handle.getAttribute('role')).toBe('separator');
      expect(handle.getAttribute('aria-orientation')).toBe('vertical');
      expect(handle.getAttribute('aria-valuemin')).toBe('300');
      expect(handle.getAttribute('aria-valuemax')).toBe('600');
      expect(handle.getAttribute('aria-valuenow')).toBe('400');
      expect(handle.getAttribute('tabindex')).toBe('0');
    });
  });

  it('should load persisted width from localStorage', async () => {
    localStorageMock.setItem('paperless-sidebar-width', '450');
    
    render(<ResizableLayoutIsland storageKey="paperless-sidebar-width" />);
    
    await waitFor(() => {
      expect(localStorageMock.getItem).toHaveBeenCalledWith('paperless-sidebar-width');
    });
  });

  it('should apply width to CSS variable', async () => {
    render(<ResizableLayoutIsland defaultWidth={500} />);
    
    await waitFor(() => {
      const width = document.documentElement.style.getPropertyValue('--sidebar-width');
      expect(width).toBe('500px');
    });
  });

  it('should dispatch sidebar:resize event on width change', async () => {
    const resizeHandler = vi.fn();
    window.addEventListener('sidebar:resize', resizeHandler);
    
    render(<ResizableLayoutIsland defaultWidth={400} />);
    
    await waitFor(() => {
      expect(resizeHandler).toHaveBeenCalled();
    });
    
    const event = resizeHandler.mock.calls[0][0] as CustomEvent;
    expect(event.detail.sidebarWidth).toBe(400);
    
    window.removeEventListener('sidebar:resize', resizeHandler);
  });

  it('should support keyboard navigation with Arrow keys', async () => {
    render(<ResizableLayoutIsland defaultWidth={400} minWidth={300} maxWidth={600} />);
    
    const handle = await screen.findByTestId('sidebar-resize-handle');
    
    // Press ArrowLeft to increase sidebar width
    await act(async () => {
      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    });
    
    await waitFor(() => {
      const width = document.documentElement.style.getPropertyValue('--sidebar-width');
      expect(width).toBe('420px'); // 400 + 20
    });
    
    // Press ArrowRight to decrease sidebar width
    await act(async () => {
      fireEvent.keyDown(handle, { key: 'ArrowRight' });
    });
    
    await waitFor(() => {
      const width = document.documentElement.style.getPropertyValue('--sidebar-width');
      expect(width).toBe('400px'); // 420 - 20
    });
  });

  it('should respect min/max constraints', async () => {
    render(<ResizableLayoutIsland defaultWidth={310} minWidth={300} maxWidth={600} />);
    
    const handle = await screen.findByTestId('sidebar-resize-handle');
    
    // Try to decrease below min
    await act(async () => {
      fireEvent.keyDown(handle, { key: 'ArrowRight' });
    });
    
    await waitFor(() => {
      const width = document.documentElement.style.getPropertyValue('--sidebar-width');
      expect(width).toBe('300px'); // Clamped to min
    });
  });

  it('should persist width to localStorage on keyboard resize', async () => {
    render(<ResizableLayoutIsland defaultWidth={400} storageKey="test-key" />);
    
    const handle = await screen.findByTestId('sidebar-resize-handle');
    
    await act(async () => {
      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    });
    
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', '420');
    });
  });
});
