/**
 * Visual Query Analytics Dashboard
 *
 * Real-time dashboard for visual query performance metrics.
 * Uses Chart.js for visualizations and SSE for real-time updates.
 */

(function() {
  'use strict';

  // State
  let latencyTrendChart = null;
  let accuracyDomainChart = null;
  let fallbackChart = null;
  let eventSource = null;

  // DOM elements
  const windowSelect = document.getElementById('windowSelect');
  const exportBtn = document.getElementById('exportBtn');

  /**
   * Initialize Chart.js charts
   */
  function initCharts(snapshot) {
    // Latency Trend Chart
    const latencyCtx = document.getElementById('latencyTrendChart')?.getContext('2d');
    if (latencyCtx) {
      latencyTrendChart = new Chart(latencyCtx, {
        type: 'line',
        data: {
          labels: snapshot.trend.map(t => formatTimeLabel(t.slot)),
          datasets: [
            {
              label: 'P50',
              data: snapshot.trend.map(t => t.p50),
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.3
            },
            {
              label: 'P95',
              data: snapshot.trend.map(t => t.p95),
              borderColor: '#f59e0b',
              backgroundColor: 'transparent',
              tension: 0.3
            },
            {
              label: 'P99',
              data: snapshot.trend.map(t => t.p99),
              borderColor: '#ef4444',
              backgroundColor: 'transparent',
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { usePointStyle: true, padding: 20 }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Latency (ms)' }
            }
          }
        }
      });
    }

    // Accuracy by Domain Chart
    const accuracyCtx = document.getElementById('accuracyDomainChart')?.getContext('2d');
    if (accuracyCtx) {
      const domains = Object.keys(snapshot.accuracyByDomain);
      const accuracies = domains.map(d => snapshot.accuracyByDomain[d].accuracy * 100);

      accuracyDomainChart = new Chart(accuracyCtx, {
        type: 'bar',
        data: {
          labels: domains.map(d => d.charAt(0).toUpperCase() + d.slice(1)),
          datasets: [{
            label: 'Accuracy %',
            data: accuracies,
            backgroundColor: [
              'rgba(59, 130, 246, 0.8)',
              'rgba(16, 185, 129, 0.8)',
              'rgba(139, 92, 246, 0.8)',
              'rgba(107, 114, 128, 0.8)'
            ],
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              title: { display: true, text: 'Accuracy %' }
            }
          }
        }
      });
    }

    // Fallback Rates Chart
    const fallbackCtx = document.getElementById('fallbackChart')?.getContext('2d');
    if (fallbackCtx) {
      const visualToText = snapshot.fallbackRates.visualToText * 100;
      const visualToOcr = snapshot.fallbackRates.visualToOcr * 100;
      const noFallback = 100 - visualToText - visualToOcr;

      fallbackChart = new Chart(fallbackCtx, {
        type: 'doughnut',
        data: {
          labels: ['No Fallback', 'Visual → Text', 'Visual → OCR'],
          datasets: [{
            data: [Math.max(0, noFallback), visualToText, visualToOcr],
            backgroundColor: [
              'rgba(16, 185, 129, 0.8)',
              'rgba(59, 130, 246, 0.8)',
              'rgba(139, 92, 246, 0.8)'
            ],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { usePointStyle: true, padding: 15 }
            }
          },
          cutout: '60%'
        }
      });
    }
  }

  /**
   * Update dashboard with new snapshot data
   */
  function updateDashboard(snapshot) {
    // Update latency metrics
    updateElement('latencyP50', snapshot.latency.p50Ms.toFixed(1) + '<span class="text-lg font-normal text-gray-500">ms</span>');
    updateElement('latencyP95', snapshot.latency.p95Ms.toFixed(1) + '<span class="text-lg font-normal text-gray-500">ms</span>');
    updateElement('latencyP99', snapshot.latency.p99Ms.toFixed(1) + '<span class="text-lg font-normal text-gray-500">ms</span>');

    // Update query stats
    updateElement('totalQueries', snapshot.counts.totalQueries);
    updateElement('successfulQueries', snapshot.counts.successfulQueries);
    updateElement('failedQueries', snapshot.counts.failedQueries);
    updateElement('errorRate', (snapshot.errorRate * 100).toFixed(1) + '<span class="text-lg font-normal text-gray-500">%</span>');

    // Update fallback rates
    updateElement('fallbackVisualToText', (snapshot.fallbackRates.visualToText * 100).toFixed(1) + '%');
    updateElement('fallbackVisualToOcr', (snapshot.fallbackRates.visualToOcr * 100).toFixed(1) + '%');

    // Update domain accuracy
    ['financial', 'medical', 'legal', 'general'].forEach(domain => {
      const stats = snapshot.accuracyByDomain[domain];
      updateElement('accuracy-' + domain, (stats.accuracy * 100).toFixed(1) + '%');
    });

    // Update generated timestamp
    updateElement('generatedAt', snapshot.generatedAt);

    // Update charts
    if (latencyTrendChart) {
      latencyTrendChart.data.labels = snapshot.trend.map(t => formatTimeLabel(t.slot));
      latencyTrendChart.data.datasets[0].data = snapshot.trend.map(t => t.p50);
      latencyTrendChart.data.datasets[1].data = snapshot.trend.map(t => t.p95);
      latencyTrendChart.data.datasets[2].data = snapshot.trend.map(t => t.p99);
      latencyTrendChart.update('none');
    }

    if (accuracyDomainChart) {
      const domains = Object.keys(snapshot.accuracyByDomain);
      accuracyDomainChart.data.datasets[0].data = domains.map(d => snapshot.accuracyByDomain[d].accuracy * 100);
      accuracyDomainChart.update('none');
    }

    if (fallbackChart) {
      const visualToText = snapshot.fallbackRates.visualToText * 100;
      const visualToOcr = snapshot.fallbackRates.visualToOcr * 100;
      const noFallback = Math.max(0, 100 - visualToText - visualToOcr);
      fallbackChart.data.datasets[0].data = [noFallback, visualToText, visualToOcr];
      fallbackChart.update('none');
    }

    // Update top queries list
    updateTopQueries(snapshot.topQueries);
  }

  /**
   * Update top queries list
   */
  function updateTopQueries(topQueries) {
    const container = document.getElementById('topQueriesList');
    if (!container) return;

    if (topQueries.length === 0) {
      container.innerHTML = '<div class="text-gray-400 text-center py-8">No queries recorded yet</div>';
      return;
    }

    container.innerHTML = topQueries.map((q) => `
      <div class="top-query-item" data-testid="${buildStableQueryTestId(q.query)}">
        <span class="query-text" title="${escapeHtml(q.query)}">${escapeHtml(q.query) || '&lt;empty&gt;'}</span>
        <span class="query-count">${q.count}</span>
      </div>
    `).join('');
  }

  /**
   * Build deterministic test IDs for top-query rows.
   */
  function buildStableQueryTestId(query) {
    const normalized = String(query || 'empty').trim().toLowerCase();
    const slug = normalized
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'empty';

    let hash = 0;
    for (let index = 0; index < normalized.length; index += 1) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(index);
      hash |= 0;
    }

    const suffix = Math.abs(hash).toString(36).slice(0, 6) || '0';
    return `top-query-${slug}-${suffix}`;
  }

  /**
   * Update DOM element safely
   */
  function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = value;
    }
  }

  /**
   * Format time label for chart
   */
  function formatTimeLabel(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Escape HTML for XSS prevention
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  /**
   * Connect to SSE stream for real-time updates
   */
  function connectSSE() {
    if (eventSource) {
      eventSource.close();
    }

    const windowHours = window.windowHours || 24;
    eventSource = new EventSource(`/api/analytics/visual-queries/stream?windowHours=${windowHours}`);

    eventSource.onmessage = function(event) {
      try {
        const snapshot = JSON.parse(event.data);
        updateDashboard(snapshot);
      } catch (error) {
        console.error('[Analytics] SSE parse error:', error);
      }
    };

    eventSource.onerror = function(error) {
      console.error('[Analytics] SSE connection error:', error);
      // Reconnect after 5 seconds
      setTimeout(connectSSE, 5000);
    };
  }

  /**
   * Export to CSV
   */
  function exportToCsv() {
    const windowHours = window.windowHours || 24;
    window.location.href = `/api/analytics/visual-queries/csv?windowHours=${windowHours}`;
  }

  /**
   * Handle window selection change
   */
  function handleWindowChange(event) {
    const newWindow = parseInt(event.target.value, 10);
    window.location.href = `/analytics/visual-queries?windowHours=${newWindow}`;
  }

  /**
   * Initialize dashboard
   */
  function init() {
    // Initialize charts with server-provided data
    if (window.analyticsSnapshot) {
      initCharts(window.analyticsSnapshot);
    }

    // Set up event listeners
    if (windowSelect) {
      windowSelect.addEventListener('change', handleWindowChange);
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', exportToCsv);
    }

    // Connect to SSE for real-time updates
    connectSSE();

    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
      if (eventSource) {
        eventSource.close();
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
