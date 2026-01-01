/**
 * Mock services for testing
 */

/**
 * Mock Ollama Service for testing
 */
class MockOllamaService {
    constructor(options = {}) {
        this.responses = options.responses || {};
        this.calls = [];
        this.defaultResponse = options.defaultResponse || {
            message: {
                content: JSON.stringify({
                    primary_domain: 'General',
                    document_type: 'correspondence',
                    confidence: 0.85
                })
            }
        };
        this.shouldFail = options.shouldFail || false;
        this.failureMessage = options.failureMessage || 'Mock failure';
        this.modelAvailable = options.modelAvailable !== undefined ? options.modelAvailable : true;
        this.loadedModels = options.loadedModels || [];
        this.retryAttempts = 0;
        this.failUntilAttempt = options.failUntilAttempt || 0;
    }

    async chat(request) {
        this.calls.push(request);

        this.retryAttempts += 1;
        if (this.failUntilAttempt && this.retryAttempts <= this.failUntilAttempt) {
            const err = new Error('ECONNREFUSED: Connection refused');
            err.code = 'ECONNREFUSED';
            throw err;
        }

        if (this.shouldFail) {
            throw new Error(this.failureMessage);
        }

        const model = request.model;
        if (this.responses[model]) {
            return this.responses[model];
        }

        return this.defaultResponse;
    }

    async analyzeDocument(content, existingTags = [], existingCorrespondentList = [], existingDocumentTypesList = [], id, customPrompt = null, options = {}) {
        this.calls.push({ method: 'analyzeDocument', content, id, options });

        if (this.shouldFail) {
            throw new Error(this.failureMessage);
        }

        return {
            document: {
                title: 'Mock Document',
                correspondent: 'Mock Correspondent',
                tags: (existingTags || []).slice(0, 2),
                document_type: (existingDocumentTypesList && existingDocumentTypesList[0]) || 'correspondence',
                document_date: new Date().toISOString().split('T')[0],
                language: 'en',
                custom_fields: {}
            },
            metrics: {
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
                processingTime: '0.5'
            },
            confidence: 0.75
        };
    }

    async checkStatus() {
        // Simulate response shape: { loadedModels: [...] }
        const loaded = Array.isArray(this.loadedModels) && this.loadedModels.length > 0
            ? this.loadedModels
            : (this.modelAvailable ? ['router-model'] : []);
        return { loadedModels: loaded };
    }

    async analyzeDocumentWithVision(documentId, content, options = {}) {
        this.calls.push({ method: 'analyzeDocumentWithVision', documentId, content, options });

        if (this.shouldFail) {
            throw new Error(this.failureMessage);
        }

        return {
            document: {
                title: 'Mock Vision Document',
                correspondent: 'Mock Vision Correspondent',
                tags: (options.existingTags || []).slice(0, 2),
                document_type: (options.existingDocumentTypesList && options.existingDocumentTypesList[0]) || 'correspondence',
                document_date: new Date().toISOString().split('T')[0],
                language: 'en',
                custom_fields: {}
            },
            metrics: {
                promptTokens: 150,
                completionTokens: 75,
                totalTokens: 225,
                processingTime: '1.2'
            },
            confidence: 0.8,
            visual: true
        };
    }

    getCallCount() {
        return this.calls.length;
    }

    getLastCall() {
        return this.calls[this.calls.length - 1];
    }

    reset() {
        this.calls = [];
    }
}

module.exports = {
    MockOllamaService
};