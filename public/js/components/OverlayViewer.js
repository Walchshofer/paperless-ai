/* DEPRECATED: `OverlayViewer.js` (legacy) — Overlay rendering has been migrated to `overlay-viewer-island` (Preact island).
   This file is retained as a compatibility stub for older pages but no longer performs real rendering.
   Remove this file only after islands are validated and legacy pages are cleaned.
*/
(function() {
  // No-op compatibility stub to avoid runtime errors if legacy pages still import this file.
  function OverlayViewerStub(containerEl /*, options */) {
    console.warn('OverlayViewer (legacy) is deprecated. Use `overlay-viewer-island`.');
    this.container = typeof containerEl === 'string' ? document.querySelector(containerEl) : containerEl;
    this.overlays = [];
  }
  OverlayViewerStub.prototype.setImage = function() { /* no-op */ };
  OverlayViewerStub.prototype.setOverlays = function() { /* no-op */ };
  OverlayViewerStub.prototype.destroy = function() { /* no-op */ };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OverlayViewer: OverlayViewerStub };
  }
  window.OverlayViewer = OverlayViewerStub;
})();