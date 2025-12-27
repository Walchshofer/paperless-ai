/**
 * OverlayLegend - Displays domain-specific field legend
 *
 * Shows color-coded fields for the current domain with mandatory indicators.
 * Provides filter controls for the OverlayViewer component.
 */
(function() {
  class OverlayLegend {
    constructor(containerEl, options = {}) {
      this.container = typeof containerEl === 'string'
        ? document.querySelector(containerEl)
        : containerEl;

      if (!this.container) {
        throw new Error('OverlayLegend: container not found');
      }

      this.domain = options.domain || 'GENERAL';
      this.onFilterChange = options.onFilterChange || null;
      this.onFieldClick = options.onFieldClick || null;
      this.activeFilters = new Set();
      this.legendData = [];
      this.showMandatoryOnly = false;
      this.collapsed = options.collapsed || false;

      this._render();
    }

    /**
     * Set domain and refresh legend
     * @param {string} domain - Domain key (financial, medical, legal, general)
     */
    setDomain(domain) {
      this.domain = domain.toUpperCase();
      this.activeFilters.clear();
      this._fetchAndRender();
    }

    /**
     * Set overlay stats to show detection counts
     * @param {Object} stats - Stats from OverlayViewer.getStats()
     */
    setStats(stats) {
      this.stats = stats;
      this._updateStats();
    }

    async _fetchAndRender() {
      try {
        const response = await fetch(`/api/visual-rag/legend/${this.domain.toLowerCase()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch legend');
        }
        this.legendData = await response.json();
        this._render();
      } catch (error) {
        console.error('OverlayLegend: Failed to fetch legend data', error);
        this._renderError();
      }
    }

    _render() {
      if (this.legendData.length === 0) {
        this._fetchAndRender();
        return;
      }

      const domainIcon = this._getDomainIcon();
      const collapsedClass = this.collapsed ? 'collapsed' : '';

      this.container.innerHTML = `
        <div class="overlay-legend ${collapsedClass}">
          <div class="overlay-legend-header">
            <button class="overlay-legend-toggle" title="Toggle legend">
              <span class="legend-icon">${domainIcon}</span>
              <span class="legend-title">${this.domain} Fields</span>
              <span class="legend-chevron">${this.collapsed ? '&#9656;' : '&#9662;'}</span>
            </button>
            <div class="legend-stats" style="display:none;">
              <span class="stats-total"></span>
            </div>
          </div>
          <div class="overlay-legend-body" style="${this.collapsed ? 'display:none;' : ''}">
            <div class="legend-fields">
              ${this.legendData.map(field => this._renderField(field)).join('')}
            </div>
            <div class="legend-controls">
              <label class="legend-checkbox">
                <input type="checkbox" id="legend-mandatory-only" ${this.showMandatoryOnly ? 'checked' : ''}>
                <span>Show mandatory only</span>
              </label>
            </div>
          </div>
        </div>
      `;

      this._attachListeners();
    }

    _renderField(field) {
      const { key, label, color, isMandatory } = field;
      const mandatoryClass = isMandatory ? 'is-mandatory' : '';
      const mandatoryStar = isMandatory ? '<span class="mandatory-star">*</span>' : '';

      return `
        <div class="legend-field ${mandatoryClass}" data-field="${key}" data-color="${color}">
          <span class="field-color" style="background-color: ${color}"></span>
          <span class="field-label">${label}</span>
          ${mandatoryStar}
        </div>
      `;
    }

    _getDomainIcon() {
      const icons = {
        FINANCIAL: '&#x1F7E7;', // Orange square
        MEDICAL: '&#x1F7E9;',   // Green square
        LEGAL: '&#x1F7EA;',     // Purple square
        GENERAL: '&#x1F7E6;'    // Blue square
      };
      return icons[this.domain] || '&#x1F4C4;'; // Document fallback
    }

    _renderError() {
      this.container.innerHTML = `
        <div class="overlay-legend error">
          <div class="overlay-legend-header">
            <span class="legend-title">Legend unavailable</span>
          </div>
        </div>
      `;
    }

    _attachListeners() {
      // Toggle collapse
      const toggleBtn = this.container.querySelector('.overlay-legend-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          this.collapsed = !this.collapsed;
          this._render();
        });
      }

      // Mandatory only checkbox
      const mandatoryCheckbox = this.container.querySelector('#legend-mandatory-only');
      if (mandatoryCheckbox) {
        mandatoryCheckbox.addEventListener('change', (e) => {
          this.showMandatoryOnly = e.target.checked;
          if (this.onFilterChange) {
            this.onFilterChange({ mandatoryOnly: this.showMandatoryOnly });
          }
        });
      }

      // Field click handlers
      const fields = this.container.querySelectorAll('.legend-field');
      fields.forEach(field => {
        field.addEventListener('click', () => {
          const key = field.dataset.field;
          if (this.onFieldClick) {
            this.onFieldClick(key, this.legendData.find(f => f.key === key));
          }
        });

        // Hover effect
        field.addEventListener('mouseenter', () => {
          field.classList.add('hovered');
        });
        field.addEventListener('mouseleave', () => {
          field.classList.remove('hovered');
        });
      });
    }

    _updateStats() {
      if (!this.stats) return;

      const statsEl = this.container.querySelector('.legend-stats');
      const totalEl = this.container.querySelector('.stats-total');

      if (statsEl && totalEl) {
        totalEl.textContent = `${this.stats.total} detected`;
        statsEl.style.display = 'block';
      }
    }

    /**
     * Highlight a field in the legend
     * @param {string} fieldKey - Field key to highlight
     */
    highlightField(fieldKey) {
      const fields = this.container.querySelectorAll('.legend-field');
      fields.forEach(field => {
        if (field.dataset.field === fieldKey) {
          field.classList.add('highlighted');
        } else {
          field.classList.remove('highlighted');
        }
      });
    }

    /**
     * Clear all highlights
     */
    clearHighlights() {
      const fields = this.container.querySelectorAll('.legend-field');
      fields.forEach(field => field.classList.remove('highlighted'));
    }

    /**
     * Get the legend data
     * @returns {Array} Legend field data
     */
    getLegendData() {
      return this.legendData;
    }

    /**
     * Destroy the component
     */
    destroy() {
      this.container.innerHTML = '';
    }
  }

  // Export for module systems and global
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OverlayLegend };
  }
  window.OverlayLegend = OverlayLegend;
})();
