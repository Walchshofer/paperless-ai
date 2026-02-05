/**
 * Visual RAG Services Index
 *
 * Exports all visual RAG components for the Council of Experts architecture.
 *
 * Components:
 * - VisualSearchClient: Client for Tomoro/ColQwen sidecar
 * - VisualOverlayRepository: PostgreSQL storage for bounding boxes
 * - OverlayExtractor: Qwen3-VL bounding box detection
 * - IngestionManager: Dual-path ingestion orchestrator
 * - HybridSearchService: Combined visual + text search with RRF fusion
 * - FieldProfiler: Field set selection for extraction
 * - PDFRenderer: High-resolution PDF to image conversion
 */

const { VisualSearchClient, visualSearchClient } = require('./VisualSearchClient');
const { VisualIndexer, visualIndexer } = require('./VisualIndexer');
const { VisualOverlayRepository, visualOverlayRepository } = require('./VisualOverlayRepository');
const { OverlayExtractor, overlayExtractor, BOUNDING_BOX_PROMPT, DOMAIN_PROMPTS } = require('./OverlayExtractor');
const { IngestionManager, ingestionManager } = require('./IngestionManager');
const { HybridSearchService, hybridSearchService } = require('./HybridSearchService');
const { DomainResolver, domainResolver, DOMAIN_TYPES } = require('./DomainResolver');
const { OverlayRefiner, overlayRefiner, EXPERT_MODELS, LABEL_REFINEMENTS } = require('./OverlayRefiner');
const { BatchIngestionJob, createBatchJob } = require('./BatchIngestionJob');
const { PDFRenderer, pdfRenderer } = require('./PDFRenderer');
const { ImageNormalizer } = require('./ImageNormalizer');
const FieldProfiler = require('./FieldProfiler');
const overlayConfig = require('./overlayConfig');

module.exports = {
    // Classes
    VisualSearchClient,
    VisualIndexer,
    VisualOverlayRepository,
    OverlayExtractor,
    IngestionManager,
    HybridSearchService,
    DomainResolver,
    OverlayRefiner,
    BatchIngestionJob,
    PDFRenderer,
    ImageNormalizer,
    FieldProfiler,

    // Singleton instances
    visualSearchClient,
    visualIndexer,
    visualOverlayRepository,
    overlayExtractor,
    ingestionManager,
    hybridSearchService,
    domainResolver,
    overlayRefiner,
    pdfRenderer,

    // Factory functions
    createBatchJob,

    // Configuration
    overlayConfig,

    // Constants
    BOUNDING_BOX_PROMPT,
    DOMAIN_PROMPTS,
    DOMAIN_TYPES,
    EXPERT_MODELS,
    LABEL_REFINEMENTS
};
