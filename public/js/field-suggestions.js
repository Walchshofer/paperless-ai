/**
 * Field Suggestions Widget
 *
 * Displays AI-driven field suggestions in the workspace
 */

class FieldSuggestionsWidget {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = {
            maxSuggestions: options.maxSuggestions || 5,
            autoLoad: options.autoLoad !== false,
            onAccept: options.onAccept || null,
            ...options
        };

        this.currentSuggestions = [];
        this.documentId = null;
        this.domain = null;

        this.init();
    }

    init() {
        if (!this.container) {
            console.error(`[FieldSuggestions] Container #${this.containerId} not found`);
            return;
        }

        this.render();
    }

    async loadSuggestions(documentId, domain, extractedFields = []) {
        this.documentId = documentId;
        this.domain = domain;

        try {
            this.renderLoading();

            const queryParams = new URLSearchParams({
                domain,
                extractedFields: JSON.stringify(extractedFields),
                classificationConfidence: '0.85'
            });

            const response = await fetch(`/api/suggestions/${documentId}?${queryParams}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                this.currentSuggestions = result.data.suggestions || [];
                this.renderSuggestions(result.data);
            } else {
                throw new Error(result.error || 'Failed to load suggestions');
            }

        } catch (error) {
            console.error('[FieldSuggestions] Error loading suggestions:', error);
            this.renderError(error.message);
        }
    }

    async acceptSuggestion(fieldId, suggestionType) {
        try {
            const response = await fetch('/api/suggestions/accept', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    documentId: this.documentId,
                    fieldId,
                    suggestionType
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('[FieldSuggestions] Suggestion accepted:', {
                    fieldId,
                    acceptanceRate: result.data.acceptanceRate
                });

                // Remove accepted suggestion from UI
                this.removeSuggestion(fieldId);

                // Call user callback if provided
                if (typeof this.options.onAccept === 'function') {
                    this.options.onAccept(fieldId, result.data);
                }

                return true;
            } else {
                throw new Error(result.error || 'Failed to record acceptance');
            }

        } catch (error) {
            console.error('[FieldSuggestions] Error accepting suggestion:', error);
            return false;
        }
    }

    removeSuggestion(fieldId) {
        this.currentSuggestions = this.currentSuggestions.filter(s => s.fieldId !== fieldId);

        if (this.currentSuggestions.length === 0) {
            this.renderEmpty();
        } else {
            this.renderSuggestions({ suggestions: this.currentSuggestions });
        }
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="field-suggestions-widget bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-lightbulb text-yellow-500"></i>
                        <h3 class="font-['Space_Grotesk'] font-semibold text-sm">AI Suggestions</h3>
                    </div>
                    <button
                        id="${this.containerId}-refresh"
                        class="text-gray-400 hover:text-gray-600 text-xs"
                        title="Refresh suggestions"
                    >
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
                <div id="${this.containerId}-content" class="suggestions-content">
                    <p class="text-sm text-gray-500 text-center py-4">No suggestions available</p>
                </div>
            </div>
        `;

        // Attach refresh handler
        const refreshBtn = document.getElementById(`${this.containerId}-refresh`);
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (this.documentId && this.domain) {
                    this.loadSuggestions(this.documentId, this.domain);
                }
            });
        }
    }

    renderLoading() {
        const content = document.getElementById(`${this.containerId}-content`);
        if (!content) return;

        content.innerHTML = `
            <div class="animate-pulse space-y-3">
                <div class="h-16 bg-gray-100 rounded"></div>
                <div class="h-16 bg-gray-100 rounded"></div>
                <div class="h-16 bg-gray-100 rounded"></div>
            </div>
        `;
    }

    renderSuggestions(data) {
        const content = document.getElementById(`${this.containerId}-content`);
        if (!content) return;

        const suggestions = data.suggestions || [];

        if (suggestions.length === 0) {
            this.renderEmpty();
            return;
        }

        const suggestionsHTML = suggestions.slice(0, this.options.maxSuggestions).map(suggestion => {
            const typeIcons = {
                requiredMissing: 'fa-exclamation-circle text-red-500',
                relatedOptional: 'fa-puzzle-piece text-blue-500',
                commonPattern: 'fa-chart-line text-green-500',
                historical: 'fa-history text-purple-500'
            };

            const icon = typeIcons[suggestion.suggestionType] || 'fa-lightbulb text-yellow-500';
            const priorityClass = suggestion.priority >= 0.9 ? 'border-red-200 bg-red-50' :
                                  suggestion.priority >= 0.7 ? 'border-yellow-200 bg-yellow-50' :
                                  'border-gray-200 bg-gray-50';

            return `
                <div class="suggestion-card border ${priorityClass} rounded-lg p-3 mb-3" data-field-id="${suggestion.fieldId}">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <i class="fas ${icon} text-sm"></i>
                                <span class="font-['Space_Grotesk'] font-medium text-sm">
                                    ${this.escapeHtml(suggestion.fieldName.en || suggestion.fieldId)}
                                </span>
                                <span class="text-xs px-2 py-0.5 rounded bg-white text-gray-600">
                                    ${Math.round(suggestion.relevanceScore * 100)}%
                                </span>
                            </div>
                            <p class="text-xs text-gray-600 mb-2">${this.escapeHtml(suggestion.reason)}</p>
                            <div class="flex items-center gap-2">
                                <button
                                    class="accept-suggestion text-xs px-3 py-1 rounded bg-copper text-white hover:bg-[#a66429] transition-colors"
                                    data-field-id="${suggestion.fieldId}"
                                    data-suggestion-type="${suggestion.suggestionType}"
                                >
                                    <i class="fas fa-check mr-1"></i>
                                    Accept
                                </button>
                                <button
                                    class="dismiss-suggestion text-xs px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                                    data-field-id="${suggestion.fieldId}"
                                >
                                    <i class="fas fa-times mr-1"></i>
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        content.innerHTML = suggestionsHTML;

        // Attach event handlers
        this.attachSuggestionHandlers();
    }

    renderEmpty() {
        const content = document.getElementById(`${this.containerId}-content`);
        if (!content) return;

        content.innerHTML = `
            <div class="text-center py-6">
                <i class="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
                <p class="text-sm text-gray-600">All fields completed!</p>
                <p class="text-xs text-gray-400 mt-1">No suggestions at this time</p>
            </div>
        `;
    }

    renderError(message) {
        const content = document.getElementById(`${this.containerId}-content`);
        if (!content) return;

        content.innerHTML = `
            <div class="text-center py-6">
                <i class="fas fa-exclamation-triangle text-yellow-500 text-3xl mb-2"></i>
                <p class="text-sm text-gray-600">Failed to load suggestions</p>
                <p class="text-xs text-gray-400 mt-1">${this.escapeHtml(message)}</p>
            </div>
        `;
    }

    attachSuggestionHandlers() {
        // Accept buttons
        const acceptButtons = document.querySelectorAll('.accept-suggestion');
        acceptButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const fieldId = e.currentTarget.dataset.fieldId;
                const suggestionType = e.currentTarget.dataset.suggestionType;

                e.currentTarget.disabled = true;
                e.currentTarget.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Accepting...';

                const success = await this.acceptSuggestion(fieldId, suggestionType);

                if (!success) {
                    e.currentTarget.disabled = false;
                    e.currentTarget.innerHTML = '<i class="fas fa-check mr-1"></i>Accept';
                }
            });
        });

        // Dismiss buttons
        const dismissButtons = document.querySelectorAll('.dismiss-suggestion');
        dismissButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fieldId = e.currentTarget.dataset.fieldId;
                this.removeSuggestion(fieldId);
            });
        });
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldSuggestionsWidget;
}

// Also attach to window for direct use
if (typeof window !== 'undefined') {
    window.FieldSuggestionsWidget = FieldSuggestionsWidget;
}
