(function() {
  class DocumentOverlay {
    constructor(container) {
      // container can be element or selector
      if (typeof container === 'string') {
        this.container = document.querySelector(container);
      } else {
        this.container = container;
      }

      if (!this.container) {
        throw new Error('DocumentOverlay: container not found');
      }

      // Create overlay wrapper
      this.overlay = document.createElement('div');
      this.overlay.style.position = 'absolute';
      this.overlay.style.top = 0;
      this.overlay.style.left = 0;
      this.overlay.style.width = '100%';
      this.overlay.style.height = '100%';
      this.overlay.style.pointerEvents = 'none';
      this.overlay.className = 'document-visual-overlay';
      this.container.style.position = this.container.style.position || 'relative';
      this.container.appendChild(this.overlay);
    }

    static normalizeBox(box) {
      // Accept different formats. Expect numbers 0-1000 for x/y ranges.
      // Support {x_min, y_min, x_max, y_max} or {x,y,w,h}
      if (box.x_min !== undefined) {
        return {
          xMin: box.x_min,
          yMin: box.y_min,
          xMax: box.x_max,
          yMax: box.y_max
        };
      }
      if (box.x !== undefined) {
        return {
          xMin: box.x,
          yMin: box.y,
          xMax: box.x + (box.w || box.width || 0),
          yMax: box.y + (box.h || box.height || 0)
        };
      }
      // fallback
      return null;
    }

    clear() {
      this.overlay.innerHTML = '';
    }

    render(visualGrounding) {
      if (!Array.isArray(visualGrounding)) return;
      this.clear();

      visualGrounding.forEach((item) => {
        const box = DocumentOverlay.normalizeBox(item);
        if (!box) return;

        // Convert 0-1000 to percent
        const left = (box.xMin / 1000) * 100;
        const top = (box.yMin / 1000) * 100;
        const right = (box.xMax / 1000) * 100;
        const bottom = (box.yMax / 1000) * 100;
        const width = right - left;
        const height = bottom - top;

        const div = document.createElement('div');
        div.className = 'bounding-box';
        div.style.position = 'absolute';
        div.style.left = left + '%';
        div.style.top = top + '%';
        div.style.width = width + '%';
        div.style.height = height + '%';
        div.style.pointerEvents = 'auto';

        // Tooltip / label
        if (item.label || item.score || item.confidence) {
          const label = document.createElement('div');
          label.className = 'text-xs font-mono px-1 bg-yellow-300 text-yellow-900';
          label.style.position = 'absolute';
          label.style.top = '-1.75rem';
          label.style.left = '0';
          label.textContent = `${item.label || ''} ${item.confidence ? `(${Math.round(item.confidence * 100)}%)` : ''}`.trim();
          div.appendChild(label);
        }

        this.overlay.appendChild(div);
      });
    }
  }

  window.DocumentOverlay = DocumentOverlay;
})();