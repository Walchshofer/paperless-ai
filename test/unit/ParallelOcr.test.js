/**
 * ParallelOcr.test.js
 *
 * Unit tests for Phase 2: Parallel OCR Execution
 *
 * Test Coverage:
 * - Parallel execution of all tracks
 * - Circuit breaker protection
 * - OCR reconciliation with document-type awareness
 * - Graceful degradation
 */

const assert = require('assert');
const { ParallelOcrExecutor, DocumentType } = require('../../services/experts/ParallelOcrExecutor');
const { CircuitState } = require('../../services/experts/CircuitBreaker');
const paperlessService = require('../../services/paperlessService');

describe('ParallelOcrExecutor', function() {
    let executor;
    let mockOllamaService;

    beforeEach(() => {
        // Mock Ollama service
        mockOllamaService = {
            generate: async () => ({ response: 'Visual OCR extracted text' })
        };

        // Create executor instance
        executor = new ParallelOcrExecutor(mockOllamaService);
    });

    describe('Initialization', () => {
        it('should initialize with circuit breakers', () => {
            assert.ok(executor.circuitBreakers);
            assert.ok(executor.circuitBreakers.visualOcr);
            assert.ok(executor.circuitBreakers.tesseractOcr);
            assert.ok(executor.circuitBreakers.visualElements);
            assert.strictEqual(executor.circuitBreakers.visualOcr.serviceName, 'visual-ocr');
        });

        it('should accept custom configuration', () => {
            const customExecutor = new ParallelOcrExecutor(mockOllamaService, {
                visualOcr: {
                    enabled: false,
                    timeout: 1000
                }
            });

            assert.strictEqual(customExecutor.config.visualOcr.enabled, false);
            assert.strictEqual(customExecutor.config.visualOcr.timeout, 1000);
        });
    });

    describe('Document Type Aware Prompts', () => {
        it('should generate medical-specific prompts', () => {
            const prompt = executor._buildVisualOcrPrompt({ documentType: DocumentType.MEDICAL });
            assert.ok(prompt.includes('medical'));
        });

        it('should generate financial-specific prompts', () => {
            const prompt = executor._buildVisualOcrPrompt({ documentType: DocumentType.FINANCIAL });
            assert.ok(prompt.includes('financial'));
        });

        it('should generate general prompts by default', () => {
            const prompt = executor._buildVisualOcrPrompt({ documentType: DocumentType.GENERAL });
            assert.ok(!prompt.includes('medical'));
            assert.ok(!prompt.includes('financial'));
        });
    });

    describe('OCR Confidence Estimation', () => {
        it('should estimate high confidence for quality text', () => {
            const text = 'This is a well-formatted document with multiple lines.\nIt contains structured data and proper formatting.\nTotal length exceeds 100 characters easily.';
            const confidence = executor._estimateOcrConfidence(text);
            assert.ok(confidence > 0.7, `Expected confidence > 0.7, got ${confidence}`);
        });

        it('should estimate low confidence for short text', () => {
            const text = 'Short';
            const confidence = executor._estimateOcrConfidence(text);
            assert.ok(confidence < 0.7, `Expected confidence < 0.7, got ${confidence}`);
        });

        it('should return zero confidence for empty text', () => {
            const confidence = executor._estimateOcrConfidence('');
            assert.strictEqual(confidence, 0);
        });
    });

    describe('Document Type Inference', () => {
        it('should infer medical from tags', () => {
            const doc = { title: 'Report', tags: ['medical'] };
            const type = executor._inferDocumentType(doc);
            assert.strictEqual(type, DocumentType.MEDICAL);
        });

        it('should infer financial from title', () => {
            const doc = { title: 'Invoice 2024', tags: [] };
            const type = executor._inferDocumentType(doc);
            assert.strictEqual(type, DocumentType.FINANCIAL);
        });

        it('should default to general', () => {
            const doc = { title: 'General Document', tags: [] };
            const type = executor._inferDocumentType(doc);
            assert.strictEqual(type, DocumentType.GENERAL);
        });
    });

    describe('OCR Reconciliation', () => {
        it('should use visual OCR when tesseract fails', async () => {
            const visualResult = {
                success: true,
                data: {
                    text: 'Visual OCR text',
                    confidence: 0.8
                }
            };

            const tesseractResult = {
                success: false,
                error: 'API error'
            };

            const reconciled = await executor._reconcileOcrResults(
                visualResult,
                tesseractResult,
                {}
            );

            assert.strictEqual(reconciled.success, true);
            assert.strictEqual(reconciled.source, 'visual-ocr');
            assert.ok(reconciled.text.length > 0);
        });

        it('should use tesseract when visual fails', async () => {
            const visualResult = {
                success: false,
                error: 'Model error'
            };

            const tesseractResult = {
                success: true,
                data: {
                    text: 'Tesseract OCR text',
                    documentType: DocumentType.GENERAL
                }
            };

            const reconciled = await executor._reconcileOcrResults(
                visualResult,
                tesseractResult,
                {}
            );

            assert.strictEqual(reconciled.success, true);
            assert.strictEqual(reconciled.source, 'tesseract-ocr');
        });

        it('should fail gracefully when both sources fail', async () => {
            const visualResult = {
                success: false,
                error: 'Visual error'
            };

            const tesseractResult = {
                success: false,
                error: 'Tesseract error'
            };

            const reconciled = await executor._reconcileOcrResults(
                visualResult,
                tesseractResult,
                {}
            );

            assert.strictEqual(reconciled.success, false);
            assert.strictEqual(reconciled.source, 'none');
            assert.ok(reconciled.error);
        });

        it('should reconcile when both sources succeed', async () => {
            const visualResult = {
                success: true,
                data: {
                    text: 'Visual OCR text',
                    confidence: 0.85
                }
            };

            const tesseractResult = {
                success: true,
                data: {
                    text: 'Tesseract OCR text',
                    documentType: DocumentType.GENERAL
                }
            };

            const reconciled = await executor._reconcileOcrResults(
                visualResult,
                tesseractResult,
                { documentType: DocumentType.GENERAL }
            );

            assert.strictEqual(reconciled.success, true);
            assert.ok(reconciled.text);
            assert.ok(reconciled.source);
            assert.strictEqual(reconciled.reconciliation.strategy, 'document-type-aware');
        });
    });

    describe('Conflict Rate Calculation', () => {
        it('should calculate zero conflict for identical text', () => {
            const text = 'Same text';
            const conflict = executor._calculateConflictRate(text, text);
            assert.strictEqual(conflict, 0);
        });

        it('should calculate non-zero conflict for different text', () => {
            const text1 = 'This is the first text';
            const text2 = 'This is different content';
            const conflict = executor._calculateConflictRate(text1, text2);
            assert.ok(conflict > 0);
        });

        it('should handle empty text gracefully', () => {
            const conflict = executor._calculateConflictRate('', 'some text');
            assert.ok(conflict >= 0);
        });
    });

    describe('Image Preparation', () => {
        it('should handle base64 encoded images', async () => {
            const document = {
                imageBase64: 'base64encodedimage'
            };

            const result = await executor._prepareImageForOllama(document);
            assert.strictEqual(result, 'base64encodedimage');
        });

        it('should handle image buffers', async () => {
            const buffer = Buffer.from('test image data');
            const document = {
                imageBuffer: buffer
            };

            const result = await executor._prepareImageForOllama(document);
            assert.strictEqual(result, buffer.toString('base64'));
        });

        it('should throw error if no image data available', async () => {
            const document = { id: 'doc-123' };

            try {
                await executor._prepareImageForOllama(document);
                assert.fail('Should have thrown error');
            } catch (error) {
                assert.ok(error.message.includes('No image data available'));
            }
        });
    });

    describe('Statistics and Health', () => {
        it('should track execution statistics', () => {
            const stats = executor.getStats();
            assert.ok(stats.totalExecutions !== undefined);
            assert.ok(stats.circuitBreakerStates);
        });

        it('should report healthy initially', () => {
            assert.strictEqual(executor.isHealthy(), true);
        });

        it('should report unhealthy when circuit is open', () => {
            // Force circuit to open
            executor.circuitBreakers.visualOcr._transitionTo(CircuitState.OPEN);
            assert.strictEqual(executor.isHealthy(), false);
        });

        it('should reset circuit breakers', () => {
            executor.circuitBreakers.visualOcr._transitionTo(CircuitState.OPEN);
            assert.strictEqual(executor.circuitBreakers.visualOcr.isOpen(), true);

            executor.resetCircuitBreakers();
            assert.strictEqual(executor.circuitBreakers.visualOcr.isHealthy(), true);
        });
    });

    describe('Visual OCR Response Parsing', () => {
        it('should parse clean response', () => {
            const response = 'Extracted text from document';
            const parsed = executor._parseVisualOcrResponse(response);
            assert.strictEqual(parsed, 'Extracted text from document');
        });

        it('should remove common prefixes', () => {
            const response = 'Here is the extracted text: Actual content';
            const parsed = executor._parseVisualOcrResponse(response);
            assert.strictEqual(parsed, 'Actual content');
        });

        it('should trim whitespace', () => {
            const response = '  Extracted text  ';
            const parsed = executor._parseVisualOcrResponse(response);
            assert.strictEqual(parsed, 'Extracted text');
        });
    });

    describe('Integration', () => {
        it('should export DocumentType enum', () => {
            assert.ok(DocumentType);
            assert.strictEqual(DocumentType.MEDICAL, 'medical');
            assert.strictEqual(DocumentType.FINANCIAL, 'financial');
            assert.strictEqual(DocumentType.LEGAL, 'legal');
            assert.strictEqual(DocumentType.GENERAL, 'general');
        });

        it('should create executor with metrics collector', () => {
            const mockMetrics = {
                recordCircuitBreakerOperation: () => {},
                recordCircuitBreakerStateTransition: () => {}
            };

            const executorWithMetrics = new ParallelOcrExecutor(
                mockOllamaService,
                {},
                mockMetrics
            );

            assert.ok(executorWithMetrics);
            assert.strictEqual(executorWithMetrics.metricsCollector, mockMetrics);
        });
    });
});
