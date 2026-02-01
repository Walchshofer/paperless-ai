// Chart Initialization
class ChartManager {
    constructor() {
        this.chart = null;
        this.pollInterval = 30000; // 30s default
        this.initializeDocumentChart();
        // Start polling for updates
        this.startPolling();
    }

    async fetchMetrics() {
        try {
            const resp = await fetch('/api/dashboard/metrics');
            if (!resp.ok) throw new Error('Failed to fetch metrics');
            return await resp.json();
        } catch (err) {
            console.warn('[ChartManager] fetchMetrics failed', err);
            return null;
        }
    }

    async initializeDocumentChart() {
        // 1. Immediately render using window.dashboardData (snapshot)
        const localData = window.dashboardData || null;
        if (localData) {
            const { documentCount, processedCount } = localData;
            this.renderOrUpdateChart(processedCount, Math.max(0, documentCount - processedCount));
        }

        // 2. Fetch API to check for newer data
        await this.reconcileMetrics(localData);
    }

    async reconcileMetrics(localData) {
        const apiResponse = await this.fetchMetrics();
        if (!apiResponse || !apiResponse.metrics) return;

        const apiTimestamp = new Date(apiResponse.timestamp).getTime();
        const localTimestamp = localData && localData.lastUpdated ? new Date(localData.lastUpdated).getTime() : 0;

        // If API is newer (or we had no local data), update
        if (!localData || apiTimestamp > localTimestamp) {
            console.log('[ChartManager] Syncing dashboard with newer API data:', apiResponse.timestamp);
            const { documentCount, processedDocumentCount } = apiResponse.metrics;
            this.renderOrUpdateChart(processedDocumentCount, Math.max(0, documentCount - processedDocumentCount));
            
            // Update local snapshot
            window.dashboardData = {
                ...(window.dashboardData || {}),
                lastUpdated: apiResponse.timestamp,
                documentCount,
                processedCount: processedDocumentCount
            };
        }
    }

    renderOrUpdateChart(processedCount, unprocessedCount) {
        const canvas = document.getElementById('documentChart');
        if (!canvas) return;

        // If chart exists, update it
        if (this.chart) {
            this.chart.data.datasets[0].data = [processedCount, unprocessedCount];
            this.chart.update();
            return;
        }

        // Create new chart
        const ctx = canvas.getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Local Processed', 'Pending'],
                datasets: [{
                    data: [processedCount, unprocessedCount],
                    backgroundColor: [
                        '#3b82f6',  // blue-500
                        '#e2e8f0'   // gray-200
                    ],
                    borderWidth: 0,
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = Number(context.raw || 0);
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                                return `${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    async pollAndUpdate() {
        // Poll logic now reuses reconciliation
        await this.reconcileMetrics(window.dashboardData);
    }

    startPolling() {
        this.pollTimer = setInterval(() => this.pollAndUpdate(), this.pollInterval);
    }

    stopPolling() {
        if (this.pollTimer) clearInterval(this.pollTimer);
    }
}


// Modal Management
class ModalManager {
    constructor() {
        this.modal = document.getElementById('detailsModal');
        if (!this.modal) return;
        
        this.modalTitle = this.modal.querySelector('.modal-title');
        this.modalContent = this.modal.querySelector('.modal-data');
        this.modalLoader = this.modal.querySelector('.modal-loader');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Close button click
        const closeBtn = this.modal.querySelector('.modal-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.hideModal());
        
        // Overlay click
        const overlay = this.modal.querySelector('.modal-overlay');
        if (overlay) overlay.addEventListener('click', () => this.hideModal());
        
        // Escape key press
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.hideModal();
            }
        });
    }

    showModal(title) {
        this.modalTitle.textContent = title;
        this.modalContent.innerHTML = '';
        this.modal.classList.remove('hidden');
        this.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        this.modal.classList.remove('show');
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    showLoader() {
        this.modalLoader.classList.remove('hidden');
        this.modalContent.classList.add('hidden');
    }

    hideLoader() {
        this.modalLoader.classList.add('hidden');
        this.modalContent.classList.remove('hidden');
    }

    setContent(content) {
        this.modalContent.innerHTML = content;
    }
}

// Make showTagDetails and showCorrespondentDetails globally available
window.showTagDetails = async function() {
    if (!window.modalManager) return;
    
    window.modalManager.showModal('Tag Overview');
    window.modalManager.showLoader();

    try {
        const response = await fetch('/api/tagsCount');
        const tags = await response.json();

        let content = '<div class="detail-list">';
        tags.forEach(tag => {
            content += `
                <div class="detail-item">
                    <span class="detail-item-name">${tag.name}</span>
                    <span class="detail-item-info">${tag.document_count || 0} documents</span>
                </div>
            `;
        });
        content += '</div>';

        window.modalManager.setContent(content);
    } catch (error) {
        console.error('Error loading tags:', error);
        window.modalManager.setContent('<div class="text-red-500 p-4">Error loading tags. Please try again later.</div>');
    } finally {
        window.modalManager.hideLoader();
    }
}

window.showCorrespondentDetails = async function() {
    if (!window.modalManager) return;

    window.modalManager.showModal('Correspondent Overview');
    window.modalManager.showLoader();

    try {
        const response = await fetch('/api/correspondentsCount');
        const correspondents = await response.json();

        let content = '<div class="detail-list">';
        correspondents.forEach(correspondent => {
            content += `
                <div class="detail-item">
                    <span class="detail-item-name">${correspondent.name}</span>
                    <span class="detail-item-info">${correspondent.document_count || 0} documents</span>
                </div>
            `;
        });
        content += '</div>';

        window.modalManager.setContent(content);
    } catch (error) {
        console.error('Error loading correspondents:', error);
        window.modalManager.setContent('<div class="text-red-500 p-4">Error loading correspondents. Please try again later.</div>');
    } finally {
        window.modalManager.hideLoader();
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Theme and Navigation are now handled by shared-utilities.js
    window.chartManager = new ChartManager();
    window.modalManager = new ModalManager();
});
