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
    }

    async chat(request) {
        this.calls.push(request);

        if (this.shouldFail) {
            throw new Error(this.failureMessage);
        }

        const model = request.model;
        if (this.responses[model]) {
            return this.responses[model];
        }

        return this.defaultResponse;
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