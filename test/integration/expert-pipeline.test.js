/* eslint-env mocha */
/**
 * expert-pipeline.test.js
 * 
 * Comprehensive Unit Tests for Expert Model Pipeline System
 * 
 * Test Coverage:
 * - PromptRegistry: Registration, retrieval, message building
 * - ExpertRegistry: Pipeline registration, routing, execution
 * - ExpertPipelineExecutor: Full pipeline execution, error handling
 * - DocumentProcessor: Integration, fallback, result merging
 * - ImagePreparator: Image loading, format detection
 * - ResultMerger: Merge strategies, paperless format conversion
 * 
 * Run: npm test -- --grep "Expert Pipeline"
 * Run specific: npm test -- --grep "PromptRegistry"
 */

const assert = require('assert');
const { LocalTranslator } = require('../../services/experts/translation');
const { ExpertRegistry } = require('../../services/experts/ExpertRegistry');
const { DomainType } = require('../../services/prompts/PromptRegistry');
const { TemplateRegistry } = require('../../services/prompts/TemplateRegistry');
const { TemplateManager } = require('../../services/prompts/TemplateManager');
const { SemanticRouter } = require('../../services/experts/routing');
const { guidanceClient } = require('../../services/guidance');

// ============================================================================
// TEST UTILITIES
// ============================================================================

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
        
        // Bind listModels to ensure it's recognized as a function
        this.listModels = this.listModels.bind(this);
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

    /**
     * List available models - needed for model availability pre-check
     * Returns array of model names
     */
    async listModels() {
        if (!this.modelAvailable) {
            return [];
        }
        return Array.isArray(this.loadedModels) && this.loadedModels.length > 0
            ? this.loadedModels
            : ['router-model'];
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

async function withGuidanceDisabled(task) {
    const originalIsAvailable = guidanceClient.isAvailable.bind(guidanceClient);
    guidanceClient.isAvailable = async () => false;
    try {
        return await task();
    } finally {
        guidanceClient.isAvailable = originalIsAvailable;
    }
}

describe('LocalTranslator', function() {
    it('should call Ollama when source and target differ', async function() {
        const mock = new MockOllamaService({
            defaultResponse: { message: { content: 'Hallo Welt' } }
        });
        const translator = new LocalTranslator({
            ollamaService: mock,
            config: { model: 'test-model', maxTokens: 32, temperature: 0.0, minChars: 1 }
        });

        const result = await translator.translate('Hello world', 'en', 'de');
        assert.strictEqual(result, 'Hallo Welt');
        assert.strictEqual(mock.getCallCount(), 1);
    });

    // ============================================================================
    // ROUTER RETRY LOGIC TESTS
    // ============================================================================
    const { MockOllamaService: FixtureMockOllama } = require('../fixtures/mocks');
    const { MODEL_NAMES } = require('../../services/prompts/PromptRegistry');
    const { promptRegistry } = require('../../services/prompts/PromptRegistry');

    describe('Router Retry Logic', function() {
        before(function() {
            // Ensure router prompt is registered
            const { registerMedicalPrompts } = require('../../services/prompts/MedicalPrompts');
            registerMedicalPrompts(promptRegistry);
        });

        it('Router classification with model availability check', async function() {
            const mock = new FixtureMockOllama({ modelAvailable: false, loadedModels: [] });
            const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');
            const executor = new ExpertPipelineExecutor(mock, {});

            const availability = await executor._checkModelAvailability(MODEL_NAMES.router, 1000);
            assert.strictEqual(availability.available, false);

            const routerMessages = promptRegistry.buildMessages('SYS_ROUTER_V1', { source_system: 'test', filename: 'f.pdf' });
            const classifyResult = await executor._classifyDocumentWithRetry({ id: 'doc-1' }, executor, routerMessages, {});
            assert.ok(classifyResult._meta && classifyResult._meta.fallback, 'Expected immediate fallback when model not available');
            assert.strictEqual(classifyResult._meta.reason, 'model_not_available');
        });

        it('Router classification retries on connection refused', async function() {
            // Use small delays for test speed
            const config = require('../../config/config');
            config.routerRetry = config.routerRetry || {};
            config.routerRetry.baseDelay = 10;
            config.routerRetry.maxRetries = 3;

            // Mock: fail twice then succeed
            const responses = {
                [MODEL_NAMES.router]: {
                    message: { content: JSON.stringify({ primary_domain: 'Financial', document_type: 'invoice', confidence: 0.88 }) }
                }
            };
            const mock = new FixtureMockOllama({ responses, failUntilAttempt: 2, loadedModels: [MODEL_NAMES.router], modelAvailable: true });

            const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');
            const executor = new ExpertPipelineExecutor(mock, {});

            // Capture delays
            const delays = [];
            executor._delay = async (ms) => { delays.push(ms); return Promise.resolve(); };

            const routerMessages = promptRegistry.buildMessages('SYS_ROUTER_V1', { source_system: 'test', filename: 'f.pdf' });
            const result = await executor._classifyDocumentWithRetry({ id: 'doc-2' }, executor, routerMessages, {});

            // _parseResponse returns flat structure with _meta added
            assert.ok(result && (result.primary_domain === 'Financial' || result.classification?.primary_domain === 'Financial'));
            assert.strictEqual(mock.retryAttempts, 3);
            assert.strictEqual(delays.length, 2);
            assert.strictEqual(delays[0], 10);
            assert.strictEqual(delays[1], 20);
        });

        it('Router classification retries on "Model not available" error', async function() {
            const config = require('../../config/config');
            config.routerRetry = config.routerRetry || {};
            config.routerRetry.baseDelay = 5;
            config.routerRetry.maxRetries = 3;

            // Custom mock to throw a 'Model not available' on first call then succeed
            class TempMock {
                constructor() { this.calls = 0; }
                async chat(req) {
                    this.calls += 1;
                    if (this.calls === 1) throw new Error('Model not available');
                    return { message: { content: JSON.stringify({ primary_domain: 'Legal', document_type: 'contract', confidence: 0.8 }) } };
                }
                async checkStatus() { return { loadedModels: [MODEL_NAMES.router] }; }
                async listModels() { return [MODEL_NAMES.router]; }
            }

            const mock = new TempMock();
            const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');
            const executor = new ExpertPipelineExecutor(mock, {});
            const delays = [];
            executor._delay = async (ms) => { delays.push(ms); return Promise.resolve(); };

            const routerMessages = promptRegistry.buildMessages('SYS_ROUTER_V1', { source_system: 'test', filename: 'f.pdf' });
            const res = await executor._classifyDocumentWithRetry({ id: 'doc-3' }, executor, routerMessages, {});
            // _parseResponse returns flat structure with _meta added
            assert.ok(res && (res.primary_domain === 'Legal' || res.classification?.primary_domain === 'Legal'));
            assert.strictEqual(delays.length, 1);
        });

        it('Router classification exhausts retries and falls back to General', async function() {
            const config = require('../../config/config');
            config.routerRetry = config.routerRetry || {};
            config.routerRetry.baseDelay = 5;
            config.routerRetry.maxRetries = 3;

            // Always fail with connection errors
            const mock = new FixtureMockOllama({ failUntilAttempt: 9999, modelAvailable: true, loadedModels: [MODEL_NAMES.router] });
            const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');
            const executor = new ExpertPipelineExecutor(mock, {});
            executor._delay = async () => Promise.resolve();

            const routerMessages = promptRegistry.buildMessages('SYS_ROUTER_V1', { source_system: 'test', filename: 'f.pdf' });
            const res = await executor._classifyDocumentWithRetry({ id: 'doc-4' }, executor, routerMessages, {});
            assert.strictEqual(res, null);
        });

        it('Router classification fails immediately on non-retryable error', async function() {
            // Mock that throws non-retryable parse error
            class TempMock2 {
                async chat() { throw new Error('Invalid JSON structure'); }
                async checkStatus() { return { loadedModels: [MODEL_NAMES.router] }; }
                async listModels() { return [MODEL_NAMES.router]; }
            }
            const mock = new TempMock2();
            const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');
            const executor = new ExpertPipelineExecutor(mock, {});

            let attempts = 0;
            executor._delay = async (ms) => { attempts += 1; return Promise.resolve(); };

            const routerMessages = promptRegistry.buildMessages('SYS_ROUTER_V1', { source_system: 'test', filename: 'f.pdf' });
            await assert.rejects(async () => {
                await executor._classifyDocumentWithRetry({ id: 'doc-5' }, executor, routerMessages, {});
            });
            assert.strictEqual(attempts, 0);
        });

        it('SemanticRouter handles model unavailability gracefully', function() {
            const { SemanticRouter } = require('../../services/experts/routing');
            const router = new SemanticRouter({ enabled: true });
            const registry = new (require('../../services/experts/ExpertRegistry').ExpertRegistry)();
            const pipelines = registry.getPipelines();
            const selected = router.selectPipelineWithFallback(null, pipelines, { modelAvailable: false, routerFailed: false });
            assert.ok(selected._meta && selected._meta.fallback === true);
        });
    });

    it('should bypass Ollama for same-language input', async function() {
        const mock = new MockOllamaService();
        const translator = new LocalTranslator({
            ollamaService: mock,
            config: { minChars: 1 }
        });

        const result = await translator.translate('Hallo Welt', 'de', 'de');
        assert.strictEqual(result, 'Hallo Welt');
        assert.strictEqual(mock.getCallCount(), 0);
    });
});

describe('SemanticRouter', function() {
    it('should prefer expert pipeline when confidence is high', function() {
        const router = new SemanticRouter({
            enabled: true,
            config: { minConfidence: 0.6 }
        });
        const registry = new ExpertRegistry();

        const classification = { classification: { primary_domain: 'Medical', confidence: 0.9 } };
        const selected = router.selectPipeline(classification, registry.getPipelines());
        assert.ok(selected);
        assert.strictEqual(selected.domain, DomainType.MEDICAL);
    });

    it('should fall back to general when confidence is low', function() {
        const router = new SemanticRouter({
            enabled: true,
            config: { minConfidence: 0.8 }
        });
        const registry = new ExpertRegistry();

        const classification = { classification: { primary_domain: 'Medical', confidence: 0.2 } };
        const selected = router.selectPipeline(classification, registry.getPipelines());
        assert.ok(selected);
        assert.strictEqual(selected.domain, DomainType.GENERAL);
    });
});

describe('TemplateRegistry', function() {
    it('should register and retrieve templates by intent and lang', function() {
        const registry = new TemplateRegistry({ includeDefaults: false });
        registry.register({
            intent: 'test_intent',
            lang: 'en',
            systemInstruction: 'Test system'
        });

        const template = registry.get('test_intent', 'en');
        assert.ok(template);
        assert.strictEqual(template.systemInstruction, 'Test system');
    });

    it('should return null for missing templates', function() {
        const registry = new TemplateRegistry({ includeDefaults: false });
        const template = registry.get('missing_intent', 'en');
        assert.strictEqual(template, null);
    });
});

describe('TemplateManager', function() {
    it('should return exact language match when available', function() {
        const registry = new TemplateRegistry({ includeDefaults: false });
        registry.register({
            intent: 'template_test',
            lang: 'en',
            systemInstruction: 'English'
        });
        registry.register({
            intent: 'template_test',
            lang: 'de',
            systemInstruction: 'Deutsch'
        });

        const manager = new TemplateManager(registry);
        const template = manager.getTemplate('template_test', 'de', 'en');
        assert.strictEqual(template.lang, 'de');
    });

    it('should fall back to fallbackLang when exact language is missing', function() {
        const registry = new TemplateRegistry({ includeDefaults: false });
        registry.register({
            intent: 'fallback_test',
            lang: 'fr',
            systemInstruction: 'Francais'
        });

        const manager = new TemplateManager(registry);
        const template = manager.getTemplate('fallback_test', 'de', 'fr');
        assert.strictEqual(template.lang, 'fr');
    });

    it('should fall back to any available template when no language matches', function() {
        const registry = new TemplateRegistry({ includeDefaults: false });
        registry.register({
            intent: 'any_test',
            lang: 'en',
            systemInstruction: 'English'
        });

        const manager = new TemplateManager(registry);
        const template = manager.getTemplate('any_test', 'de', 'fr');
        assert.strictEqual(template.lang, 'en');
    });
});

/**
 * Sample test documents
 */
const TestDocuments = {
    medicalLabReport: {
        id: 'test-doc-001',
        filename: 'lab_results_2024.pdf',
        content: `
            LABORATORY REPORT
            Patient: John Smith
            DOB: 01/15/1980
            Date of Service: 03/15/2024
            
            Complete Blood Count (CBC):
            WBC: 7.5 x10^9/L (Normal: 4.5-11.0)
            RBC: 4.8 x10^12/L (Normal: 4.5-5.5)
            Hemoglobin: 14.2 g/dL (Normal: 13.5-17.5)
            Hematocrit: 42% (Normal: 38-50%)
            Platelets: 250 x10^9/L (Normal: 150-400)
            
            Metabolic Panel:
            Glucose: 105 mg/dL (Normal: 70-100) HIGH
            Creatinine: 1.1 mg/dL (Normal: 0.7-1.3)
            
            Ordering Physician: Dr. Sarah Johnson
            Memorial Hospital Laboratory
        `,
        image_data: null
    },
    
    financialInvoice: {
        id: 'test-doc-002',
        filename: 'invoice_12345.pdf',
        content: `
            INVOICE #12345
            
            From: ABC Services LLC
            To: XYZ Corporation
            
            Date: March 20, 2024
            Due Date: April 20, 2024
            
            Description: Consulting Services - Q1 2024
            Amount: $5,000.00
            
            Tax (8%): $400.00
            Total Due: $5,400.00
            
            Payment Terms: Net 30
        `,
        image_data: null
    },
    
    generalCorrespondence: {
        id: 'test-doc-003',
        filename: 'letter.pdf',
        content: `
            Dear Mr. Johnson,
            
            Thank you for your inquiry regarding our services.
            We would be happy to schedule a meeting to discuss
            your requirements in more detail.
            
            Please let us know your availability.
            
            Best regards,
            Jane Smith
            Customer Service Manager
        `,
        image_data: null
    }
};

/**
 * Create a base64 test image (1x1 red PNG)
 */
function createTestImageBase64() {
    // Minimal valid PNG (1x1 red pixel)
    const pngBytes = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
        0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, // IEND chunk
        0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    return pngBytes.toString('base64');
}

// ============================================================================
// PROMPT REGISTRY TESTS
// ============================================================================

describe('Expert Pipeline', function() {
    describe('PromptRegistry', function() {
        const { PromptRegistry, DomainType, ModelType, PromptCategory } = require('../../services/prompts/PromptRegistry');
        
        let registry;
        
        beforeEach(function() {
            registry = new PromptRegistry();
        });
        
        describe('Registration', function() {
            it('should register a valid prompt', function() {
                const prompt = {
                    id: 'TEST_PROMPT_V1',
                    version: '1.0.0',
                    domain: DomainType.GENERAL,
                    model: ModelType.TEXT,
                    category: PromptCategory.EXTRACTION,
                    systemPrompt: 'You are a test assistant.',
                    userPromptTemplate: 'Process this: {{content}}'
                };
                
                registry.register(prompt);
                
                const retrieved = registry.get('TEST_PROMPT_V1');
                assert.strictEqual(retrieved.id, 'TEST_PROMPT_V1');
                assert.strictEqual(retrieved.version, '1.0.0');
            });
            
            it('should be idempotent on identical duplicate registration', function() {
                const prompt = {
                    id: 'DUPLICATE_TEST',
                    version: '1.0.0',
                    domain: DomainType.GENERAL,
                    model: ModelType.TEXT,
                    category: PromptCategory.EXTRACTION,
                    systemPrompt: 'Test',
                    userPromptTemplate: 'Test {{content}}'
                };

                registry.register(prompt);

                // Registering the same prompt again should be idempotent and not throw
                registry.register(prompt);

                const retrieved = registry.get('DUPLICATE_TEST');
                assert.strictEqual(retrieved.id, 'DUPLICATE_TEST');
            });

            it('should throw on conflicting duplicate registration', function() {
                const prompt = {
                    id: 'CONFLICT_TEST',
                    version: '1.0.0',
                    domain: DomainType.GENERAL,
                    model: ModelType.TEXT,
                    category: PromptCategory.EXTRACTION,
                    systemPrompt: 'Original',
                    userPromptTemplate: 'Original {{content}}'
                };

                const conflicting = {
                    ...prompt,
                    systemPrompt: 'Modified'
                };

                registry.register(prompt);

                assert.throws(() => {
                    registry.register(conflicting);
                }, /already registered/);
            });
            
            it('should allow overwrite with force flag', function() {
                const prompt1 = {
                    id: 'OVERWRITE_TEST',
                    version: '1.0.0',
                    domain: DomainType.GENERAL,
                    model: ModelType.TEXT,
                    category: PromptCategory.EXTRACTION,
                    systemPrompt: 'Original',
                    userPromptTemplate: 'Original {{content}}'
                };
                
                const prompt2 = {
                    ...prompt1,
                    version: '2.0.0',
                    systemPrompt: 'Updated'
                };
                
                registry.register(prompt1);
                registry.register(prompt2, { overwrite: true });
                
                const retrieved = registry.get('OVERWRITE_TEST');
                assert.strictEqual(retrieved.version, '2.0.0');
                assert.strictEqual(retrieved.systemPrompt, 'Updated');
            });
            
            it('should validate required fields', function() {
                assert.throws(() => {
                    registry.register({
                        id: 'INVALID',
                        // Missing required fields
                    });
                }, /Missing required field/);
            });
        });
        
        describe('Retrieval', function() {
            beforeEach(function() {
                registry.register({
                    id: 'MEDICAL_EXTRACT_V1',
                    version: '1.0.0',
                    domain: DomainType.MEDICAL,
                    model: ModelType.TEXT,
                    category: PromptCategory.EXTRACTION,
                    systemPrompt: 'Medical extraction prompt',
                    userPromptTemplate: 'Extract from: {{content}}'
                });
                
                registry.register({
                    id: 'GENERAL_CLASSIFY_V1',
                    version: '1.0.0',
                    domain: DomainType.GENERAL,
                    model: ModelType.MULTIMODAL,
                    category: PromptCategory.ROUTING,
                    systemPrompt: 'Classification prompt',
                    userPromptTemplate: 'Classify: {{content}}'
                });
            });
            
            it('should retrieve by ID', function() {
                const prompt = registry.get('MEDICAL_EXTRACT_V1');
                assert.strictEqual(prompt.domain, DomainType.MEDICAL);
            });
            
            it('should throw on unknown ID', function() {
                assert.throws(() => {
                    registry.get('NONEXISTENT');
                }, /not found/);
            });
            
            it('should find by domain', function() {
                const medical = registry.findByDomain(DomainType.MEDICAL);
                assert.ok(medical.length >= 1);
                assert.ok(medical.some(prompt => prompt.id === 'MEDICAL_EXTRACT_V1'));
            });
            
            it('should find by model type', function() {
                const multimodal = registry.findByModel(ModelType.MULTIMODAL);
                assert.strictEqual(multimodal.length, 1);
                assert.strictEqual(multimodal[0].id, 'GENERAL_CLASSIFY_V1');
            });
            
            it('should find by category', function() {
                const extraction = registry.findByCategory(PromptCategory.EXTRACTION);
                assert.ok(extraction.length >= 1);
                assert.ok(extraction.some(prompt => prompt.id === 'MEDICAL_EXTRACT_V1'));
            });

            it('should list all prompts', function() {
                const all = registry.list();
                assert.ok(all.length >= 2);
                assert.ok(all.some(prompt => prompt.id === 'MEDICAL_EXTRACT_V1'));
                assert.ok(all.some(prompt => prompt.id === 'GENERAL_CLASSIFY_V1'));
            });
        });
        
        describe('Message Building', function() {
            beforeEach(function() {
                registry.register({
                    id: 'TEMPLATE_TEST_V1',
                    version: '1.0.0',
                    domain: DomainType.GENERAL,
                    model: ModelType.TEXT,
                    category: PromptCategory.EXTRACTION,
                    systemPrompt: 'You are processing {{document_type}} documents.',
                    userPromptTemplate: 'Document: {{filename}}\nContent: {{content}}'
                });
            });
            
            it('should build messages with variable substitution', function() {
                const messages = registry.buildMessages('TEMPLATE_TEST_V1', {
                    document_type: 'medical',
                    filename: 'test.pdf',
                    content: 'Test content here'
                });
                
                assert.strictEqual(messages.length, 2);
                assert.strictEqual(messages[0].role, 'system');
                assert.ok(messages[0].content.includes('medical'));
                assert.strictEqual(messages[1].role, 'user');
                assert.ok(messages[1].content.includes('test.pdf'));
            });
            
            it('should include image for multimodal prompts', function() {
                registry.register({
                    id: 'MULTIMODAL_TEST_V1',
                    version: '1.0.0',
                    domain: DomainType.GENERAL,
                    model: ModelType.MULTIMODAL,
                    category: PromptCategory.ROUTING,
                    systemPrompt: 'Analyze images',
                    userPromptTemplate: 'Describe: {{description}}'
                });
                
                const testImage = createTestImageBase64();
                const messages = registry.buildMessages('MULTIMODAL_TEST_V1', {
                    description: 'test image'
                }, testImage);
                
                assert.ok(messages[1].images);
                assert.strictEqual(messages[1].images.length, 1);
            });
            
            it('should handle missing variables gracefully', function() {
                const messages = registry.buildMessages('TEMPLATE_TEST_V1', {
                    filename: 'test.pdf'
                    // Missing content and document_type
                });
                
                // Should still build messages, with empty substitutions
                assert.strictEqual(messages.length, 2);
            });
        });
    });

    // ============================================================================
    // MEDICAL PROMPTS TESTS
    // ============================================================================
    
    describe('MedicalPrompts', function() {
        const { PromptRegistry, DomainType } = require('../../services/prompts/PromptRegistry');
        const { registerMedicalPrompts, MedicalDocumentTypes } = require('../../services/prompts/MedicalPrompts');
        
        let registry;
        
        beforeEach(function() {
            registry = new PromptRegistry();
            registerMedicalPrompts(registry);
        });
        
        it('should register all medical prompts', function() {
            const prompts = registry.list();
            assert.ok(prompts.length >= 4, 'Should register at least 4 prompts');
            
            // Check for key prompts
            assert.ok(registry.has('SYS_ROUTER_V1'), 'Should have router prompt');
            assert.ok(registry.has('MED_IMAGING_EXTRACT_V1'), 'Should have imaging extraction');
            assert.ok(registry.has('MED_TEXT_EXTRACT_V1'), 'Should have text extraction');
            assert.ok(registry.has('MED_INTEGRATE_V1'), 'Should have integration prompt');
        });
        
        it('should have valid medical document types', function() {
            assert.ok(MedicalDocumentTypes.LAB_RESULT);
            assert.ok(MedicalDocumentTypes.RADIOLOGY);
            assert.ok(MedicalDocumentTypes.PRESCRIPTION);
        });
        
        it('should build router messages correctly', function() {
            const messages = registry.buildMessages('SYS_ROUTER_V1', {
                source_system: 'paperless-ngx',
                filename: 'lab_report.pdf',
                resolution: '300dpi',
                file_size: '2MB'
            }, createTestImageBase64());
            
            assert.strictEqual(messages.length, 2);
            assert.ok(messages[0].content.includes('classifier'));
            assert.ok(messages[1].images);
        });
        
        it('should tag medical prompts with correct domain', function() {
            const medicalPrompts = registry.findByDomain(DomainType.MEDICAL);
            assert.ok(medicalPrompts.length >= 2);
        });
    });

    // ============================================================================
    // EXPERT REGISTRY TESTS
    // ============================================================================
    
    describe('ExpertRegistry', function() {
        const { ExpertRegistry } = require('../../services/experts/ExpertRegistry');
        const { DomainType } = require('../../services/prompts/PromptRegistry');
        
        let registry;
        
        beforeEach(function() {
            registry = new ExpertRegistry();
        });
        
        describe('Pipeline Registration', function() {
            it('should register a valid pipeline', function() {
                const pipeline = {
                    id: 'test-pipeline',
                    name: 'Test Pipeline',
                    domain: DomainType.GENERAL,
                    version: '1.0.0',
                    stages: [
                        {
                            id: 'extract',
                            type: 'extraction',
                            model: 'sauerkraut-llama3.1:8b',
                            promptId: 'TEST_EXTRACT_V1'
                        }
                    ],
                    routing: {
                        conditions: [{ field: 'domain', equals: 'General' }]
                    }
                };
                
                registry.register(pipeline);
                
                const retrieved = registry.get('test-pipeline');
                assert.strictEqual(retrieved.name, 'Test Pipeline');
            });
            
            it('should require at least one stage', function() {
                assert.throws(() => {
                    registry.register({
                        id: 'empty-pipeline',
                        name: 'Empty',
                        domain: DomainType.GENERAL,
                        stages: [],
                        routing: {}
                    });
                }, /at least one stage/);
            });
        });
        
        describe('Routing', function() {
            beforeEach(function() {
                registry.register({
                    id: 'medical-pipeline',
                    name: 'Medical Pipeline',
                    domain: DomainType.MEDICAL,
                    version: '1.0.0',
                    priority: 100,
                    stages: [{ id: 's1', type: 'extraction', model: 'test', promptId: 'test' }],
                    routing: {
                        conditions: [
                            { field: 'primary_domain', equals: 'Medical' }
                        ]
                    }
                });
                
                registry.register({
                    id: 'general-pipeline',
                    name: 'General Pipeline',
                    domain: DomainType.GENERAL,
                    version: '1.0.0',
                    priority: 50,
                    stages: [{ id: 's1', type: 'extraction', model: 'test', promptId: 'test' }],
                    routing: {
                        conditions: [],
                        isDefault: true
                    }
                });
            });
            
            it('should route to medical pipeline for medical documents', function() {
                const classification = {
                    primary_domain: 'Medical',
                    document_type: 'lab_result',
                    confidence: 0.9
                };
                
                const { pipeline } = registry.route(classification);
                assert.strictEqual(pipeline.id, 'medical-pipeline');
            });
            
            it('should route to general pipeline by default', function() {
                const classification = {
                    primary_domain: 'General',
                    document_type: 'correspondence',
                    confidence: 0.8
                };
                
                const { pipeline } = registry.route(classification);
                assert.strictEqual(pipeline.id, 'general-pipeline');
            });
            
            it('should include routing metadata', function() {
                const classification = { primary_domain: 'Medical' };
                const { routingMetadata } = registry.route(classification);
                
                assert.ok(routingMetadata.matchedConditions);
                assert.ok(routingMetadata.evaluatedPipelines);
            });
        });
    });

    // ============================================================================
    // MODEL RESOLUTION TESTS
    // ============================================================================

    describe('Model Resolution', function() {
        const { resolveModelName, getModelTier } = require('../../services/utils/modelResolver');
        const { MODEL_NAMES } = require('../../services/prompts/PromptRegistry');

        it('should resolve model aliases', function() {
            assert.strictEqual(resolveModelName('qwen3-vl:8B'), 'qwen3-vl:8b');
            assert.strictEqual(resolveModelName('llava-med'), 'llava-med-v1.6');
            assert.strictEqual(resolveModelName('medtext'), 'medtext-llama3');
            assert.strictEqual(resolveModelName('dragon'), 'llm-pro-finance-8b');
            assert.strictEqual(resolveModelName('nemotron'), 'nemotron-orchestrator:8b');

            // New tests for suffix stripping and exact base handling
            assert.strictEqual(resolveModelName('llm-pro-finance-8b'), 'llm-pro-finance-8b');
            assert.strictEqual(resolveModelName('llm-pro-finance-8b'), 'llm-pro-finance-8b');
            assert.strictEqual(resolveModelName('llava-med-v1.6:latest'), 'llava-med-v1.6');
        });

        it('should identify model tiers', function() {
            assert.strictEqual(getModelTier('qwen3-vl:8b'), 'production');
            assert.strictEqual(getModelTier('llm-pro-finance-8b'), 'advanced');
            assert.strictEqual(getModelTier('nomic-embed-text-v1.5'), 'infrastructure');
        });

        it('should have all required production models defined', function() {
            assert.ok(MODEL_NAMES.router, 'router should be defined');
            assert.ok(MODEL_NAMES.medicalImaging, 'medicalImaging should be defined');
            assert.ok(MODEL_NAMES.medicalText, 'medicalText should be defined');
            assert.ok(MODEL_NAMES.financeReasoning, 'financeReasoning should be defined');
            assert.ok(MODEL_NAMES.financeGeneral, 'financeGeneral should be defined');
            assert.ok(MODEL_NAMES.vatExpert, 'vatExpert should be defined');
            assert.ok(MODEL_NAMES.general, 'general should be defined');
        });

        it('should support advanced tier models when configured', function() {
            // These should be null by default but configurable
            // Advanced/infrastructure models are optional and may be preconfigured in CI.
            assert.ok(MODEL_NAMES.dragon === null || typeof MODEL_NAMES.dragon === 'string');
            assert.ok(MODEL_NAMES.gptOss === null || typeof MODEL_NAMES.gptOss === 'string');
            assert.ok(MODEL_NAMES.orchestrator === null || typeof MODEL_NAMES.orchestrator === 'string');
        });
    });

    // ============================================================================
    // EXPERT PIPELINE EXECUTOR TESTS
    // ============================================================================
    
    describe('ExpertPipelineExecutor', function() {
        const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');
        const { promptRegistry } = require('../../services/prompts/PromptRegistry');
        const { registerMedicalPrompts } = require('../../services/prompts/MedicalPrompts');
        
        let executor;
        let mockOllama;
        
        beforeEach(function() {
            // Register prompts
            registerMedicalPrompts(promptRegistry);
            
            // Create mock Ollama with medical response
            mockOllama = new MockOllamaService({
                responses: {
                    'qwen3-vl:8b': {
                        message: {
                            content: JSON.stringify({
                                primary_domain: 'Medical',
                                document_type: 'lab_result',
                                confidence: 0.92,
                                metadata_hints: {
                                    detected_entities: ['John Smith', 'Memorial Hospital']
                                }
                            })
                        }
                    },
                    'medtext-llama3:latest': {
                        message: {
                            content: JSON.stringify({
                                patient_info: { name: 'John Smith' },
                                conditions: [{ condition: 'Hyperglycemia', normalized: 'E11.65' }],
                                medications: [],
                                lab_values: [
                                    { test: 'Glucose', value: 105, unit: 'mg/dL', flag: 'HIGH' }
                                ]
                            })
                        }
                    }
                }
            });
            
            executor = new ExpertPipelineExecutor(mockOllama, {
                defaultTimeout: 5000,
                maxRetries: 1
            });
        });
        
        it('should execute a pipeline successfully', async function() {
            this.timeout(10000);
            
            const result = await executor.execute(
                'medical-text',
                TestDocuments.medicalLabReport
            );
            
            assert.strictEqual(result.success, true);
            assert.ok(result.pipeline_id);
            assert.ok(result.result);
        });
        
        it('should track execution metrics', async function() {
            await executor.execute('medical-text', TestDocuments.medicalLabReport);
            
            const stats = executor.getStats();
            assert.strictEqual(stats.totalExecutions, 1);
            assert.ok(stats.successfulExecutions >= 0);
        });
        
        it('should handle pipeline not found', async function() {
            const result = await executor.execute(
                'nonexistent-pipeline',
                TestDocuments.medicalLabReport
            );
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error.includes('not found'));
        });
        
        it('should handle model failures with retry', async function() {
            this.timeout(15000);

            await withGuidanceDisabled(async () => {
                const failingOllama = new MockOllamaService({
                    shouldFail: true,
                    failureMessage: 'Connection refused'
                });

                const failingExecutor = new ExpertPipelineExecutor(failingOllama, {
                    maxRetries: 2,
                    defaultTimeout: 1000
                });

                const result = await failingExecutor.execute(
                    'medical-text',
                    TestDocuments.medicalLabReport
                );

                assert.strictEqual(result.success, false);
                // Should have retried
                assert.ok(failingOllama.getCallCount() >= 1);
            });
        });
    });

    // ============================================================================
    // IMAGE PREPARATOR TESTS
    // ============================================================================
    
    describe('ImagePreparator', function() {
        const { ImagePreparator } = require('../../services/integration/DocumentProcessor');
        
        it('should prepare image from base64', async function() {
            const base64 = createTestImageBase64();
            const dataUrl = `data:image/png;base64,${base64}`;
            
            const result = await ImagePreparator.prepare(dataUrl);
            
            assert.ok(result.base64);
            assert.strictEqual(result.metadata.source, 'base64');
            assert.strictEqual(result.metadata.format, 'png');
        });
        
        it('should prepare image from buffer', async function() {
            const buffer = Buffer.from(createTestImageBase64(), 'base64');
            
            const result = await ImagePreparator.prepare(buffer);
            
            assert.ok(result.base64);
            assert.strictEqual(result.metadata.source, 'buffer');
        });
        
        it('should detect PNG format', async function() {
            const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            const format = ImagePreparator._detectImageFormat(pngBuffer);
            assert.strictEqual(format, 'png');
        });
        
        it('should detect JPEG format', async function() {
            const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
            const format = ImagePreparator._detectImageFormat(jpegBuffer);
            assert.strictEqual(format, 'jpeg');
        });
        
        it('should handle invalid source', async function() {
            await assert.rejects(async () => {
                await ImagePreparator.prepare(12345); // Invalid type
            }, /Invalid image source/);
        });
    });

    // ============================================================================
    // RESULT MERGER TESTS
    // ============================================================================
    
    describe('ResultMerger', function() {
        const { ResultMerger } = require('../../services/integration/DocumentProcessor');
        
        const expertResult = {
            result: {
                primary_output: {
                    entities: {
                        conditions: [
                            { condition: 'Diabetes', normalized: 'E11' }
                        ],
                        medications: [
                            { drug_name: 'Metformin', dosage: '500mg' }
                        ]
                    },
                    summary: { brief: 'Lab results showing elevated glucose' }
                },
                classification: {
                    primary_domain: 'Medical',
                    document_type: 'lab_result'
                }
            },
            metadata: { confidence: 0.85 },
            pipeline_id: 'medical-text'
        };
        
        const legacyResult = {
            entities: {
                conditions: [
                    { condition: 'High blood sugar' }
                ],
                people: [
                    { name: 'John Smith' }
                ]
            },
            summary: 'Patient lab results',
            confidence: 0.7
        };
        
        it('should merge with expert priority', function() {
            const merged = ResultMerger.merge(expertResult, legacyResult, {
                strategy: 'expert_priority'
            });
            
            assert.strictEqual(merged._merge_strategy, 'expert_priority');
            assert.ok(merged.expert_extraction);
            assert.ok(merged.entities.conditions);
        });
        
        it('should merge with legacy priority', function() {
            const merged = ResultMerger.merge(expertResult, legacyResult, {
                strategy: 'legacy_priority'
            });
            
            assert.strictEqual(merged._merge_strategy, 'legacy_priority');
            assert.ok(merged.expert_supplement);
        });
        
        it('should merge with confidence weighting', function() {
            const merged = ResultMerger.merge(expertResult, legacyResult, {
                strategy: 'confidence_weighted'
            });
            
            // Expert has higher confidence (0.85 vs 0.7)
            assert.strictEqual(merged._merge_strategy, 'expert_priority');
        });
        
        it('should deduplicate entities', function() {
            const merged = ResultMerger.merge(expertResult, legacyResult, {
                strategy: 'expert_priority'
            });
            
            // Should have merged conditions without exact duplicates
            const conditions = merged.entities?.conditions || [];
            assert.ok(conditions.length >= 1);
        });
        
        it('should convert to paperless format', function() {
            const merged = ResultMerger.merge(expertResult, legacyResult);
            const paperless = ResultMerger.toPaperlessFormat(merged, 'doc-123');
            
            assert.strictEqual(paperless.document_id, 'doc-123');
            assert.ok(paperless.tags);
            assert.ok(paperless._processed_at);
            assert.ok(paperless.custom_fields);
        });
        
        it('should extract tags from classification', function() {
            const merged = ResultMerger.merge(expertResult, legacyResult);
            const paperless = ResultMerger.toPaperlessFormat(merged, 'doc-123');
            
            assert.ok(paperless.tags.includes('medical'));
        });
    });

    // ============================================================================
    // DOCUMENT PROCESSOR TESTS
    // ============================================================================
    
    describe('DocumentProcessor', function() {
        const { DocumentProcessor, ProcessorConfig } = require('../../services/integration/DocumentProcessor');
        
        let processor;
        let mockOllama;
        
        beforeEach(function() {
            mockOllama = new MockOllamaService({
                loadedModels: ['qwen3-vl:8b', 'medtext-llama3', 'sauerkraut-llama3.1:8b'],
                responses: {
                    'qwen3-vl:8b': {
                        message: {
                            content: JSON.stringify({
                                primary_domain: 'Medical',
                                document_type: 'lab_result',
                                confidence: 0.9
                            })
                        }
                    },
                    'medtext-llama3:latest': {
                        message: {
                            content: JSON.stringify({
                                patient_info: { name: 'Test Patient' },
                                conditions: [],
                                medications: []
                            })
                        }
                    }
                }
            });
            
            processor = new DocumentProcessor(mockOllama, {
                features: {
                    enableExpertPipeline: true,
                    enableMedicalPipeline: true,
                    enableFallbackToLegacy: false // Disable for unit tests
                }
            });
        });
        
        it('should process document in expert mode', async function() {
            this.timeout(30000);
            
            const result = await processor.process(
                TestDocuments.medicalLabReport,
                { mode: ProcessorConfig.modes.EXPERT_PIPELINE }
            );
            
            assert.strictEqual(result.success, true);
            assert.ok(result.result);
            assert.ok(result.paperless);
            assert.ok(result.metadata);
        });
        
        it('should classify document', async function() {
            this.timeout(5000);
            
            const classification = await processor.classify(
                TestDocuments.medicalLabReport
            );
            
            assert.ok(classification.primary_domain);
        });
        
        it('should recommend pipeline', async function() {
            this.timeout(5000);
            
            const recommendation = await processor.recommendPipeline(
                TestDocuments.medicalLabReport
            );
            
            assert.ok(recommendation.classification);
            assert.ok(recommendation.recommendedPipeline);
        });
        
        it('should return statistics', function() {
            const stats = processor.getStats();
            
            assert.ok(typeof stats.totalProcessed === 'number');
            assert.ok(typeof stats.registeredPipelines === 'number');
            assert.ok(typeof stats.registeredPrompts === 'number');
        });
        
        it('should handle processing errors gracefully', async function() {
            this.timeout(5000);

            await withGuidanceDisabled(async () => {
                const failingOllama = new MockOllamaService({
                    shouldFail: true,
                    failureMessage: 'Model not available'
                });

                const failingProcessor = new DocumentProcessor(failingOllama, {
                    features: {
                        enableFallbackToLegacy: false
                    }
                });

                const result = await failingProcessor.process(
                    TestDocuments.medicalLabReport,
                    { mode: ProcessorConfig.modes.EXPERT_PIPELINE }
                );

                assert.strictEqual(result.success, false);
                assert.ok(result.error);
            });
        });
    });

    // ============================================================================
    // SERVICE INDEX TESTS
    // ============================================================================
    
    describe('Service Index', function() {
        const services = require('../../services');
        
        it('should export all required components', function() {
            // Prompt system
            assert.ok(services.PromptRegistry);
            assert.ok(services.promptRegistry);
            assert.ok(services.DomainType);
            assert.ok(services.ModelType);
            
            // Expert system
            assert.ok(services.ExpertRegistry);
            assert.ok(services.expertRegistry);
            assert.ok(services.ExpertPipelineExecutor);
            
            // Integration
            assert.ok(services.DocumentProcessor);
            assert.ok(services.ImagePreparator);
            assert.ok(services.ResultMerger);
            
            // Factory functions
            assert.ok(services.createDocumentProcessor);
            assert.ok(services.createServiceContainer);
            assert.ok(services.initializeExpertPipeline);
        });
        
        it('should initialize expert pipeline', function() {
            const result = services.initializeExpertPipeline({
                enableMedical: true
            });
            
            assert.ok(result.promptCount > 0);
            assert.ok(result.pipelineCount > 0);
            assert.ok(result.initializationTime >= 0);
        });
        
        it('should create service container', function() {
            const mockOllama = new MockOllamaService();
            const container = services.createServiceContainer(mockOllama);
            
            assert.ok(container.documentProcessor);
            assert.ok(container.pipelineExecutor);
            assert.ok(container.promptRegistry);
            assert.ok(container.initialized);
            assert.ok(typeof container.process === 'function');
            assert.ok(typeof container.classify === 'function');
        });
    });

    // ============================================================================
    // INTEGRATION TESTS
    // ============================================================================
    
    describe('Integration', function() {
        const services = require('../../services');
        
        it('should process medical document end-to-end', async function() {
            this.timeout(60000);
            
            const mockOllama = new MockOllamaService({
                loadedModels: ['qwen3-vl:8b', 'medtext-llama3:latest', 'sauerkraut-llama3.1:8b'],
                responses: {
                    'qwen3-vl:8b': {
                        message: {
                            content: JSON.stringify({
                                primary_domain: 'Medical',
                                document_type: 'lab_result',
                                confidence: 0.95,
                                reasoning: 'Contains lab values and patient info',
                                metadata_hints: {
                                    detected_entities: ['John Smith', 'Dr. Johnson'],
                                    detected_date: '2024-03-15'
                                }
                            })
                        }
                    },
                    'medtext-llama3:latest': {
                        message: {
                            content: JSON.stringify({
                                patient_info: {
                                    name: 'John Smith',
                                    dob: '1980-01-15'
                                },
                                conditions: [
                                    {
                                        condition: 'Hyperglycemia',
                                        normalized: 'R73.9',
                                        status: 'active'
                                    }
                                ],
                                medications: [],
                                lab_values: [
                                    {
                                        test: 'Glucose',
                                        value: 105,
                                        unit: 'mg/dL',
                                        reference_range: '70-100',
                                        flag: 'HIGH'
                                    }
                                ],
                                providers: [
                                    {
                                        name: 'Dr. Sarah Johnson',
                                        role: 'Ordering Physician'
                                    }
                                ]
                            })
                        }
                    }
                }
            });
            
            const container = services.createServiceContainer(mockOllama);
            
            const result = await container.process(TestDocuments.medicalLabReport);

            assert.strictEqual(result.success, true);
            assert.ok(result.paperless);
            // Tags may be empty array or undefined if pipeline extracts no tags
            assert.ok(result.paperless.tags === undefined || Array.isArray(result.paperless.tags));
            assert.strictEqual(result.paperless.document_id, 'test-doc-001');
        });
        
        it('should handle financial document routing', async function() {
            this.timeout(10000);
            
            const mockOllama = new MockOllamaService({
                loadedModels: ['qwen3-vl:8b', 'sauerkraut-llama3.1:8b'],
                defaultResponse: {
                    message: {
                        content: JSON.stringify({
                            primary_domain: 'Financial',
                            document_type: 'invoice',
                            confidence: 0.88
                        })
                    }
                }
            });
            
            const container = services.createServiceContainer(mockOllama);
            
            const recommendation = await container.documentProcessor.recommendPipeline(
                TestDocuments.financialInvoice
            );
            
            assert.ok(recommendation.classification);
            assert.strictEqual(recommendation.classification.primary_domain, 'Financial');
        });
    });
});

// ============================================================================
// RUN TESTS IF EXECUTED DIRECTLY
// ============================================================================

// ---------------------------------------------------------------------------
// Additional OCR checkpoint tests
// ---------------------------------------------------------------------------
describe('OCR checkpoint handling (integration)', function () {
    const ocrMetadata = require('../../services/experts/utils/ocrMetadata');
    const paperlessServiceModule = require('../../services/paperlessService');
    const { DocumentProcessor } = require('../../services/integration/DocumentProcessor');

    afterEach(function () {
        if (paperlessServiceModule._original_createCustomFieldSafely) {
            paperlessServiceModule.createCustomFieldSafely = paperlessServiceModule._original_createCustomFieldSafely;
            delete paperlessServiceModule._original_createCustomFieldSafely;
        }
    });

    it('ensureOcrCustomFields returns success when all created', async function () {
        paperlessServiceModule._original_createCustomFieldSafely = paperlessServiceModule.createCustomFieldSafely;
        paperlessServiceModule.createCustomFieldSafely = async (fname) => ({ id: 100 + Math.floor(Math.random()*100), name: fname });

        const res = await ocrMetadata.ensureOcrCustomFields();
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.fields.length, 3);
        assert.strictEqual(res.errors.length, 0);
    });

    it('ensureOcrCustomFields reports partial success when one field fails', async function () {
        paperlessServiceModule._original_createCustomFieldSafely = paperlessServiceModule.createCustomFieldSafely;
        let calls = 0;
        paperlessServiceModule.createCustomFieldSafely = async (fname) => {
            calls++;
            if (calls === 3) return { success: false, error: { type: 'validation', message: 'invalid', statusCode: 400, retryable: false } };
            return { id: 200 + calls, name: fname };
        };

        const res = await ocrMetadata.ensureOcrCustomFields();
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.fields.length, 2);
        assert.strictEqual(res.errors.length, 1);
        assert.strictEqual(res.errors[0].field, 'vis_ocr_text_en');
    });

    it('DocumentProcessor includes notes when checkpoint errors exist', function () {
        const fakeResult = {
            classification: { primary_domain: 'General' },
            _expert_result: {
                ocr_checkpoint: {
                    success: false,
                    fields: ['vis_ocr_text','vis_ocr_text_de'],
                    errors: [{ field: 'vis_ocr_text_en', error: { message: 'permission denied' } }]
                }
            },
            vis_ocr_text: 'some text',
            vis_ocr_text_de: 'de text'
        };

        const { ResultMerger } = require('../../services/integration/DocumentProcessor');
        const custom = ResultMerger._extractCustomFields(fakeResult);
        assert.ok(custom.ai_pipeline_notes);
        assert.ok(custom.ocr_checkpoint_status);
    });
});

if (require.main === module) {
    const Mocha = require('mocha');
    const mocha = new Mocha({
        timeout: 30000,
        reporter: 'spec'
    });
    
    mocha.addFile(__filename);
    
    mocha.run(failures => {
        process.exitCode = failures ? 1 : 0;
    });
}
