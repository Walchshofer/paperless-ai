// Small CommonJS helper for overlay viewer transform math (testable from Node)
function computeUnscaledFromRaw(rawX, rawY, tx, ty, s) {
  return {
    x: (rawX - tx) / s,
    y: (rawY - ty) / s
  };
}

// Clamp translate so that the displayed content (image) cannot be panned completely off-screen.
// Parameters:
// - tx, ty: desired translation (pixels)
// - s: current zoom scale
// - containerW/H: container dimensions in pixels
// - imageNatW/H: natural image dimensions (pixels) - if null or 0, fallback to container
// - objectFit: 'contain' | 'cover' (we assume 'contain' in OverlayViewer)
function clampTranslate(tx, ty, s, containerW, containerH, imageNatW, imageNatH, objectFit = 'contain') {
  // Determine base display size of the image inside container according to object-fit
  let contentW = containerW;
  let contentH = containerH;

  if (imageNatW && imageNatH) {
    if (objectFit === 'contain') {
      const scaleBase = Math.min(containerW / imageNatW, containerH / imageNatH) || 1;
      contentW = imageNatW * scaleBase * s;
      contentH = imageNatH * scaleBase * s;
    } else if (objectFit === 'cover') {
      const scaleBase = Math.max(containerW / imageNatW, containerH / imageNatH) || 1;
      contentW = imageNatW * scaleBase * s;
      contentH = imageNatH * scaleBase * s;
    }
  } else {
    // fallback: assume content fills container scaled by s
    contentW = containerW * s;
    contentH = containerH * s;
  }

  // If content smaller than container, center it (no panning)
  let minX, maxX, minY, maxY;
  if (contentW <= containerW) {
    const centerX = (containerW - contentW) / 2;
    minX = maxX = centerX;
  } else {
    minX = containerW - contentW; // negative
    maxX = 0;
  }

  if (contentH <= containerH) {
    const centerY = (containerH - contentH) / 2;
    minY = maxY = centerY;
  } else {
    minY = containerH - contentH;
    maxY = 0;
  }

  const cx = Math.min(maxX, Math.max(minX, tx));
  const cy = Math.min(maxY, Math.max(minY, ty));

  return { x: cx, y: cy, contentW, contentH };
}

// Export for both Node.js (tests) and Browser (Vite)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeUnscaledFromRaw, clampTranslate };
} else {
  // Fallback for direct browser usage if not using a bundler
  window.OverlayUtils = { computeUnscaledFromRaw, clampTranslate };
}
