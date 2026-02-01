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
    window.modalManager = new ModalManager();
});
