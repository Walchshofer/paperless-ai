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

    async checkStatus() {
        // Simulate response shape: { loadedModels: [...] }
        const loaded = Array.isArray(this.loadedModels) && this.loadedModels.length > 0
            ? this.loadedModels
            : (this.modelAvailable ? ['router-model'] : []);
        return { loadedModels: loaded };
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