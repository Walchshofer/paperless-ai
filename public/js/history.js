// Theme Management
class ThemeManager {
    constructor() {
        this.themeToggle = document.getElementById('themeToggle');
        this.initialize();
    }

    initialize() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
        this.themeToggle?.addEventListener('click', () => this.toggleTheme());
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        const icon = this.themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }
}

class HistoryManager {
    constructor() {
        this.confirmModal = document.getElementById('confirmModal');
        this.confirmModalAll = document.getElementById('confirmModalAll');
        this.selectAll = document.getElementById('selectAll');
        this.table = null; // Will be initialized in initializeDataTable
        this.initialize();
    }

    initialize() {
        this.table = this.initializeDataTable();
        this.initializeModals();
        this.initializeResetButtons();
        this.initializeFilters();
        this.initializeSelectAll();
        this.initializeVisualViewer();
    }

    initializeDataTable() {
        return $('#historyTable').DataTable({
            serverSide: true,
            processing: true,
            ajax: {
                url: '/api/history',
                data: (d) => {
                    d.tag = $('#tagFilter').val();
                    d.correspondent = $('#correspondentFilter').val();
                }
            },
            columns: [
                {
                    data: 'document_id',
                    render: (data) => `<input type="checkbox" class="doc-select rounded" value="${data}">`,
                    orderable: false,
                    width: '40px'
                },
                {
                    data: 'document_id',
                    width: '60px'
                },
                {
                    data: 'title',
                    render: (data, type, row) => {
                        if (type === 'display') {
                            return `
                                <div class="font-medium">${data}</div>
                                <div class="text-xs text-gray-500">Modified: ${new Date(row.created_at).toLocaleString()}</div>
                            `;
                        }
                        return data;
                    }
                },
                {
                    data: 'tags',
                    render: (data, type) => {
                        if (type === 'display') {
                            if (!data?.length) return '<span class="text-gray-400 text-sm">No tags</span>';
                            return data.map(tag =>
                                `<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs" data-tag-id="${tag.id}">${tag.name}</span>`
                            ).join(' ');
                        }
                        return data?.map(t => t.name).join(', ') || '';
                    }
                },
                { data: 'correspondent' },
                {
                    data: 'document_id',
                    title: 'Overlays',
                    render: (docId) => {
                        return `<span id="overlay-badge-${docId}" class="overlay-badges text-xs text-gray-400">Loading...</span>`;
                    },
                    orderable: false,
                    width: '120px'
                },
                {
                    data: null,
                    render: (data) => `
                        <div class="flex flex-wrap gap-2">
                            <button onclick="window.open('/history/doc/${data.document_id}', '_blank', 'noopener')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors" aria-label="View document" title="View document">
                                <i class="fa-solid fa-eye"></i>
                                <span class="hidden sm:inline ml-1">View</span>
                            </button>
                            <button onclick="window.historyManager.openVisualViewer(${data.document_id})" class="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors" aria-label="Visual Preview" title="Visual Preview with Overlays">
                                <i class="fa-solid fa-layer-group"></i>
                                <span class="hidden sm:inline ml-1">Visual</span>
                            </button>
                            <button onclick="window.open('/chat?open=${data.document_id}')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors" aria-label="Chat about document" title="Chat about document">
                                <i class="fa-solid fa-comment"></i>
                                <span class="hidden sm:inline ml-1">Chat</span>
                            </button>
                            <button onclick="window.historyManager.reanalyzeDocument(${data.document_id})" class="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors" aria-label="Re-analyse document" title="Re-analyse document">
                                <i class="fa-solid fa-arrows-rotate"></i>
                                <span class="hidden sm:inline ml-1">Re-analyse</span>
                            </button>
                        </div>
                    `,
                    orderable: false,
                    width: '280px'
                }
            ],
            order: [[2, 'desc']],
            pageLength: 10,
            dom: '<"flex flex-col sm:flex-row justify-between items-center mb-4"<"flex-1"f><"flex-none"l>>rtip',
            language: {
                search: "Search documents:",
                lengthMenu: "Show _MENU_ entries",
                info: "Showing _START_ to _END_ of _TOTAL_ documents",
                infoEmpty: "Showing 0 to 0 of 0 documents",
                infoFiltered: "(filtered from _MAX_ total documents)"
            },
            drawCallback: () => {
                // Update "Select All" checkbox state after table redraw
                this.updateSelectAllState();
                // Reattach event listeners to checkboxes
                this.attachCheckboxListeners();
                // Load overlay badges
                this.loadOverlayBadges();
            }
        });
    }

    initializeModals() {
        // Modal close handlers
        [this.confirmModal, this.confirmModalAll].forEach(modal => {
            if (!modal) return;
            
            // Close on overlay click
            modal.querySelector('.modal-overlay')?.addEventListener('click', () => {
                this.hideModal(modal);
            });

            // Close on X button click
            modal.querySelector('.modal-close')?.addEventListener('click', () => {
                this.hideModal(modal);
            });

            // Close on Cancel button click
            modal.querySelector('[id^="cancel"]')?.addEventListener('click', () => {
                this.hideModal(modal);
            });
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal(this.confirmModal);
                this.hideModal(this.confirmModalAll);
            }
        });

        // Reset action handlers
        document.getElementById('confirmReset')?.addEventListener('click', async () => {
            const selectedDocs = this.getSelectedDocuments();
            const success = await this.resetDocuments(selectedDocs);
            if (success) {
                this.hideModal(this.confirmModal);
            }
        });

        document.getElementById('confirmResetAll')?.addEventListener('click', async () => {
            const success = await this.resetAllDocuments();
            if (success) {
                this.hideModal(this.confirmModalAll);
            }
        });
    }

    initializeResetButtons() {
        // Reset Selected button
        document.getElementById('resetSelectedBtn')?.addEventListener('click', () => {
            const selectedDocs = this.getSelectedDocuments();
            if (selectedDocs.length === 0) {
                alert('Please select at least one document to reset.');
                return;
            }
            this.showModal(this.confirmModal);
        });

        // Reset All button
        document.getElementById('resetAllBtn')?.addEventListener('click', () => {
            this.showModal(this.confirmModalAll);
        });
    }

    initializeFilters() {
        $('#tagFilter, #correspondentFilter').on('change', () => {
            this.table.ajax.reload();
        });
    }

    initializeSelectAll() {
        if (!this.selectAll) return;

        // Handle "Select All" checkbox
        this.selectAll.addEventListener('change', () => {
            const isChecked = this.selectAll.checked;
            const checkboxes = document.querySelectorAll('.doc-select');
            checkboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        });

        // Initial state check
        this.updateSelectAllState();
    }

    attachCheckboxListeners() {
        const checkboxes = document.querySelectorAll('.doc-select');
        checkboxes.forEach(checkbox => {
            // Remove existing listeners to prevent duplicates
            checkbox.removeEventListener('change', this.handleCheckboxChange);
            // Add new listener
            checkbox.addEventListener('change', () => this.handleCheckboxChange());
        });
    }

    handleCheckboxChange() {
        this.updateSelectAllState();
    }

    updateSelectAllState() {
        if (!this.selectAll) return;

        const checkboxes = document.querySelectorAll('.doc-select');
        const checkedBoxes = document.querySelectorAll('.doc-select:checked');
        
        // Update "Select All" checkbox state
        this.selectAll.checked = checkboxes.length > 0 && checkboxes.length === checkedBoxes.length;
        
        // Update indeterminate state
        this.selectAll.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < checkboxes.length;
    }

    showModal(modal) {
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }
    }

    hideModal(modal) {
        if (modal) {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        }
    }

    getSelectedDocuments() {
        return Array.from(document.querySelectorAll('.doc-select:checked'))     
            .map(checkbox => checkbox.value);
    }

    async reanalyzeDocument(documentId) {
        if (!documentId) return;
        const confirmed = confirm('Re-analyse this document? It will be treated as new.');
        if (!confirmed) return;

        try {
            const response = await fetch(`/api/history/reanalyze/${documentId}`, {
                method: 'POST'
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload.error || 'Failed to queue re-analysis');
            }

            alert(payload.message || 'Document queued for re-analysis.');
            if (this.table) {
                await this.table.ajax.reload(null, false);
            }
        } catch (error) {
            console.error('Error re-analysing document:', error);
            alert('Failed to re-analyse document. Please try again.');
        }
    }

    async resetDocuments(ids) {
        try {
            const response = await fetch('/api/reset-documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            if (!response.ok) {
                throw new Error('Failed to reset documents');
            }

            await this.table.ajax.reload();
            return true;
        } catch (error) {
            console.error('Error resetting documents:', error);
            alert('Failed to reset documents. Please try again.');
            return false;
        }
    }

    async resetAllDocuments() {
        try {
            const response = await fetch('/api/reset-all-documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error('Failed to reset all documents');
            }

            await this.table.ajax.reload();
            return true;
        } catch (error) {
            console.error('Error resetting all documents:', error);
            alert('Failed to reset all documents. Please try again.');
            return false;
        }
    }

    // Overlay badge helpers
    getDomainColor(domain) {
        const colors = {
            FINANCIAL: '#F97316',
            MEDICAL: '#22C55E',
            LEGAL: '#A855F7',
            GENERAL: '#3B82F6'
        };
        return colors[domain] || '#6B7280';
    }

    getDomainIcon(domain) {
        const icons = {
            FINANCIAL: '&#x1F7E7;',
            MEDICAL: '&#x1F7E9;',
            LEGAL: '&#x1F7EA;',
            GENERAL: '&#x1F7E6;'
        };
        return icons[domain] || '&#x1F4C4;';
    }

    async loadOverlayBadges() {
        const badges = document.querySelectorAll('[id^="overlay-badge-"]');

        for (const badge of badges) {
            const docId = badge.id.replace('overlay-badge-', '');

            try {
                const response = await fetch(`/api/visual-rag/overlays/${docId}`);
                if (!response.ok) {
                    badge.innerHTML = '<span class="text-gray-400">-</span>';
                    continue;
                }

                const { overlays, count } = await response.json();

                if (count === 0) {
                    badge.innerHTML = '<span class="text-gray-400">None</span>';
                    continue;
                }

                // Group by domain
                const domainCounts = {};
                let mandatoryCount = 0;
                overlays.forEach(o => {
                    const d = o.domain || 'GENERAL';
                    domainCounts[d] = (domainCounts[d] || 0) + 1;
                    if (o.isMandatory) mandatoryCount++;
                });

                // Build badge HTML
                let html = Object.entries(domainCounts).map(([domain, cnt]) => {
                    const color = this.getDomainColor(domain);
                    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mr-1"
                                  style="background-color: ${color}20; color: ${color}">
                        ${this.getDomainIcon(domain)} ${cnt}
                    </span>`;
                }).join('');

                if (mandatoryCount > 0) {
                    html += `<span class="text-orange-500 text-xs" title="${mandatoryCount} mandatory">*${mandatoryCount}</span>`;
                }

                badge.innerHTML = html;
            } catch (e) {
                badge.innerHTML = '<span class="text-gray-400">-</span>';
            }
        }
    }

    // Visual Viewer Modal
    async openVisualViewer(docId) {
        const modal = document.getElementById('visualViewerModal');
        const container = document.getElementById('historyOverlayContainer');
        const loading = document.getElementById('historyOverlayLoading');
        const pageNav = document.getElementById('historyPageNav');

        if (!modal) return;

        // Show modal
        modal.classList.remove('hidden');
        modal.classList.add('show');

        // Reset loading state
        container.innerHTML = '';
        container.appendChild(loading);
        loading.classList.remove('hidden');

        // Store current doc in the class
        this.visualDocId = docId;
        this.visualCurrentPage = 1;
        this.visualTotalPages = 1;

        try {
            // Get page count first
            const infoRes = await fetch(`/api/document/${docId}/page-count`);
            if (infoRes.ok) {
                const info = await infoRes.json();
                this.visualTotalPages = info.pageCount || 1;
            }

            // Load first page
            await this.loadVisualPage(docId, 1);
            this.updateVisualPageNav();

        } catch (error) {
            console.error('Failed to load visual viewer:', error);
            loading.classList.add('hidden');
            container.innerHTML = `<div class="text-center text-red-500 py-8">Failed to load visual preview: ${error.message}</div>`;
        }
    }

    async loadVisualPage(docId, page) {
        const container = document.getElementById('historyOverlayContainer');
        const loading = document.getElementById('historyOverlayLoading');
        const legendContainer = document.getElementById('historyLegendContainer');
        const statsEl = document.getElementById('historyOverlayStats');

        loading.classList.remove('hidden');

        try {
            // Render high-res image
            const renderRes = await fetch(`/api/document/${docId}/render?page=${page}&dpi=300`);
            if (!renderRes.ok) throw new Error('Failed to render page');

            const renderData = await renderRes.json();

            // Create image from base64
            const img = new Image();
            img.src = `data:image/png;base64,${renderData.image}`;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('Failed to load rendered image'));
            });

            // Update total pages if provided
            if (renderData.totalPages) {
                this.visualTotalPages = renderData.totalPages;
            }

            // Fetch overlays for this page
            const overlayRes = await fetch(`/api/visual-rag/overlays/${docId}?page=${page}`);
            const data = await overlayRes.json();

            loading.classList.add('hidden');

            // Clear container and add image
            container.innerHTML = '';
            container.appendChild(img);

            // Initialize overlay viewer
            if (this.historyOverlayViewer) {
                this.historyOverlayViewer.destroy();
            }

            this.historyOverlayViewer = new OverlayViewer(container, {
                onOverlayClick: (overlay) => {
                    console.log('Clicked overlay:', overlay);
                },
                onOverlayHover: (overlay) => {
                    if (overlay && this.historyOverlayLegend) {
                        this.historyOverlayLegend.highlightField(overlay.label.toLowerCase().replace(/\s+/g, '_'));
                    } else if (this.historyOverlayLegend) {
                        this.historyOverlayLegend.clearHighlights();
                    }
                }
            });

            this.historyOverlayViewer.setImage(img);

            if (data.overlays && data.overlays.length > 0) {
                const domain = data.overlays[0]?.domain || 'GENERAL';
                this.historyOverlayViewer.setOverlays(data.overlays, domain);

                // Initialize legend
                if (this.historyOverlayLegend) {
                    this.historyOverlayLegend.destroy();
                }
                this.historyOverlayLegend = new OverlayLegend(legendContainer, {
                    domain: domain,
                    onFilterChange: ({ mandatoryOnly }) => {
                        this.historyOverlayViewer.toggleMandatoryOnly(mandatoryOnly);
                    }
                });

                // Show stats
                const stats = this.historyOverlayViewer.getStats();
                document.getElementById('historyOverlayCount').textContent = stats.total;
                statsEl.classList.remove('hidden');
            } else {
                legendContainer.innerHTML = '';
                statsEl.classList.add('hidden');
            }
        } catch (error) {
            console.error('Failed to load page:', error);
            loading.classList.add('hidden');
            container.innerHTML = `<div class="text-center text-red-500 py-8">Failed to load page: ${error.message}</div>`;
        }
    }

    updateVisualPageNav() {
        const pageNav = document.getElementById('historyPageNav');
        const pageIndicator = document.getElementById('historyPageIndicator');
        const prevBtn = document.getElementById('historyPrevPage');
        const nextBtn = document.getElementById('historyNextPage');

        if (this.visualTotalPages > 1) {
            pageNav.classList.remove('hidden');
            pageIndicator.textContent = `Page ${this.visualCurrentPage} of ${this.visualTotalPages}`;
            prevBtn.disabled = this.visualCurrentPage <= 1;
            nextBtn.disabled = this.visualCurrentPage >= this.visualTotalPages;
        } else {
            pageNav.classList.add('hidden');
        }
    }

    closeVisualViewer() {
        const modal = document.getElementById('visualViewerModal');
        if (modal) {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        }

        if (this.historyOverlayViewer) {
            this.historyOverlayViewer.destroy();
            this.historyOverlayViewer = null;
        }
        if (this.historyOverlayLegend) {
            this.historyOverlayLegend.destroy();
            this.historyOverlayLegend = null;
        }
    }

    initializeVisualViewer() {
        // Close button
        document.getElementById('closeVisualModal')?.addEventListener('click', () => {
            this.closeVisualViewer();
        });

        // Close on clicking outside modal
        document.getElementById('visualViewerModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'visualViewerModal') {
                this.closeVisualViewer();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeVisualViewer();
            }
        });

        // Page navigation
        document.getElementById('historyPrevPage')?.addEventListener('click', async () => {
            if (this.visualCurrentPage > 1 && this.visualDocId) {
                this.visualCurrentPage--;
                await this.loadVisualPage(this.visualDocId, this.visualCurrentPage);
                this.updateVisualPageNav();
            }
        });

        document.getElementById('historyNextPage')?.addEventListener('click', async () => {
            if (this.visualCurrentPage < this.visualTotalPages && this.visualDocId) {
                this.visualCurrentPage++;
                await this.loadVisualPage(this.visualDocId, this.visualCurrentPage);
                this.updateVisualPageNav();
            }
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
    window.historyManager = new HistoryManager();
});
