/**
 * OverlayViewer - Renders visual overlays on document images
 *
 * Supports color-coded bounding boxes with domain-specific styling,
 * interactive tooltips, and click handling for the Visual RAG UI.
 *
 * Uses canvas rendering for smooth performance with many overlays.
 * Coordinates are in 0-1000 range (normalized from Qwen3-VL output).
 */
(function() {
  class OverlayViewer {
    constructor(containerEl, options = {}) {
      this.container = typeof containerEl === 'string'
        ? document.querySelector(containerEl)
        : containerEl;

      if (!this.container) {
        throw new Error('OverlayViewer: container not found');
      }

      this.imageEl = null;
      this.overlayCanvas = null;
      this.overlays = [];
      this.domain = options.domain || 'GENERAL';
      this.showMandatoryOnly = options.showMandatoryOnly || false;
      this.onOverlayClick = options.onOverlayClick || null;
      this.onOverlayHover = options.onOverlayHover || null;
      this.scale = 1;
      this.hoveredOverlay = null;

      this._init();
    }

    _init() {
      // Create wrapper with relative positioning
      this.wrapper = document.createElement('div');
      this.wrapper.className = 'overlay-viewer-wrapper';
      this.wrapper.style.position = 'relative';
      this.wrapper.style.display = 'inline-block';
      this.container.appendChild(this.wrapper);

      // Create canvas for overlays
      this.overlayCanvas = document.createElement('canvas');
      this.overlayCanvas.className = 'overlay-canvas';
      this.overlayCanvas.style.position = 'absolute';
      this.overlayCanvas.style.top = '0';
      this.overlayCanvas.style.left = '0';
      this.overlayCanvas.style.pointerEvents = 'auto';
      this.overlayCanvas.style.cursor = 'default';
      this.wrapper.appendChild(this.overlayCanvas);

      // Create tooltip element
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'overlay-tooltip';
      this.tooltip.style.display = 'none';
      this.tooltip.style.position = 'absolute';
      this.tooltip.style.backgroundColor = '#1f2937';
      this.tooltip.style.color = '#ffffff';
      this.tooltip.style.padding = '8px 12px';
      this.tooltip.style.borderRadius = '8px';
      this.tooltip.style.fontSize = '13px';
      this.tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      this.tooltip.style.zIndex = '100';
      this.tooltip.style.pointerEvents = 'none';
      this.tooltip.style.maxWidth = '280px';
      this.wrapper.appendChild(this.tooltip);

      // Add event listeners
      this.overlayCanvas.addEventListener('mousemove', this._handleMouseMove.bind(this));
      this.overlayCanvas.addEventListener('mouseleave', this._hideTooltip.bind(this));
      this.overlayCanvas.addEventListener('click', this._handleClick.bind(this));

      // Handle window resize
      this._resizeHandler = this._handleResize.bind(this);
      window.addEventListener('resize', this._resizeHandler);
    }

    /**
     * Set the document image to render overlays on
     * @param {HTMLImageElement} imgEl - Image element
     */
    setImage(imgEl) {
      // Remove previous image if exists
      if (this.imageEl && this.imageEl.parentNode === this.wrapper) {
        this.wrapper.removeChild(this.imageEl);
      }

      this.imageEl = imgEl;
      this.imageEl.style.display = 'block';
      this.wrapper.insertBefore(imgEl, this.overlayCanvas);

      // Wait for image to load if needed
      if (imgEl.complete) {
        this._resizeCanvas();
        this._render();
      } else {
        imgEl.addEventListener('load', () => {
          this._resizeCanvas();
          this._render();
        }, { once: true });
      }
    }

    /**
     * Set overlays to render
     * @param {Array<Object>} overlays - Array of overlay objects with boundingBox, color, etc.
     * @param {string} domain - Optional domain to set
     */
    setOverlays(overlays, domain = null) {
      this.overlays = overlays || [];
      if (domain) this.domain = domain;
      this._render();
    }

    /**
     * Update domain and re-render
     * @param {string} domain - Domain name (FINANCIAL, MEDICAL, LEGAL, GENERAL)
     */
    setDomain(domain) {
      this.domain = domain;
      this._render();
    }

    _resizeCanvas() {
      if (!this.imageEl) return;

      const rect = this.imageEl.getBoundingClientRect();
      const width = this.imageEl.naturalWidth || rect.width;
      const height = this.imageEl.naturalHeight || rect.height;
      const displayWidth = this.imageEl.width || rect.width;
      const displayHeight = this.imageEl.height || rect.height;

      this.overlayCanvas.width = displayWidth;
      this.overlayCanvas.height = displayHeight;
      this.overlayCanvas.style.width = displayWidth + 'px';
      this.overlayCanvas.style.height = displayHeight + 'px';

      // Scale factor: coordinates are 0-1000, need to map to display size
      this.scale = displayWidth / 1000;
    }

    _handleResize() {
      this._resizeCanvas();
      this._render();
    }

    _render() {
      if (!this.overlayCanvas) return;

      const ctx = this.overlayCanvas.getContext('2d');
      ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

      const filtered = this.showMandatoryOnly
        ? this.overlays.filter(o => o.isMandatory)
        : this.overlays;

      // Draw overlays (non-hovered first, then hovered on top)
      const hovered = this.hoveredOverlay;
      filtered.filter(o => o !== hovered).forEach(overlay => {
        this._drawOverlay(ctx, overlay, false);
      });

      // Draw hovered overlay last (on top)
      if (hovered && filtered.includes(hovered)) {
        this._drawOverlay(ctx, hovered, true);
      }
    }

    _drawOverlay(ctx, overlay, isHovered) {
      const { boundingBox, color, isMandatory, label } = overlay;

      if (!boundingBox) return;

      const x = boundingBox.x * this.scale;
      const y = boundingBox.y * this.scale;
      const w = boundingBox.width * this.scale;
      const h = boundingBox.height * this.scale;

      // Draw semi-transparent fill for hovered
      if (isHovered) {
        ctx.fillStyle = this._hexToRgba(color, 0.15);
        ctx.fillRect(x, y, w, h);
      }

      // Draw box border
      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 4 : (isMandatory ? 3 : 2);
      ctx.setLineDash(isMandatory ? [] : [5, 3]);
      ctx.strokeRect(x, y, w, h);

      // Draw label background
      ctx.font = '12px Inter, system-ui, sans-serif';
      const labelText = label || 'Unknown';
      const labelMetrics = ctx.measureText(labelText);
      const labelWidth = labelMetrics.width + 10;
      const labelHeight = 18;
      const labelY = y - labelHeight - 2;

      ctx.fillStyle = color;
      ctx.fillRect(x, labelY, labelWidth, labelHeight);

      // Draw label text
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, x + 5, labelY + labelHeight / 2);

      // Mandatory indicator (exclamation in circle)
      if (isMandatory) {
        const indicatorX = x + w - 10;
        const indicatorY = y + 10;
        const radius = 7;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(indicatorX, indicatorY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText('!', indicatorX, indicatorY);
        ctx.textAlign = 'left';
      }

      ctx.setLineDash([]);
    }

    _hexToRgba(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    _handleMouseMove(e) {
      const rect = this.overlayCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / this.scale;
      const y = (e.clientY - rect.top) / this.scale;

      const filtered = this.showMandatoryOnly
        ? this.overlays.filter(o => o.isMandatory)
        : this.overlays;

      const hovered = filtered.find(o => this._isPointInBox(x, y, o.boundingBox));

      if (hovered !== this.hoveredOverlay) {
        this.hoveredOverlay = hovered;
        this._render();
      }

      if (hovered) {
        this.overlayCanvas.style.cursor = 'pointer';
        this._showTooltip(e, hovered);
        if (this.onOverlayHover) {
          this.onOverlayHover(hovered);
        }
      } else {
        this.overlayCanvas.style.cursor = 'default';
        this._hideTooltip();
        if (this.onOverlayHover) {
          this.onOverlayHover(null);
        }
      }
    }

    _isPointInBox(x, y, box) {
      if (!box) return false;
      return x >= box.x && x <= box.x + box.width &&
             y >= box.y && y <= box.y + box.height;
    }

    _showTooltip(e, overlay) {
      const { label, value, paperlessMapping, confidence, isMandatory, domain } = overlay;

      const confidencePercent = Math.round((confidence || 0.5) * 100);
      const mandatoryBadge = isMandatory ? '<span style="color:#fbbf24;margin-left:4px;">*</span>' : '';

      this.tooltip.innerHTML = `
        <div style="font-weight:600;margin-bottom:4px;">${label || 'Unknown'}${mandatoryBadge}</div>
        ${value ? `<div style="color:#d1d5db;margin-bottom:4px;">"${value}"</div>` : ''}
        <div style="font-size:11px;color:#9ca3af;">
          <span style="display:inline-block;width:12px;height:12px;background:${overlay.color};border-radius:2px;margin-right:6px;vertical-align:middle;"></span>
          ${paperlessMapping || 'unmapped'}
          <span style="margin-left:12px;">${confidencePercent}%</span>
        </div>
      `;

      // Position tooltip
      const tooltipX = e.offsetX + 15;
      const tooltipY = e.offsetY + 15;

      // Keep tooltip within canvas bounds
      const maxX = this.overlayCanvas.width - 200;
      const maxY = this.overlayCanvas.height - 80;

      this.tooltip.style.left = Math.min(tooltipX, maxX) + 'px';
      this.tooltip.style.top = Math.min(tooltipY, maxY) + 'px';
      this.tooltip.style.display = 'block';
    }

    _hideTooltip() {
      this.tooltip.style.display = 'none';
      if (this.hoveredOverlay) {
        this.hoveredOverlay = null;
        this._render();
      }
    }

    _handleClick(e) {
      if (!this.onOverlayClick) return;

      const rect = this.overlayCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / this.scale;
      const y = (e.clientY - rect.top) / this.scale;

      const filtered = this.showMandatoryOnly
        ? this.overlays.filter(o => o.isMandatory)
        : this.overlays;

      const clicked = filtered.find(o => this._isPointInBox(x, y, o.boundingBox));
      if (clicked) {
        this.onOverlayClick(clicked, e);
      }
    }

    /**
     * Toggle showing only mandatory fields
     * @param {boolean} show - True to show only mandatory fields
     */
    toggleMandatoryOnly(show) {
      this.showMandatoryOnly = show;
      this._render();
    }

    /**
     * Get overlay statistics
     * @returns {Object} Stats about displayed overlays
     */
    getStats() {
      const total = this.overlays.length;
      const mandatory = this.overlays.filter(o => o.isMandatory).length;
      const byDomain = {};

      this.overlays.forEach(o => {
        const d = o.domain || 'GENERAL';
        byDomain[d] = (byDomain[d] || 0) + 1;
      });

      return { total, mandatory, byDomain };
    }

    /**
     * Highlight a specific overlay
     * @param {string} overlayId - ID of overlay to highlight
     */
    highlightOverlay(overlayId) {
      const overlay = this.overlays.find(o => o.id === overlayId);
      if (overlay) {
        this.hoveredOverlay = overlay;
        this._render();
      }
    }

    /**
     * Clear highlight
     */
    clearHighlight() {
      this.hoveredOverlay = null;
      this._render();
    }

    /**
     * Destroy the viewer and cleanup
     */
    destroy() {
      window.removeEventListener('resize', this._resizeHandler);
      this.overlayCanvas.removeEventListener('mousemove', this._handleMouseMove);
      this.overlayCanvas.removeEventListener('mouseleave', this._hideTooltip);
      this.overlayCanvas.removeEventListener('click', this._handleClick);
      this.wrapper.remove();
    }
  }

  // Export for module systems and global
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OverlayViewer };
  }
  window.OverlayViewer = OverlayViewer;
})();
