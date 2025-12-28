/**
 * FeedbackForm.js
 *
 * Client-side component for handling extraction feedback submission.
 * Works with the feedback-modal.ejs partial.
 *
 * Usage:
 *   feedbackForm.show({ documentId: '123', pipelineId: 'PIPELINE_FINANCIAL_V1' });
 */

(function() {
    class FeedbackForm {
        constructor() {
            this.modal = null;
            this.rating = 0;
            this.corrections = new Set();
            this.documentId = null;
            this.pipelineId = null;
            this.isSubmitting = false;

            this.ratingLabels = {
                1: 'Poor - Many errors',
                2: 'Fair - Some errors',
                3: 'Good - Minor issues',
                4: 'Very Good - Mostly accurate',
                5: 'Excellent - Perfect extraction'
            };

            // Initialize when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this._init());
            } else {
                this._init();
            }
        }

        _init() {
            this.modal = document.getElementById('feedback-modal');
            if (!this.modal) {
                console.warn('[FeedbackForm] Modal element not found');
                return;
            }

            this._bindEvents();
        }

        _bindEvents() {
            // Star rating clicks
            const stars = this.modal.querySelectorAll('.feedback-star');
            stars.forEach(star => {
                star.addEventListener('click', (e) => this._handleStarClick(e));
                star.addEventListener('mouseenter', (e) => this._handleStarHover(e));
            });

            // Star container mouse leave - reset to selected state
            const starsContainer = document.getElementById('feedback-stars');
            if (starsContainer) {
                starsContainer.addEventListener('mouseleave', () => this._updateStarDisplay());
            }

            // Correction chip clicks
            const chips = this.modal.querySelectorAll('.correction-chip');
            chips.forEach(chip => {
                chip.addEventListener('click', (e) => this._handleChipClick(e));
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                    this.hide();
                }
            });
        }

        _handleStarClick(e) {
            const btn = e.currentTarget;
            this.rating = parseInt(btn.dataset.rating, 10);
            this._updateStarDisplay();
            this._updateSubmitButton();
        }

        _handleStarHover(e) {
            const btn = e.currentTarget;
            const hoverRating = parseInt(btn.dataset.rating, 10);
            this._highlightStars(hoverRating);
        }

        _highlightStars(upTo) {
            const stars = this.modal.querySelectorAll('.feedback-star');
            stars.forEach(star => {
                const rating = parseInt(star.dataset.rating, 10);
                if (rating <= upTo) {
                    star.classList.add('active');
                } else {
                    star.classList.remove('active');
                }
            });
        }

        _updateStarDisplay() {
            this._highlightStars(this.rating);

            const label = document.getElementById('feedback-rating-label');
            if (label) {
                label.textContent = this.rating > 0
                    ? this.ratingLabels[this.rating]
                    : 'Click to rate';
            }
        }

        _handleChipClick(e) {
            const chip = e.currentTarget;
            const field = chip.dataset.field;

            if (this.corrections.has(field)) {
                this.corrections.delete(field);
                chip.classList.remove('active');
            } else {
                this.corrections.add(field);
                chip.classList.add('active');
            }
        }

        _updateSubmitButton() {
            const btn = document.getElementById('feedback-submit-btn');
            if (btn) {
                btn.disabled = this.rating === 0 || this.isSubmitting;
            }
        }

        _reset() {
            this.rating = 0;
            this.corrections.clear();
            this.documentId = null;
            this.pipelineId = null;
            this.isSubmitting = false;

            // Reset UI
            const stars = this.modal.querySelectorAll('.feedback-star');
            stars.forEach(star => star.classList.remove('active'));

            const chips = this.modal.querySelectorAll('.correction-chip');
            chips.forEach(chip => chip.classList.remove('active'));

            const comments = document.getElementById('feedback-comments');
            if (comments) comments.value = '';

            const label = document.getElementById('feedback-rating-label');
            if (label) label.textContent = 'Click to rate';

            // Hide success state
            const successEl = document.getElementById('feedback-success');
            if (successEl) successEl.classList.add('hidden');

            this._updateSubmitButton();
        }

        /**
         * Show the feedback modal
         * @param {Object} options - { documentId, pipelineId }
         */
        show(options = {}) {
            if (!this.modal) {
                console.error('[FeedbackForm] Modal not initialized');
                return;
            }

            this._reset();

            this.documentId = options.documentId || null;
            this.pipelineId = options.pipelineId || null;

            // Store in hidden fields
            const docIdField = document.getElementById('feedback-document-id');
            const pipelineField = document.getElementById('feedback-pipeline-id');
            if (docIdField) docIdField.value = this.documentId || '';
            if (pipelineField) pipelineField.value = this.pipelineId || '';

            // Show modal
            this.modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';

            // Focus first star for accessibility
            const firstStar = this.modal.querySelector('.feedback-star');
            if (firstStar) firstStar.focus();
        }

        /**
         * Hide the feedback modal
         */
        hide() {
            if (!this.modal) return;

            this.modal.classList.add('hidden');
            document.body.style.overflow = '';
        }

        /**
         * Submit feedback to the API
         */
        async submit() {
            if (this.rating === 0 || this.isSubmitting) return;

            this.isSubmitting = true;
            this._updateSubmitButton();

            const btn = document.getElementById('feedback-submit-btn');
            const originalText = btn ? btn.innerHTML : '';
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Submitting...';
            }

            try {
                const comments = document.getElementById('feedback-comments');

                const payload = {
                    documentId: this.documentId,
                    pipelineId: this.pipelineId,
                    rating: this.rating,
                    accuracyScore: this.rating / 5,
                    corrections: Array.from(this.corrections),
                    comments: comments ? comments.value.trim() : ''
                };

                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    // Show success state
                    const successEl = document.getElementById('feedback-success');
                    if (successEl) {
                        successEl.classList.remove('hidden');
                    }

                    // Dispatch custom event for analytics
                    window.dispatchEvent(new CustomEvent('feedbackSubmitted', {
                        detail: { documentId: this.documentId, rating: this.rating }
                    }));

                } else {
                    throw new Error(result.error || 'Failed to submit feedback');
                }

            } catch (error) {
                console.error('[FeedbackForm] Submit error:', error);

                // Show error notification
                if (window.showToast) {
                    window.showToast('Failed to submit feedback. Please try again.', 'error');
                } else {
                    alert('Failed to submit feedback. Please try again.');
                }

                // Restore button
                if (btn) btn.innerHTML = originalText;
                this.isSubmitting = false;
                this._updateSubmitButton();
            }
        }
    }

    // Create global instance
    window.feedbackForm = new FeedbackForm();
})();
