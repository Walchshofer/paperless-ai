import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import type { OverlayViewerContract } from '../ui/contracts/OverlayViewer.contract';

export default function OverlayViewerIsland(props: Partial<OverlayViewerContract>) {
  useEffect(() => {
    // Initialize overlay viewer, load image for documentId/page
  }, []);

  return (
    <div data-testid="overlay-viewer-root">
      <!-- Overlay Viewer Island (stub) -->
      <div id="overlayContainer" data-testid="overlay-container">(image placeholder)</div>
      <div id="overlayLoading" data-testid="overlay-loading" class="hidden">Loading...</div>
    </div>
  );
}
