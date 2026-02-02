import { h } from 'preact';
import { render, fireEvent, screen, act, waitFor } from '@testing-library/preact';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import OverlayViewerIsland from '../../src/islands/OverlayViewerIsland';

// Mock fetch
const _mockFetchResponse: Response = {
  ok: true,
  json: async () => ({ annotations: [], overlays: [] }) as unknown,
  text: async () => '' as unknown,
} as unknown as Response;
global.fetch = vi.fn(() => Promise.resolve(_mockFetchResponse));

// Track loaded image URLs for testing
let lastLoadedImageUrl: string | null = null;
let shouldFailNormalized = false;
let shouldFailAll = false;

// Mock Image to fire onload or onerror based on test configuration
global.Image = class {
  onload: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  naturalWidth = 1000;
  naturalHeight = 1000;
  private _src = '';
  set src(val: string) {
    this._src = val;
    lastLoadedImageUrl = val;
    // Simulate async load
    setTimeout(() => {
      // If shouldFailAll is set, fail all images
      if (shouldFailAll) {
        if (this.onerror) this.onerror(new Error('Image load failed'));
        return;
      }
      // If shouldFailNormalized is set and this is a normalized URL, fail it
      if (shouldFailNormalized && val.includes('/api/visual-rag/normalized/')) {
        if (this.onerror) this.onerror(new Error('Normalized URL failed'));
        return;
      }
      // Otherwise succeed
      if (this.onload) this.onload();
    }, 50);
  }
  get src() { return this._src; }
} as unknown as typeof Image;

describe('OverlayViewerIsland (Red Pen Enhancements)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastLoadedImageUrl = null;
    shouldFailNormalized = false;
    shouldFailAll = false;
  });

  it('zooms to region when overlay:highlight-region is received', async () => {
    const { container } = render(<OverlayViewerIsland documentId={1} />);
    const viewport = container.querySelector('[data-testid="overlay-viewport"]');
    expect(viewport).toBeTruthy();

    const containerEl = container.querySelector('[data-testid="overlay-container"]');
    if (containerEl) {
        vi.spyOn(containerEl, 'getBoundingClientRect').mockReturnValue({
            left: 0, top: 0, width: 1000, height: 1000, bottom: 1000, right: 1000, x: 0, y: 0, toJSON: () => {}
        });
        Object.defineProperty(containerEl, 'clientWidth', { value: 1000, configurable: true });
        Object.defineProperty(containerEl, 'clientHeight', { value: 1000, configurable: true });
    }

    const initialClass = viewport?.getAttribute('class') || '';

    // Dispatch event
    await act(async () => {
      window.dispatchEvent(new CustomEvent('overlay:highlight-region', {
        detail: {
          bbox: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 },
          page: 1
        }
      }));
    });

    const newClass = viewport?.getAttribute('class') || '';
    expect(newClass).not.toBe(initialClass);
    expect(newClass).toContain('translate');
    expect(newClass).toContain('scale');
  });

  it('emits overlay:draw-complete when in draw mode', async () => {
    const onDrawComplete = vi.fn();
    window.addEventListener('overlay:draw-complete', onDrawComplete);
    
    // Mount with mode="draw"
    const { container } = render(<OverlayViewerIsland documentId={1} mode="draw" />);
    
    // Wait for image load (triggered by Image mock)
    await waitFor(() => {
        expect(screen.queryByTestId('overlay-loading')).toBeNull();
    });

    const overlayContainer = container.querySelector('[data-testid="overlay-container"]');
    expect(overlayContainer).toBeTruthy();
    
    vi.spyOn(overlayContainer!, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 1000, height: 1000, bottom: 1000, right: 1000, x: 0, y: 0, toJSON: () => {}
    });
    Object.defineProperty(overlayContainer!, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(overlayContainer!, 'clientHeight', { value: 1000, configurable: true });

    // Enable draw mode
    const toggle = screen.getByTestId('red-pen-toggle');
    fireEvent.click(toggle);

    // Draw
    fireEvent.mouseDown(overlayContainer!, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(overlayContainer!, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(overlayContainer!, { clientX: 200, clientY: 200 });

    // Assert
    await waitFor(() => {
      expect(onDrawComplete).toHaveBeenCalled();
    });
    
    const event = onDrawComplete.mock.calls[0][0] as CustomEvent;
    expect(event.detail.bbox).toBeDefined();
    // 100 to 200 is 10% of 1000.
    expect(event.detail.bbox.x).toBeCloseTo(0.1);
    
    window.removeEventListener('overlay:draw-complete', onDrawComplete);
  });

  it('renders suggestions (ghost boxes)', () => {
    const suggestions = [{
      id: 'ghost-1',
      boundingBox: { x: 0.3, y: 0.3, width: 0.1, height: 0.1 },
      label: 'Suggestion',
    }];
    
    render(<OverlayViewerIsland documentId={1} suggestions={suggestions} />);
    
    const ghosts = screen.getAllByTestId('overlay-ghost-box');
    expect(ghosts.length).toBe(1);
    expect(ghosts[0].getAttribute('data-label')).toBe('Suggestion');
  });
});
describe('OverlayViewerIsland (Image Loading Priority)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastLoadedImageUrl = null;
    shouldFailNormalized = false;
    shouldFailAll = false;
  });

  it('should prioritize normalized URL over original URL', async () => {
    render(
      <OverlayViewerIsland 
        documentId={123}
        originalUrl="http://paperless.local/documents/123/download/"
      />
    );
    
    // Wait for image to load
    await waitFor(() => {
      expect(lastLoadedImageUrl).toContain('/api/visual-rag/normalized/123');
    });
    
    // Should NOT use the original URL when normalized works
    expect(lastLoadedImageUrl).not.toContain('paperless.local');
  });

  it('should fallback to original URL when normalized URL fails', async () => {
    shouldFailNormalized = true;
    
    render(
      <OverlayViewerIsland 
        documentId={456}
        originalUrl="http://paperless.local/documents/456/download/"
      />
    );
    
    // First attempt should be normalized URL
    await waitFor(() => {
      expect(lastLoadedImageUrl).toContain('/api/visual-rag/normalized/456');
    });
    
    // After failure, should fallback to original URL
    await waitFor(() => {
      expect(lastLoadedImageUrl).toContain('paperless.local');
    }, { timeout: 2000 });
  });

  it('should show error state with retry button when all URLs fail', async () => {
    shouldFailAll = true;
    
    render(
      <OverlayViewerIsland 
        documentId={789}
      />
    );
    
    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('image-error')).toBeTruthy();
    }, { timeout: 2000 });
    
    // Should show retry button
    const retryButton = screen.getByTestId('image-retry-button');
    expect(retryButton).toBeTruthy();
    expect(retryButton.textContent).toContain('Retry');
  });

  it('should show loading state while fetching image', async () => {
    render(<OverlayViewerIsland documentId={111} />);
    
    // Loading state should be visible initially
    const loading = screen.queryByTestId('overlay-loading');
    expect(loading).toBeTruthy();
    
    // Wait for image to load
    await waitFor(() => {
      expect(screen.queryByTestId('overlay-loading')).toBeNull();
    });
  });

  it('should include page number in normalized URL', async () => {
    render(
      <OverlayViewerIsland 
        documentId={222}
        page={3}
      />
    );
    
    await waitFor(() => {
      expect(lastLoadedImageUrl).toContain('/api/visual-rag/normalized/222?page=3');
    });
  });

  it('should handle retry after error', async () => {
    shouldFailAll = true;
    
    const { rerender } = render(
      <OverlayViewerIsland documentId={333} />
    );
    
    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('image-error')).toBeTruthy();
    }, { timeout: 2000 });
    
    // Reset failure flag and click retry
    shouldFailAll = false;
    const retryButton = screen.getByTestId('image-retry-button');
    
    await act(async () => {
      fireEvent.click(retryButton);
    });
    
    // Should attempt to load again
    await waitFor(() => {
      expect(lastLoadedImageUrl).toContain('/api/visual-rag/normalized/333');
    });
    
    // Should eventually succeed
    await waitFor(() => {
      expect(screen.queryByTestId('image-error')).toBeNull();
    });
  });
});