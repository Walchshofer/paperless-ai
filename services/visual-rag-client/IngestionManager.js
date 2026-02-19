/**
 * IngestionManager.js
 *
 * Dual-Path Ingestion Service for the Council of Experts Architecture.
 * Coordinates visual indexing (Tomoro Sidecar) and overlay extraction (Qwen3-VL).
 *
 * Architecture Reference: PROMPT-003 (Dual-Path Ingestion Service)
 *
 * Ingestion Flow:
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │                        INGESTION MANAGER                             │
 * │                                                                      │
 * │  Document → ┬─→ [Path 1: Visual Index] → Tomoro Sidecar → Search    │
 * │             │                                                        │
 * │             └─→ [Path 2: Overlay Data] → Qwen3-VL → PostgreSQL      │
 * │                                                                      │
 * │  Both paths execute in parallel for optimal performance              │
 * └──────────────────────────────────────────────────────────────────────┘
 */

const logger = require('../logger');
const config = require('../../config/config');
const { visualSearchClient } = require('./VisualSearchClient');
const { visualIndexer } = require('./VisualIndexer');
const { overlayExtractor } = require('./OverlayExtractor');
const { visualOverlayRepository } = require('./VisualOverlayRepository');
const { hybridSearchService } = require('./HybridSearchService');
const { domainResolver } = require('./DomainResolver');
const { overlayRefiner } = require('./OverlayRefiner');
const { pdfRenderer } = require('./PDFRenderer');
const paperlessService = require('../paperlessService');

class IngestionManager {
    constructor(options = {}) {
        this.visualSearchClient = options.visualSearchClient || visualSearchClient;
        this.visualIndexer = options.visualIndexer || visualIndexer;
        this.overlayExtractor = options.overlayExtractor || overlayExtractor;
        this.overlayRepository = options.overlayRepository || visualOverlayRepository;
        this.hybridSearchService = options.hybridSearchService || hybridSearchService;
        this.domainResolver = options.domainResolver || domainResolver;
        this.overlayRefiner = options.overlayRefiner || overlayRefiner;
        this.pdfRenderer = options.pdfRenderer || pdfRenderer;
        this.paperlessService = options.paperlessService || paperlessService;

        // Configuration
        this.enableVisualIndex = options.enableVisualIndex ?? true;
        this.enableOverlayExtraction = options.enableOverlayExtraction ?? true;
        this.enableDomainAutoDetection = options.enableDomainAutoDetection ?? true;
        this.enableExpertRefinement = options.enableExpertRefinement ?? true;
        this.parallelIngestion = options.parallelIngestion ?? true;
        this.indexAllPages = options.indexAllPages ?? true;

        // Statistics
        this.stats = {
            documentsIngested: 0,
            visualIndexSuccesses: 0,
            visualIndexFailures: 0,
            overlayExtractionSuccesses: 0,
            overlayExtractionFailures: 0,
            totalOverlaysExtracted: 0
        };
    }

    /**
     * Ingest a document through both paths
     * @param {number} docId - Paperless document ID
     * @param {string} pdfPath - Path to PDF (relative to /media/paperless)
     * @param {Object} options - Ingestion options
     * @param {string} options.domain - Document domain (medical, financial, legal) - auto-detected if not provided
     * @param {Array<string>} options.base64Images - Pre-rendered page images for overlay extraction
     * @param {Object} options.metadata - Additional metadata for indexing
     * @param {boolean} options.fetchOcrText - Fetch OCR text from paperless-ngx (default: true)
     * @returns {Promise<Object>} Ingestion result
     */
    async ingestDocument(docId, pdfPath, options = {}) {
        const startTime = Date.now();
        let { domain, base64Images, metadata = {}, fetchOcrText = true } = options;

        logger.info(`[IngestionManager] Starting dual-path ingestion for doc ${docId}: ${pdfPath}`);

        // Fetch OCR text from paperless-ngx if enabled
        let ocrText = null;
        if (fetchOcrText) {
            ocrText = await this._fetchOcrText(docId);
        }

        // Auto-resolve domain if not explicitly provided
        if (!domain && this.enableDomainAutoDetection) {
            try {
                domain = await this.domainResolver.resolveDomain(docId, {
                    documentType: metadata.documentType,
                    tags: metadata.tags,
                    content: ocrText,
                    classificationResult: metadata.classificationResult
                });
                logger.info(`[IngestionManager] Auto-resolved domain: ${domain} for doc ${docId}`);
            } catch (err) {
                logger.warn(`[IngestionManager] Domain resolution failed: ${err.message}, using 'general'`);
                domain = 'general';
            }
        }

        // Default to general if still not set
        domain = domain || 'general';

        // Enrich metadata with OCR text (truncated for embedding context)
        const enrichedMetadata = {
            ...metadata,
            domain,
            ocrText: ocrText ? ocrText.substring(0, 2000) : null,
            ocrTextLength: ocrText ? ocrText.length : 0
        };

        const result = {
            docId,
            pdfPath,
            domain,
            visualIndex: { success: false, error: null },
            overlayExtraction: { success: false, overlayCount: 0, error: null },
            ocrText: { available: !!ocrText, length: ocrText?.length || 0 },
            duration: 0
        };

        // Prepare tasks
        const tasks = [];

        // Path 1: Visual Index (Tomoro Sidecar)
        if (this.enableVisualIndex) {
            tasks.push(
                this._indexVisually(docId, pdfPath, enrichedMetadata, base64Images)
                    .then(indexResult => {
                        result.visualIndex = indexResult;
                    })
                    .catch(error => {
                        result.visualIndex = { success: false, error: error.message };
                    })
            );
        }

        // Path 2: Overlay Extraction (Qwen3-VL → PostgreSQL) with Expert Refinement
        if (this.enableOverlayExtraction && base64Images && base64Images.length > 0) {
            tasks.push(
                this._extractAndSaveOverlays(docId, base64Images, domain, {
                    ocrText,
                    documentType: metadata.documentType
                })
                    .then(overlayResult => {
                        result.overlayExtraction = overlayResult;
                    })
                    .catch(error => {
                        result.overlayExtraction = { success: false, overlayCount: 0, error: error.message };
                    })
            );
        }

        // Execute paths
        if (this.parallelIngestion) {
            await Promise.all(tasks);
        } else {
            for (const task of tasks) {
                await task;
            }
        }

        // Path 3: Expert Knowledge Storage (enhanced OCR + metadata)
        if (options.enhancedOcrText || options.expertMetadata) {
            try {
                await this._storeExpertKnowledge(docId, {
                    enhancedOcrText: options.enhancedOcrText,
                    expertMetadata: options.expertMetadata,
                    domain: domain,
                    domainView: this._buildDomainView(options, domain)
                });
                result.expertKnowledge = { success: true };
                logger.info(`[IngestionManager] Expert knowledge stored for doc ${docId}`);
            } catch (error) {
                result.expertKnowledge = { success: false, error: error.message };
                logger.warn(`[IngestionManager] Expert knowledge storage failed: ${error.message}`);
            }
        }

        result.duration = Date.now() - startTime;
        this.stats.documentsIngested++;

        logger.info(`[IngestionManager] Ingestion complete for doc ${docId} in ${result.duration}ms`);
        logger.debug(`[IngestionManager] Result: ${JSON.stringify(result)}`);

        return result;
    }

    /**
     * Persist expert knowledge metadata without running index/extraction paths.
     *
     * @param {number} docId - Paperless document ID
     * @param {Object} options - Expert metadata payload
     * @returns {Promise<{success:boolean,error?:string}>}
     */
    async storeExpertKnowledge(docId, options = {}) {
        if (!docId) {
            return { success: false, error: 'document_id_required' };
        }

        const domain = options.domain || 'general';
        const payload = {
            enhancedOcrText: options.enhancedOcrText || '',
            expertMetadata: options.expertMetadata || {},
            domain,
            domainView: options.domainView || this._buildDomainView(options, domain)
        };

        try {
            await this._storeExpertKnowledge(docId, payload);
            return { success: true };
        } catch (error) {
            logger.warn({
                event: 'store_expert_knowledge_failed',
                docId,
                error: error.message
            });
            return { success: false, error: error.message };
        }
    }

    /**
     * Path 1: Index document visually via sidecar
     * @private
     */
    async _indexVisually(docId, pdfPath, metadata, base64Images = null) {
        try {
            // Check if sidecar is available
            const available = await this.visualSearchClient.isAvailable();
            if (!available) {
                logger.warn(`[IngestionManager] Visual sidecar not available, skipping visual indexing`);
                return { success: false, error: 'Sidecar not available', skipped: true };
            }

            const indexImages = await this._resolveIndexImages(
                docId,
                base64Images,
                metadata
            );
            if (!Array.isArray(indexImages) || indexImages.length === 0) {
                throw new Error('No page images available for visual indexing');
            }

            const indexResult = await this.visualIndexer.indexDocument(
                docId,
                indexImages,
                metadata
            );

            this.stats.visualIndexSuccesses++;

            return {
                success: true,
                status: indexResult.status,
                document: indexResult.document,
                pagesIndexed: indexResult.pagesIndexed,
                indexingLatencyMs: indexResult.indexingLatencyMs,
                perPageLatencyMs: indexResult.perPageLatencyMs
            };
        } catch (error) {
            this.stats.visualIndexFailures++;
            logger.error(`[IngestionManager] Visual indexing failed for doc ${docId}: ${error.message}`);
            throw error;
        }
    }

    async _resolveIndexImages(docId, base64Images = null, metadata = {}) {
        const providedImages = Array.isArray(base64Images)
            ? base64Images.filter(i => typeof i === 'string' && i.length > 0)
            : [];

        if (!this.indexAllPages && providedImages.length > 0) {
            return providedImages;
        }

        const pageCount = Number.parseInt(
            String(metadata.page_count ?? metadata.pageCount ?? ''),
            10
        );
        if (providedImages.length > 0 &&
            Number.isInteger(pageCount) &&
            pageCount > 0 &&
            providedImages.length >= pageCount) {
            return providedImages;
        }

        const renderedImages = await this._renderAllPagesForIndex(docId);
        if (renderedImages.length > 0) {
            return renderedImages;
        }

        return providedImages;
    }

    async _renderAllPagesForIndex(docId) {
        try {
            if (!(await this.pdfRenderer.isAvailableAsync())) {
                return [];
            }

            const [docMeta, originalPdf] = await Promise.all([
                this.paperlessService.getDocument(docId),
                this.paperlessService.downloadOriginalDocument(docId)
            ]);

            const pdfBuffer = originalPdf ||
                await this.paperlessService.downloadDocument(docId);
            if (!pdfBuffer) {
                return [];
            }

            const pageCount = Number.parseInt(
                String(docMeta?.page_count ?? docMeta?.pageCount ?? ''),
                10
            );
            const renderOptions = {
                dpi: config.visualRag?.visionRenderDpi,
                docId: `universal-index-${docId}`
            };
            if (Number.isInteger(pageCount) && pageCount > 0) {
                renderOptions.maxPages = pageCount;
            }

            const pages = await this.pdfRenderer.renderBuffer(
                pdfBuffer,
                renderOptions
            );
            const images = pages
                .map(page => page.base64)
                .filter(value => typeof value === 'string' && value.length > 0);

            if (images.length > 0) {
                logger.info({
                    event: 'visual_index_full_render_complete',
                    docId,
                    pagesRendered: images.length
                });
            }

            return images;
        } catch (error) {
            logger.warn({
                event: 'visual_index_full_render_failed',
                docId,
                error: error.message
            });
            return [];
        }
    }

    /**
     * Path 2: Extract overlays and save to PostgreSQL
     * @private
     */
    async _extractAndSaveOverlays(docId, base64Images, domain, context = {}) {
        try {
            // First, delete any existing overlays for this document
            const repoAvailable = await this.overlayRepository.isAvailable();
            if (repoAvailable) {
                await this.overlayRepository.deleteByDocId(docId);
            }

            // Extract overlays from all pages
            let overlays = await this.overlayExtractor.extractOverlaysMultiPage(base64Images, {
                domain
            });

            // Unload vision model to free VRAM for other operations
            await this.overlayExtractor.unloadModel();

            if (overlays.length === 0) {
                logger.debug(`[IngestionManager] No overlays detected for doc ${docId}`);
                return { success: true, overlayCount: 0, refined: false };
            }

            // Apply expert refinement if enabled
            let refinementApplied = false;
            if (this.enableExpertRefinement && domain !== 'general') {
                try {
                    overlays = await this.overlayRefiner.refineOverlays(overlays, domain, {
                        ocrText: context.ocrText,
                        documentType: context.documentType
                    });
                    refinementApplied = true;
                    logger.info(`[IngestionManager] Expert refinement applied for doc ${docId} (${domain})`);
                } catch (refineError) {
                    logger.warn(`[IngestionManager] Expert refinement failed, using raw overlays: ${refineError.message}`);
                }
            }

            // Save to PostgreSQL if available
            if (repoAvailable) {
                const overlayRecords = overlays.map(o => ({
                    pageNumber: o.pageNumber,
                    overlayData: {
                        label: o.label,
                        originalLabel: o.originalLabel,
                        box: o.box,
                        confidence: o.confidence,
                        text: o.text,
                        refined: o.refined,
                        expertValidated: o.expertValidated,
                        refinementSource: o.refinementSource
                    },
                    semanticLabel: o.label
                }));

                await this.overlayRepository.saveOverlays(docId, overlayRecords);

                logger.info(`[IngestionManager] Saved ${overlays.length} overlays for doc ${docId}`);
            } else {
                logger.warn(`[IngestionManager] PostgreSQL not available, overlays not persisted`);
            }

            this.stats.overlayExtractionSuccesses++;
            this.stats.totalOverlaysExtracted += overlays.length;

            return {
                success: true,
                overlayCount: overlays.length,
                overlays: overlays,
                refined: refinementApplied,
                refinementStats: refinementApplied ? this.overlayRefiner.getStats() : null
            };
        } catch (error) {
            this.stats.overlayExtractionFailures++;
            logger.error(`[IngestionManager] Overlay extraction failed for doc ${docId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Fetch OCR text from paperless-ngx
     * @param {number} docId - Paperless document ID
     * @returns {Promise<string|null>} OCR text or null if unavailable
     * @private
     */
    async _fetchOcrText(docId) {
        try {
            const content = await this.paperlessService.getDocumentContent(docId);

            if (content && typeof content === 'string' && content.length > 0) {
                logger.debug(`[IngestionManager] Fetched OCR text for doc ${docId}: ${content.length} chars`);
                return content;
            }

            logger.debug(`[IngestionManager] No OCR text available for doc ${docId}`);
            return null;
        } catch (error) {
            logger.warn(`[IngestionManager] Failed to fetch OCR text for doc ${docId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Path 3: Store expert knowledge (enhanced OCR + metadata)
     * @param {number} docId - Paperless document ID
     * @param {Object} knowledge - Expert knowledge to store
     * @private
     */
    async _storeExpertKnowledge(docId, knowledge) {
        const repoAvailable = await this.overlayRepository.isAvailable();
        if (!repoAvailable) {
            throw new Error('PostgreSQL not available for expert knowledge storage');
        }

        // Ensure enhanced schema columns exist
        await this.overlayRepository.ensureEnhancedSchema();

        const { enhancedOcrText, expertMetadata = {}, domain, domainView = {} } = knowledge;

        // Build domain signals from expert metadata
        const domainSignals = this._extractDomainSignals(expertMetadata, domain);

        // Calculate quality score based on content
        const qualityScore = this._calculateQualityScore(enhancedOcrText, expertMetadata);

        // Build routing weights for MoE
        const routingWeights = this._buildRoutingWeights(domain, expertMetadata);

        await this.overlayRepository.saveExpertKnowledge(docId, {
            enhancedOcrText: enhancedOcrText || '',
            expertMetadata,
            domainView,
            domainSignals,
            qualityScore,
            routingWeights
        });
    }

    /**
     * Build task-oriented domain view based on expert analysis
     * @param {Object} options - Ingestion options with expert metadata
     * @param {string} domain - Document domain
     * @returns {Object} Domain view structure
     * @private
     */
    _buildDomainView(options, domain) {
        const expertMetadata = options.expertMetadata || {};

        return {
            domain,
            viewType: `${domain}_analysis`,
            keyFields: expertMetadata.key_entities || [],
            searchableText: (options.enhancedOcrText || '').substring(0, 5000),
            documentType: expertMetadata.document_type || 'unknown',
            confidence: expertMetadata.confidence || 0,
            extractionQuality: expertMetadata.extraction_quality || 'unknown'
        };
    }

    /**
     * Extract domain signals from expert metadata for MoE filtering
     * @param {Object} expertMetadata - Expert analysis results
     * @param {string} domain - Document domain
     * @returns {Array<string>} Domain signals array
     * @private
     */
    _extractDomainSignals(expertMetadata, domain) {
        const signals = [domain];

        // Add document type
        if (expertMetadata.document_type) {
            signals.push(`doctype:${expertMetadata.document_type}`);
        }

        // Add domain-specific signals
        if (expertMetadata.domain_signals && Array.isArray(expertMetadata.domain_signals)) {
            signals.push(...expertMetadata.domain_signals);
        }

        // Add key entities as signals
        if (expertMetadata.key_entities && Array.isArray(expertMetadata.key_entities)) {
            signals.push(...expertMetadata.key_entities.map(e => `entity:${e}`));
        }

        // Add quality signal
        if (expertMetadata.extraction_quality === 'high') {
            signals.push('high_quality');
        }

        // Add review flag
        if (expertMetadata.requires_review) {
            signals.push('needs_review');
        }

        return [...new Set(signals)]; // Deduplicate
    }

    /**
     * Calculate quality score for retrieval filtering
     * @param {string} enhancedOcrText - Extracted text
     * @param {Object} expertMetadata - Expert metadata
     * @returns {number} Quality score 0.0-1.0
     * @private
     */
    _calculateQualityScore(enhancedOcrText, expertMetadata) {
        let score = 0;

        // Text content score (0.4 max)
        const textLength = (enhancedOcrText || '').length;
        if (textLength > 100) score += 0.1;
        if (textLength > 500) score += 0.15;
        if (textLength > 1000) score += 0.15;

        // Confidence score (0.3 max)
        const confidence = expertMetadata.confidence || 0;
        score += confidence * 0.3;

        // Extraction quality (0.2 max)
        const quality = expertMetadata.extraction_quality;
        if (quality === 'high') score += 0.2;
        else if (quality === 'medium') score += 0.1;

        // Completeness (0.1 max)
        if (expertMetadata.key_entities && expertMetadata.key_entities.length > 0) {
            score += 0.05;
        }
        if (expertMetadata.summary) {
            score += 0.05;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Build expert routing weights for MoE reranking
     * @param {string} domain - Document domain
     * @param {Object} expertMetadata - Expert metadata
     * @returns {Object} Routing weights by domain
     * @private
     */
    _buildRoutingWeights(domain, expertMetadata) {
        const weights = {
            financial: 0.0,
            medical: 0.0,
            legal: 0.0,
            general: 0.5  // Base weight for all
        };

        // Set primary domain weight based on confidence
        const confidence = expertMetadata.confidence || 0.5;
        if (Object.hasOwn(weights, domain)) {
            weights[domain] = confidence;
        }

        // Boost weights for domain signals
        const domainSignals = expertMetadata.domain_signals || [];
        if (domainSignals.includes('VAT_applicable') || domainSignals.includes('invoice')) {
            weights.financial = Math.max(weights.financial, 0.8);
        }
        if (domainSignals.includes('medical_record') || domainSignals.includes('prescription')) {
            weights.medical = Math.max(weights.medical, 0.8);
        }
        if (domainSignals.includes('contract') || domainSignals.includes('legal_agreement')) {
            weights.legal = Math.max(weights.legal, 0.8);
        }

        return weights;
    }

    /**
     * Get expert knowledge for a document
     * @param {number} docId - Paperless document ID
     * @returns {Promise<Object|null>} Expert knowledge or null
     */
    async getExpertKnowledge(docId) {
        return this.overlayRepository.getExpertKnowledge(docId);
    }

    /**
     * Find documents by domain signals (MoE filtering)
     * @param {Array<string>} signals - Domain signals to match
     * @param {Object} options - Query options
     * @returns {Promise<Array<Object>>} Matching documents
     */
    async findByDomainSignals(signals, options = {}) {
        return this.overlayRepository.findByDomainSignals(signals, options);
    }

    /**
     * Batch ingest multiple documents
     * @param {Array<Object>} documents - Array of {docId, pdfPath, options}
     * @param {Object} batchOptions - Batch processing options
     * @returns {Promise<Array<Object>>} Array of ingestion results
     */
    async ingestBatch(documents, batchOptions = {}) {
        const { concurrency = 2 } = batchOptions;
        const results = [];

        logger.info(`[IngestionManager] Starting batch ingestion of ${documents.length} documents`);

        // Process in chunks to limit concurrency
        for (let i = 0; i < documents.length; i += concurrency) {
            const chunk = documents.slice(i, i + concurrency);

            const chunkResults = await Promise.all(
                chunk.map(doc =>
                    this.ingestDocument(doc.docId, doc.pdfPath, doc.options || {})
                        .catch(error => ({
                            docId: doc.docId,
                            pdfPath: doc.pdfPath,
                            error: error.message,
                            success: false
                        }))
                )
            );

            results.push(...chunkResults);
        }

        logger.info(`[IngestionManager] Batch ingestion complete: ${results.length} documents processed`);

        return results;
    }

    /**
     * Get overlays for a document from PostgreSQL
     * @param {number} docId - Paperless document ID
     * @returns {Promise<Array<Object>>} Overlay records
     */
    async getOverlays(docId) {
        const available = await this.overlayRepository.isAvailable();
        if (!available) {
            return [];
        }

        return this.overlayRepository.getByDocId(docId);
    }

    /**
     * Get overlays for a specific page
     * @param {number} docId - Paperless document ID
     * @param {number} pageNumber - Page number (1-indexed)
     * @returns {Promise<Array<Object>>} Overlay records
     */
    async getOverlaysForPage(docId, pageNumber) {
        const available = await this.overlayRepository.isAvailable();
        if (!available) {
            return [];
        }

        return this.overlayRepository.getByDocIdAndPage(docId, pageNumber);
    }

    /**
     * Search documents visually
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results with overlays
     */
    async visualSearch(query, options = {}) {
        const { k = 5, includeOverlays = true } = options;

        // Search via sidecar
        const searchResults = await this.visualSearchClient.searchWithFallback(query, { k });

        if (!searchResults) {
            return { query, results: [], totalResults: 0 };
        }

        // Enrich with overlays if requested
        if (includeOverlays && searchResults.results.length > 0) {
            for (const result of searchResults.results) {
                if (result.docId) {
                    result.overlays = await this.getOverlaysForPage(result.docId, result.pageNum);
                }
            }
        }

        return searchResults;
    }

    /**
     * Hybrid search combining visual and text results
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @param {number} options.k - Number of results (default: 5)
     * @param {boolean} options.includeOverlays - Include overlays in results (default: true)
     * @param {string} options.mode - Search mode: 'hybrid', 'visual', 'text' (default: 'hybrid')
     * @param {number} options.alpha - Legacy visual weight alias (0-1)
     * @returns {Promise<Object>} Search results with overlays
     */
    async hybridSearch(query, options = {}) {
        const { k = 5, includeOverlays = true, mode = 'hybrid', alpha } = options;

        let searchResults;

        switch (mode) {
            case 'visual':
                searchResults = await this.visualSearch(query, { k, includeOverlays: false });
                break;
            case 'text':
                searchResults = await this.hybridSearchService.textSearch(query, k);
                break;
            case 'hybrid':
            default:
                searchResults = await this.hybridSearchService.search(query, {
                    k,
                    alpha,
                    includeOverlays: false
                });
                break;
        }

        if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
            return { query, results: [], totalResults: 0, mode };
        }

        // Enrich with overlays if requested
        if (includeOverlays) {
            for (const result of searchResults.results) {
                if (result.docId && result.pageNum) {
                    result.overlays = await this.getOverlaysForPage(result.docId, result.pageNum);
                }
            }
        }

        return {
            ...searchResults,
            mode
        };
    }

    /**
     * Get ingestion statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            documentsIngested: 0,
            visualIndexSuccesses: 0,
            visualIndexFailures: 0,
            overlayExtractionSuccesses: 0,
            overlayExtractionFailures: 0,
            totalOverlaysExtracted: 0
        };
    }

    /**
     * Health check for all components
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const health = {
            visualSearchClient: false,
            overlayRepository: false,
            overlayExtractor: true,  // Always available if Ollama is running
            status: 'unavailable',
            model_loaded: false,
            initializing: false
        };

        try {
            const visualHealth = await this.visualSearchClient.health();
            const modelLoaded = Boolean(
                visualHealth?.model_loaded ??
                visualHealth?.init?.model_loaded
            );
            health.visualSearchClient = modelLoaded;
            health.model_loaded = modelLoaded;
            health.initializing = Boolean(
                visualHealth?.initializing ??
                visualHealth?.init?.initializing ??
                visualHealth?.status === 'initializing'
            );
            health.status = visualHealth?.status || (modelLoaded ? 'ok' : 'unavailable');
        } catch (error) {
            logger.debug(`[IngestionManager] Visual search client check failed: ${error.message}`);
            try {
                health.visualSearchClient = await this.visualSearchClient.isAvailable();
            } catch (fallbackError) {
                logger.debug(`[IngestionManager] Visual search availability fallback failed: ${fallbackError.message}`);
            }
            if (health.visualSearchClient) {
                health.status = 'ok';
                health.model_loaded = true;
            }
        }

        try {
            health.overlayRepository = await this.overlayRepository.isAvailable();
        } catch (error) {
            logger.debug(`[IngestionManager] Overlay repository check failed: ${error.message}`);
        }

        return health;
    }
}

// Export singleton and class
const ingestionManager = new IngestionManager();

module.exports = {
    IngestionManager,
    ingestionManager
};
