/**
 * ParallelOcrExecutor.js
 *
 * PHASE 2: Parallel OCR Execution
 *
 * Executes 3 concurrent OCR tracks with circuit breaker protection:
 * - Track 1: Visual OCR (qwen3-vl:8b via Ollama)
 * - Track 2: Tesseract OCR (from Paperless-ngx API)
 * - Track 3: Visual Element Detection (from Visual RAG sidecar)
 *
 * Each track is protected by CircuitBreaker to ensure graceful degradation.
 * Results are merged using document-type-aware reconciliation logic.
 *
 * Architecture Reference: HANDOFF_PROMPT.xml Phase 2
 * Dependencies: CircuitBreaker.js (Phase 1), PaperlessService.js
 */

const axios = require('axios');
const logger = require('../logger');
const config = require('../../config/config');
const { CircuitBreaker } = require('./CircuitBreaker');
const paperlessService = require('../paperlessService');
const { mergeOcrResults, scoreOcrQuality } = require('./utils/ocrQuality');

/**
 * Default configuration for parallel OCR execution
 */
const DEFAULT_CONFIG = {
    visualOcr: {
        enabled: config.visualOCR?.enabled !== false,
        timeout: 500,           // 500ms soft timeout
        hardTimeout: 1000,      // 1000ms hard timeout
        model: config.ollama?.visionModel || 'qwen3-vl:8b',
        failureThreshold: 3,
        cooldownPeriod: 30000
    },
    tesseractOcr: {
        enabled: true,
        timeout: 300,           // 300ms for API fetch
        failureThreshold: 3,
        cooldownPeriod: 30000
    },
    visualElements: {
        enabled: config.visualRagSidecar?.enabled === 'yes',
        timeout: 500,           // 500ms for element detection
        url: config.visualRagSidecar?.url || 'http://visual-rag:8001',
        failureThreshold: 3,
        cooldownPeriod: 30000
    },
    reconciliation: {
        minQuality: 0.6,
        preferVisual: true,
        fallbackStrategy: 'paperless'
    }
};

/**
 * Document type classifications for reconciliation biasing
 */
const DocumentType = {
    MEDICAL: 'medical',
    FINANCIAL: 'financial',
    LEGAL: 'legal',
    GENERAL: 'general',
    SCANNED: 'scanned',
    DIGITAL: 'digital'
};

/**
 * ParallelOcrExecutor - Executes OCR tracks in parallel with circuit breaker protection
 *
 * Usage:
 *   const executor = new ParallelOcrExecutor(ollamaService, options);
 *   const result = await executor.execute(document, metadata);
 */
class ParallelOcrExecutor {
    /**
     * @param {Object} ollamaService - Ollama service instance for visual OCR
     * @param {Object} options - Configuration options
     * @param {Object} metricsCollector - Optional Prometheus metrics collector
     */
    constructor(ollamaService, options = {}, metricsCollector = null) {
        this.ollamaService = ollamaService;
        this.config = { ...DEFAULT_CONFIG, ...options };
        this.metricsCollector = metricsCollector;

        // Initialize circuit breakers for each track
        this.circuitBreakers = {
            visualOcr: new CircuitBreaker(
                'visual-ocr',
                {
                    failureThreshold: this.config.visualOcr.failureThreshold,
                    cooldownPeriod: this.config.visualOcr.cooldownPeriod,
                    timeout: this.config.visualOcr.timeout,
                    hardTimeout: this.config.visualOcr.hardTimeout
                },
                metricsCollector
            ),
            tesseractOcr: new CircuitBreaker(
                'tesseract-ocr',
                {
                    failureThreshold: this.config.tesseractOcr.failureThreshold,
                    cooldownPeriod: this.config.tesseractOcr.cooldownPeriod,
                    timeout: this.config.tesseractOcr.timeout
                },
                metricsCollector
            ),
            visualElements: new CircuitBreaker(
                'visual-elements',
                {
                    failureThreshold: this.config.visualElements.failureThreshold,
                    cooldownPeriod: this.config.visualElements.cooldownPeriod,
                    timeout: this.config.visualElements.timeout
                },
                metricsCollector
            )
        };

        // Execution statistics
        this.stats = {
            totalExecutions: 0,
            successfulExecutions: 0,
            partialExecutions: 0,
            failedExecutions: 0,
            visualOcrSuccesses: 0,
            tesseractOcrSuccesses: 0,
            visualElementsSuccesses: 0,
            reconciliationConflicts: 0
        };

        logger.info({
            event: 'parallel_ocr_executor_initialized',
            visualOcrEnabled: this.config.visualOcr.enabled,
            tesseractEnabled: this.config.tesseractOcr.enabled,
            visualElementsEnabled: this.config.visualElements.enabled
        });
    }

    /**
     * Execute all OCR tracks in parallel
     *
     * @param {Object} document - Document data with image/metadata
     * @param {Object} metadata - Additional metadata (classification, etc.)
     * @returns {Promise<Object>} Combined OCR result with reconciliation
     */
    async execute(document, metadata = {}) {
        const startTime = Date.now();
        this.stats.totalExecutions++;

        logger.info({
            event: 'parallel_ocr_execution_start',
            documentId: document.id || document.filename,
            documentType: metadata.documentType || DocumentType.GENERAL
        });

        // Execute all tracks in parallel
        const trackPromises = [];

        // Track 1: Visual OCR
        if (this.config.visualOcr.enabled) {
            trackPromises.push(
                this._executeVisualOcrTrack(document, metadata)
                    .catch(error => ({
                        success: false,
                        error: error.message,
                        track: 'visual-ocr'
                    }))
            );
        } else {
            trackPromises.push(Promise.resolve({
                success: false,
                error: 'Visual OCR disabled',
                track: 'visual-ocr',
                disabled: true
            }));
        }

        // Track 2: Tesseract OCR
        if (this.config.tesseractOcr.enabled) {
            trackPromises.push(
                this._executeTesseractOcrTrack(document, metadata)
                    .catch(error => ({
                        success: false,
                        error: error.message,
                        track: 'tesseract-ocr'
                    }))
            );
        } else {
            trackPromises.push(Promise.resolve({
                success: false,
                error: 'Tesseract OCR disabled',
                track: 'tesseract-ocr',
                disabled: true
            }));
        }

        // Track 3: Visual Element Detection
        if (this.config.visualElements.enabled) {
            trackPromises.push(
                this._executeVisualElementsTrack(document, metadata)
                    .catch(error => ({
                        success: false,
                        error: error.message,
                        track: 'visual-elements'
                    }))
            );
        } else {
            trackPromises.push(Promise.resolve({
                success: false,
                error: 'Visual elements detection disabled',
                track: 'visual-elements',
                disabled: true
            }));
        }

        // Wait for all tracks to complete
        const [visualOcrResult, tesseractOcrResult, visualElementsResult] = await Promise.all(trackPromises);

        const executionTime = Date.now() - startTime;

        // Log track results
        logger.info({
            event: 'parallel_ocr_tracks_completed',
            documentId: document.id || document.filename,
            executionTimeMs: executionTime,
            visualOcrSuccess: visualOcrResult.success,
            tesseractOcrSuccess: tesseractOcrResult.success,
            visualElementsSuccess: visualElementsResult.success
        });

        // Update statistics
        if (visualOcrResult.success) this.stats.visualOcrSuccesses++;
        if (tesseractOcrResult.success) this.stats.tesseractOcrSuccesses++;
        if (visualElementsResult.success) this.stats.visualElementsSuccesses++;

        // Reconcile OCR results
        const reconciledOcr = await this._reconcileOcrResults(
            visualOcrResult,
            tesseractOcrResult,
            metadata
        );

        // Build final result
        const result = {
            success: reconciledOcr.success || tesseractOcrResult.success || visualOcrResult.success,
            ocr: reconciledOcr,
            visualElements: visualElementsResult.success ? visualElementsResult.data : null,
            metadata: {
                executionTimeMs: executionTime,
                tracksExecuted: 3,
                tracksSucceeded: [
                    visualOcrResult.success,
                    tesseractOcrResult.success,
                    visualElementsResult.success
                ].filter(Boolean).length,
                documentType: metadata.documentType || DocumentType.GENERAL,
                circuitBreakerStates: {
                    visualOcr: this.circuitBreakers.visualOcr.getState(),
                    tesseractOcr: this.circuitBreakers.tesseractOcr.getState(),
                    visualElements: this.circuitBreakers.visualElements.getState()
                }
            },
            errors: [
                visualOcrResult.success ? null : { track: 'visual-ocr', error: visualOcrResult.error },
                tesseractOcrResult.success ? null : { track: 'tesseract-ocr', error: tesseractOcrResult.error },
                visualElementsResult.success ? null : { track: 'visual-elements', error: visualElementsResult.error }
            ].filter(Boolean)
        };

        // Update execution statistics
        if (result.success) {
            if (result.metadata.tracksSucceeded === 3) {
                this.stats.successfulExecutions++;
            } else {
                this.stats.partialExecutions++;
            }
        } else {
            this.stats.failedExecutions++;
        }

        logger.info({
            event: 'parallel_ocr_execution_complete',
            documentId: document.id || document.filename,
            success: result.success,
            ocrSource: reconciledOcr.source,
            executionTimeMs: executionTime
        });

        return result;
    }

    /**
     * Track 1: Execute Visual OCR using qwen3-vl:8b
     * @private
     */
    async _executeVisualOcrTrack(document, metadata) {
        logger.debug({
            event: 'visual_ocr_track_start',
            documentId: document.id || document.filename
        });

        const operation = async () => {
            // Prepare image for Ollama
            const imageBase64 = await this._prepareImageForOllama(document);

            // Call Ollama Vision API with qwen3-vl:8b for text extraction
            const prompt = this._buildVisualOcrPrompt(metadata);

            const response = await this.ollamaService._callOllamaVisionAPI(
                prompt,
                imageBase64,
                {
                    model: this.config.visualOcr.model,
                    temperature: 0.1,  // Low temperature for accurate extraction
                    num_predict: 2048  // Allow sufficient tokens for text extraction
                }
            );

            if (!response || !response.response) {
                throw new Error('Empty response from visual OCR model');
            }

            // Extract text from response
            const extractedText = this._parseVisualOcrResponse(response.response);

            return {
                text: extractedText,
                model: this.config.visualOcr.model,
                confidence: this._estimateOcrConfidence(extractedText)
            };
        };

        // Execute with circuit breaker protection
        const result = await this.circuitBreakers.visualOcr.execute(operation);

        if (result.success) {
            logger.debug({
                event: 'visual_ocr_track_success',
                documentId: document.id || document.filename,
                textLength: result.data.text.length,
                confidence: result.data.confidence
            });

            return {
                success: true,
                data: result.data,
                track: 'visual-ocr'
            };
        } else {
            logger.warn({
                event: 'visual_ocr_track_failed',
                documentId: document.id || document.filename,
                error: result.error.message,
                circuitState: result.circuitState
            });

            return {
                success: false,
                error: result.error.message,
                circuitState: result.circuitState,
                track: 'visual-ocr'
            };
        }
    }

    /**
     * Track 2: Execute Tesseract OCR from Paperless-ngx API
     * @private
     */
    async _executeTesseractOcrTrack(document, metadata) {
        logger.debug({
            event: 'tesseract_ocr_track_start',
            documentId: document.id || document.filename
        });

        const operation = async () => {
            // Initialize Paperless service
            paperlessService.initialize();

            if (!paperlessService.client) {
                throw new Error('Paperless service not initialized');
            }

            // Fetch document data from Paperless API
            const documentId = document.id;
            if (!documentId) {
                throw new Error('Document ID required for Tesseract OCR fetch');
            }

            const response = await paperlessService.client.get(`/documents/${documentId}/`);

            if (!response || !response.data) {
                throw new Error('Empty response from Paperless API');
            }

            // Extract OCR content from Paperless document
            const content = response.data.content || '';
            const documentType = this._inferDocumentType(response.data);

            return {
                text: content,
                source: 'paperless-tesseract',
                documentType,
                metadata: {
                    title: response.data.title,
                    created: response.data.created,
                    modified: response.data.modified,
                    pageCount: response.data.page_count
                }
            };
        };

        // Execute with circuit breaker protection
        const result = await this.circuitBreakers.tesseractOcr.execute(operation);

        if (result.success) {
            logger.debug({
                event: 'tesseract_ocr_track_success',
                documentId: document.id || document.filename,
                textLength: result.data.text.length,
                documentType: result.data.documentType
            });

            return {
                success: true,
                data: result.data,
                track: 'tesseract-ocr'
            };
        } else {
            logger.warn({
                event: 'tesseract_ocr_track_failed',
                documentId: document.id || document.filename,
                error: result.error.message,
                circuitState: result.circuitState
            });

            return {
                success: false,
                error: result.error.message,
                circuitState: result.circuitState,
                track: 'tesseract-ocr'
            };
        }
    }

    /**
     * Track 3: Execute Visual Element Detection via Visual RAG sidecar
     * @private
     */
    async _executeVisualElementsTrack(document, metadata) {
        logger.debug({
            event: 'visual_elements_track_start',
            documentId: document.id || document.filename
        });

        const operation = async () => {
            // Prepare image for Visual RAG sidecar
            const imageBase64 = await this._prepareImageForSidecar(document);

            // Call Visual RAG sidecar for element detection
            const response = await axios.post(
                `${this.config.visualElements.url}/detect_elements`,
                {
                    image: imageBase64,
                    detect_types: ['tables', 'images', 'figures', 'text_blocks', 'zones']
                },
                {
                    timeout: this.config.visualElements.timeout,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response || !response.data) {
                throw new Error('Empty response from Visual RAG sidecar');
            }

            return {
                elements: response.data.elements || [],
                layout: response.data.layout || {},
                confidence: response.data.confidence || 0.5
            };
        };

        // Execute with circuit breaker protection
        const result = await this.circuitBreakers.visualElements.execute(operation);

        if (result.success) {
            logger.debug({
                event: 'visual_elements_track_success',
                documentId: document.id || document.filename,
                elementCount: result.data.elements.length,
                confidence: result.data.confidence
            });

            return {
                success: true,
                data: result.data,
                track: 'visual-elements'
            };
        } else {
            logger.warn({
                event: 'visual_elements_track_failed',
                documentId: document.id || document.filename,
                error: result.error.message,
                circuitState: result.circuitState
            });

            return {
                success: false,
                error: result.error.message,
                circuitState: result.circuitState,
                track: 'visual-elements'
            };
        }
    }

    /**
     * Reconcile OCR results from Visual OCR and Tesseract
     *
     * Uses document-type-aware selection:
     * - Medical: Prefer visual OCR for structured forms
     * - Financial: Prefer visual OCR for tables/numbers
     * - Legal: Prefer Tesseract for text-heavy documents
     * - General: Quality-based selection
     *
     * @private
     */
    async _reconcileOcrResults(visualOcrResult, tesseractOcrResult, metadata) {
        const documentType = metadata.documentType || DocumentType.GENERAL;

        // If only one source succeeded, use that
        if (visualOcrResult.success && !tesseractOcrResult.success) {
            logger.info({
                event: 'ocr_reconciliation_single_source',
                source: 'visual-ocr',
                reason: 'tesseract_failed'
            });

            return {
                success: true,
                text: visualOcrResult.data.text,
                source: 'visual-ocr',
                confidence: visualOcrResult.data.confidence,
                reconciliation: {
                    strategy: 'single-source',
                    conflict: false
                }
            };
        }

        if (tesseractOcrResult.success && !visualOcrResult.success) {
            logger.info({
                event: 'ocr_reconciliation_single_source',
                source: 'tesseract-ocr',
                reason: 'visual_failed'
            });

            return {
                success: true,
                text: tesseractOcrResult.data.text,
                source: 'tesseract-ocr',
                confidence: 0.8, // Default confidence for Tesseract
                reconciliation: {
                    strategy: 'single-source',
                    conflict: false
                }
            };
        }

        // If both failed, return error
        if (!visualOcrResult.success && !tesseractOcrResult.success) {
            logger.error({
                event: 'ocr_reconciliation_all_failed',
                visualError: visualOcrResult.error,
                tesseractError: tesseractOcrResult.error
            });

            return {
                success: false,
                text: '',
                source: 'none',
                error: 'All OCR tracks failed',
                reconciliation: {
                    strategy: 'none',
                    conflict: false
                }
            };
        }

        // Both sources succeeded - reconcile based on document type and quality
        const visualText = visualOcrResult.data.text;
        const tesseractText = tesseractOcrResult.data.text;

        // Document-type-aware biasing
        const reconciliationOptions = { ...this.config.reconciliation };

        switch (documentType) {
            case DocumentType.MEDICAL:
                // Medical documents: prefer visual OCR for structured forms
                reconciliationOptions.preferVisual = true;
                reconciliationOptions.fallbackStrategy = 'visual';
                break;

            case DocumentType.FINANCIAL:
                // Financial documents: prefer visual OCR for tables and numbers
                reconciliationOptions.preferVisual = true;
                reconciliationOptions.fallbackStrategy = 'visual';
                break;

            case DocumentType.LEGAL:
                // Legal documents: prefer Tesseract for text-heavy content
                reconciliationOptions.preferVisual = false;
                reconciliationOptions.fallbackStrategy = 'paperless';
                break;

            case DocumentType.SCANNED:
                // Scanned documents: prefer visual OCR
                reconciliationOptions.preferVisual = true;
                reconciliationOptions.fallbackStrategy = 'visual';
                break;

            case DocumentType.DIGITAL:
                // Digital documents: prefer Tesseract (better text extraction)
                reconciliationOptions.preferVisual = false;
                reconciliationOptions.fallbackStrategy = 'paperless';
                break;

            case DocumentType.GENERAL:
            default:
                // General: use quality-based selection
                reconciliationOptions.preferVisual = true;
                reconciliationOptions.fallbackStrategy = 'paperless';
                break;
        }

        // Use existing mergeOcrResults utility
        const mergedResult = await mergeOcrResults(
            visualText,
            tesseractText,
            {
                ...reconciliationOptions,
                logMetrics: true
            }
        );

        // Calculate conflict rate
        const conflict = this._calculateConflictRate(visualText, tesseractText);
        if (conflict > 0.1) {
            this.stats.reconciliationConflicts++;
        }

        logger.info({
            event: 'ocr_reconciliation_complete',
            documentType,
            selectedSource: mergedResult.source,
            qualityScore: mergedResult.quality_score,
            conflictRate: conflict,
            visualLength: visualText.length,
            tesseractLength: tesseractText.length
        });

        return {
            success: true,
            text: mergedResult.text,
            source: mergedResult.source,
            confidence: mergedResult.quality_score,
            reconciliation: {
                strategy: 'document-type-aware',
                documentType,
                qualityScore: mergedResult.quality_score,
                conflictRate: conflict,
                visualLength: visualText.length,
                tesseractLength: tesseractText.length,
                preferredVisual: reconciliationOptions.preferVisual
            }
        };
    }

    /**
     * Prepare image for Ollama (base64 encoding)
     * @private
     */
    async _prepareImageForOllama(document) {
        if (document.imageBase64) {
            return document.imageBase64;
        }

        if (document.imagePath) {
            const fs = require('fs');
            const imageBuffer = fs.readFileSync(document.imagePath);
            return imageBuffer.toString('base64');
        }

        if (document.imageBuffer) {
            return document.imageBuffer.toString('base64');
        }

        throw new Error('No image data available for Visual OCR');
    }

    /**
     * Prepare image for Visual RAG sidecar
     * @private
     */
    async _prepareImageForSidecar(document) {
        // Same as Ollama for now
        return await this._prepareImageForOllama(document);
    }

    /**
     * Build prompt for Visual OCR extraction
     * @private
     */
    _buildVisualOcrPrompt(metadata) {
        const documentType = metadata.documentType || DocumentType.GENERAL;

        const basePrompt = 'Extract all visible text from this document. Preserve the layout and structure. Return only the extracted text, no additional commentary.';

        // Document-type specific prompts
        switch (documentType) {
            case DocumentType.MEDICAL:
                return `${basePrompt}\n\nThis is a medical document. Pay special attention to:\n- Patient information\n- Dates and numbers\n- Medical terminology\n- Form fields and checkboxes`;

            case DocumentType.FINANCIAL:
                return `${basePrompt}\n\nThis is a financial document. Pay special attention to:\n- Numbers and amounts\n- Dates\n- Tables and structured data\n- Account numbers and references`;

            case DocumentType.LEGAL:
                return `${basePrompt}\n\nThis is a legal document. Pay special attention to:\n- Headings and section numbers\n- Dates and signatures\n- Precise wording and punctuation`;

            default:
                return basePrompt;
        }
    }

    /**
     * Parse Visual OCR model response
     * @private
     */
    _parseVisualOcrResponse(response) {
        // Clean up the response (remove any model artifacts)
        let text = response.trim();

        // Remove common prefixes if present
        const prefixes = [
            'Here is the extracted text:',
            'Extracted text:',
            'The text reads:',
            'Text content:'
        ];

        for (const prefix of prefixes) {
            if (text.toLowerCase().startsWith(prefix.toLowerCase())) {
                text = text.substring(prefix.length).trim();
            }
        }

        return text;
    }

    /**
     * Estimate OCR confidence based on text characteristics
     * @private
     */
    _estimateOcrConfidence(text) {
        if (!text || text.length === 0) {
            return 0;
        }

        let confidence = 0.5; // Base confidence

        // Length check
        if (text.length > 100) confidence += 0.1;
        if (text.length > 500) confidence += 0.1;

        // Structure check (line breaks indicate preserved layout)
        if (/\n.*\n/.test(text)) confidence += 0.1;

        // Quality check (no garbage characters)
        if (!/[^\x20-\x7E\n\r\t\xC0-\xFF]/.test(text.substring(0, 500))) {
            confidence += 0.1;
        }

        // Alphanumeric check
        if (/[a-zA-Z0-9]/.test(text)) confidence += 0.1;

        return Math.min(confidence, 1.0);
    }

    /**
     * Infer document type from Paperless metadata
     * @private
     */
    _inferDocumentType(paperlessDocument) {
        const tags = paperlessDocument.tags || [];
        const title = (paperlessDocument.title || '').toLowerCase();

        // Check tags first
        if (tags.some(tag => /medical|health|patient/i.test(tag))) {
            return DocumentType.MEDICAL;
        }
        if (tags.some(tag => /financial|invoice|receipt|bank/i.test(tag))) {
            return DocumentType.FINANCIAL;
        }
        if (tags.some(tag => /legal|contract|agreement/i.test(tag))) {
            return DocumentType.LEGAL;
        }

        // Check title
        if (/medical|health|patient|doctor/i.test(title)) {
            return DocumentType.MEDICAL;
        }
        if (/invoice|receipt|bank|financial|payment/i.test(title)) {
            return DocumentType.FINANCIAL;
        }
        if (/contract|agreement|legal|law/i.test(title)) {
            return DocumentType.LEGAL;
        }

        return DocumentType.GENERAL;
    }

    /**
     * Calculate conflict rate between two OCR sources
     * @private
     */
    _calculateConflictRate(text1, text2) {
        if (!text1 || !text2) {
            return 0;
        }

        // Simple length-based conflict metric
        const lengthRatio = Math.abs(text1.length - text2.length) / Math.max(text1.length, text2.length, 1);

        // Character overlap check (simplified)
        const chars1 = new Set(text1.toLowerCase().split(''));
        const chars2 = new Set(text2.toLowerCase().split(''));
        const intersection = new Set([...chars1].filter(c => chars2.has(c)));
        const union = new Set([...chars1, ...chars2]);
        const charOverlap = intersection.size / union.size;

        // Combine metrics
        const conflict = (lengthRatio * 0.5) + ((1 - charOverlap) * 0.5);

        return Math.min(conflict, 1.0);
    }

    /**
     * Get executor statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            circuitBreakerStates: {
                visualOcr: this.circuitBreakers.visualOcr.getState(),
                tesseractOcr: this.circuitBreakers.tesseractOcr.getState(),
                visualElements: this.circuitBreakers.visualElements.getState()
            },
            circuitBreakerStats: {
                visualOcr: this.circuitBreakers.visualOcr.getStats(),
                tesseractOcr: this.circuitBreakers.tesseractOcr.getStats(),
                visualElements: this.circuitBreakers.visualElements.getStats()
            }
        };
    }

    /**
     * Reset all circuit breakers
     * Useful for testing or manual recovery
     */
    resetCircuitBreakers() {
        this.circuitBreakers.visualOcr.reset();
        this.circuitBreakers.tesseractOcr.reset();
        this.circuitBreakers.visualElements.reset();

        logger.info({
            event: 'circuit_breakers_reset',
            executor: 'parallel-ocr'
        });
    }

    /**
     * Check health of all circuit breakers
     * @returns {boolean} True if all circuits are healthy
     */
    isHealthy() {
        return (
            this.circuitBreakers.visualOcr.isHealthy() &&
            this.circuitBreakers.tesseractOcr.isHealthy() &&
            this.circuitBreakers.visualElements.isHealthy()
        );
    }
}

module.exports = {
    ParallelOcrExecutor,
    DocumentType,
    DEFAULT_CONFIG
};
