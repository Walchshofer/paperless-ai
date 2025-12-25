/**
 * DocumentProcessor.js
 * 
 * Main Integration Layer for Expert Model Pipeline.
 * Bridges the new expert pipeline system with existing paperless-ngx AI infrastructure.
 * 
 * Architecture Reference: Expert Model Pipeline Design, Section 6
 * Hardware Target: NVIDIA RTX 3090 Ti (24GB VRAM)
 * 
 * Integration Points:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                        DOCUMENT PROCESSOR                                   │
 * │                                                                             │
 * │  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
 * │  │  Paperless   │────▶│  Document    │────▶│   Expert     │               │
 * │  │  Webhook     │     │  Processor   │     │   Pipeline   │               │
 * │  └──────────────┘     └──────────────┘     └──────────────┘               │
 * │         │                    │                    │                        │
 * │         │                    ▼                    ▼                        │
 * │         │             ┌──────────────┐     ┌──────────────┐               │
 * │         │             │   Image      │     │   Result     │               │
 * │         │             │   Prep       │     │   Merger     │               │
 * │         └────────────▶└──────────────┘     └──────────────┘               │
 * │                              │                    │                        │
 * │                              ▼                    ▼                        │
 * │                       ┌──────────────────────────────────┐                │
 * │                       │         Ollama Service           │                │
 * │                       │  qwen3-vl:8b | llava-med | medtext│               │
 * │                       └──────────────────────────────────┘                │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * Model Configuration:
 * - Router: qwen3-vl:8b (multimodal)
 * - Medical Imaging: llava-med-v1.5:latest (multimodal)
 * - Medical Text: medtext-llama3:latest (text-only)
 * - General: sauerkraut-llama3.1:8b (text-only)
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../logger');
const config = require('../../config/config');

// Import Expert Pipeline components
const { promptRegistry, DomainType, ModelType } = require('../prompts/PromptRegistry');
const { registerMedicalPrompts } = require('../prompts/MedicalPrompts');
const { expertRegistry } = require('../experts/ExpertRegistry');
const { ExpertPipelineExecutor, processDocument } = require('../experts/ExpertPipelineExecutor');

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Document Processor Configuration
 * Extends existing config.js with expert pipeline settings
 */
const ProcessorConfig = {
    // Model selection
    models: {
        router: process.env.ROUTER_MODEL || config.ollama?.visionModel || 'qwen3-vl:8b',
        medicalImaging: process.env.MEDICAL_VISION_MODEL || config.expertModels?.medical?.vision || config.ollama?.visionModel || 'llava-med-v1.5',
        medicalText: process.env.MEDICAL_ANALYSIS_MODEL || config.expertModels?.medical?.analysis || config.ollama?.model || 'medtext-llama3',
        general: process.env.GENERAL_MODEL || config.ollama?.model || 'sauerkraut-llama3.1:8b',
        financeReasoning: process.env.FINANCIAL_ANALYSIS_MODEL || config.expertModels?.financial?.analysis || 'fino1-8b',
        financeGeneral: process.env.FINANCIAL_VISION_MODEL || config.expertModels?.financial?.vision || 'llm-pro-finance-8b'
    },

    
    // Processing modes
    modes: {
        EXPERT_PIPELINE: 'expert_pipeline',     // Full expert pipeline
        LEGACY_VISION: 'legacy_vision',         // Existing vision.js flow
        LEGACY_TEXT: 'legacy_text',             // Existing text.js flow
        HYBRID: 'hybrid'                        // Expert + legacy fallback
    },
    
    // Default processing mode
    defaultMode: process.env.PROCESSING_MODE || 'hybrid',
    
    // Image preparation settings (300 DPI target per design doc)
    image: {
        maxWidth: 2048,
        maxHeight: 2048,
        targetDpi: 300,
        format: 'png',
        quality: 95
    },
    
    // Confidence thresholds
    thresholds: {
        routerConfidence: 0.6,          // Minimum for trusting classification
        extractionConfidence: 0.7,      // Minimum for accepting extraction
        fallbackTrigger: 0.5            // Below this, trigger fallback
    },
    
    // Timeout settings (ms)
    timeouts: {
        router: 30000,
        extraction: 60000,
        integration: 30000,
        total: 180000
    },
    
    // Feature flags
    features: {
        enableExpertPipeline: process.env.ENABLE_EXPERT_PIPELINE !== 'false',
        enableMedicalPipeline: process.env.ENABLE_MEDICAL_PIPELINE !== 'false',
        enableMetricsLogging: process.env.ENABLE_METRICS !== 'false',
        enableFallbackToLegacy: process.env.ENABLE_LEGACY_FALLBACK !== 'false',
        enableVatRag: process.env.ENABLE_VAT_RAG !== 'false'
    },

    rag: {
        vatDir: process.env.VAT_RAG_DIR ||
            path.join(process.cwd(), 'data', 'austrian_vat'),
        maxResults: parseInt(process.env.VAT_RAG_MAX_RESULTS || '3', 10),
        maxExcerptChars: parseInt(process.env.VAT_RAG_MAX_EXCERPT_CHARS || '800', 10)
    }
};

// ============================================================================ 
// IMAGE PREPARATION
// ============================================================================ 

/**
 * InternalVatRag - Lightweight internal retrieval for VAT context
 *
 * NOTE: Output is for internal reasoning only and must not be disclosed to users.
 */
class InternalVatRag {
    static _cache = null;

    static async retrieveVatContext(query, options) {
        if (!query || !this._looksVatRelated(query)) {
            return { contextText: '', sources: [] };
        }

        const corpus = await this._loadCorpus(options.vatDir);
        if (!corpus.length) {
            return { contextText: '', sources: [] };
        }

        const keywords = this._extractKeywords(query);
        if (!keywords.length) {
            return { contextText: '', sources: [] };
        }

        const scored = corpus
            .map(doc => {
                const score = this._score(doc.contentLower, keywords);
                return { ...doc, score };
            })
            .filter(doc => doc.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, options.maxResults);

        if (scored.length === 0) {
            return { contextText: '', sources: [] };
        }

        const contextText = scored.map((doc, index) => {
            const excerpt = doc.content.slice(0, options.maxExcerptChars);
            return `Reference ${index + 1}:\n${excerpt}`;
        }).join('\n\n');

        return {
            contextText,
            sources: scored.map(doc => doc.relativePath)
        };
    }

    static async _loadCorpus(rootDir) {
        if (this._cache) {
            return this._cache;
        }

        try {
            const stats = await fs.stat(rootDir);
            if (!stats.isDirectory()) {
                this._cache = [];
                return this._cache;
            }
        } catch (error) {
            logger.debug('VAT RAG directory not found', { rootDir });
            this._cache = [];
            return this._cache;
        }

        const files = await this._collectFiles(rootDir);
        const corpus = [];

        for (const filePath of files) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                if (!content || !content.trim()) {
                    continue;
                }
                const relativePath = path.relative(rootDir, filePath);
                corpus.push({
                    relativePath,
                    content: content,
                    contentLower: content.toLowerCase()
                });
            } catch (error) {
                logger.debug('Skipping VAT RAG file', { filePath, error: error.message });
            }
        }

        this._cache = corpus;
        return corpus;
    }

    static async _collectFiles(rootDir) {
        const results = [];
        const entries = await fs.readdir(rootDir, { withFileTypes: true });
        const allowedExt = new Set(['.txt', '.md', '.json', '.csv']);

        for (const entry of entries) {
            const fullPath = path.join(rootDir, entry.name);
            if (entry.isDirectory()) {
                const nested = await this._collectFiles(fullPath);
                results.push(...nested);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (allowedExt.has(ext)) {
                    results.push(fullPath);
                }
            }
        }

        return results;
    }

    static _extractKeywords(text) {
        const tokens = String(text)
            .toLowerCase()
            .match(/[a-z0-9]{3,}/g);

        if (!tokens) {
            return [];
        }

        const seen = new Set();
        const keywords = [];
        for (const token of tokens) {
            if (!seen.has(token)) {
                seen.add(token);
                keywords.push(token);
            }
            if (keywords.length >= 25) {
                break;
            }
        }

        return keywords;
    }

    static _score(contentLower, keywords) {
        let score = 0;
        for (const keyword of keywords) {
            if (contentLower.includes(keyword)) {
                score += 1;
            }
        }
        return score;
    }

    static _looksVatRelated(text) {
        return /\b(vat|mwst|ust|umsatzsteuer|steuer|reverse charge|intrastat)\b/i
            .test(String(text));
    }
}

/**
 * ImagePreparator - Prepares document images for model consumption
 * 
 * Handles:
 * - Image loading from various sources
 * - Resolution normalization
 * - Base64 encoding for Ollama API
 * - Multi-page document handling
 */
class ImagePreparator {
    /**
     * Prepare image for model consumption
     * 
     * @param {string|Buffer} source - Image path, URL, or buffer
     * @param {Object} options - Preparation options
     * @returns {Object} Prepared image data
     */
    static async prepare(source, options = {}) {
        const config = { ...ProcessorConfig.image, ...options };
        
        let imageBuffer;
        let metadata = {};
        
        // Load image based on source type
        if (typeof source === 'string') {
            if (source.startsWith('http://') || source.startsWith('https://')) {
                imageBuffer = await this._loadFromUrl(source);
                metadata.source = 'url';
            } else if (source.startsWith('data:image')) {
                imageBuffer = this._loadFromBase64(source);
                metadata.source = 'base64';
            } else {
                imageBuffer = await this._loadFromFile(source);
                metadata.source = 'file';
                metadata.filename = path.basename(source);
            }
        } else if (Buffer.isBuffer(source)) {
            imageBuffer = source;
            metadata.source = 'buffer';
        } else {
            throw new Error('Invalid image source type');
        }
        
        // Get image dimensions (basic check without sharp dependency)
        metadata.size = imageBuffer.length;
        
        // Convert to base64 for Ollama
        const base64Image = imageBuffer.toString('base64');
        
        // Detect image type from buffer magic bytes
        metadata.format = this._detectImageFormat(imageBuffer);
        
        return {
            base64: base64Image,
            buffer: imageBuffer,
            metadata: metadata,
            dataUrl: `data:image/${metadata.format};base64,${base64Image}`
        };
    }
    
    /**
     * Load image from file path
     */
    static async _loadFromFile(filePath) {
        try {
            return await fs.readFile(filePath);
        } catch (error) {
            logger.error(`Failed to load image from file: ${filePath}`, error);
            throw new Error(`Image file not found or unreadable: ${filePath}`);
        }
    }
    
    /**
     * Load image from URL
     */
    static async _loadFromUrl(url) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            return Buffer.from(response.data);
        } catch (error) {
            logger.error(`Failed to load image from URL: ${url}`, error);
            throw new Error(`Failed to fetch image from URL: ${url}`);
        }
    }
    
    /**
     * Load image from base64 data URL
     */
    static _loadFromBase64(dataUrl) {
        const matches = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
        if (!matches) {
            throw new Error('Invalid base64 image data URL');
        }
        return Buffer.from(matches[1], 'base64');
    }
    
    /**
     * Detect image format from buffer magic bytes
     */
    static _detectImageFormat(buffer) {
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            return 'png';
        }
        if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
            return 'jpeg';
        }
        if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
            return 'gif';
        }
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            return 'webp';
        }
        if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
            return 'pdf';
        }
        return 'unknown';
    }
    
    /**
     * Prepare multiple pages from a multi-page document
     */
    static async prepareMultiPage(source, options = {}) {
        // For now, handle single image
        // TODO: Implement PDF page extraction with pdf-lib or similar
        const singlePage = await this.prepare(source, options);
        return [singlePage];
    }
}

// ============================================================================
// RESULT MERGER
// ============================================================================

/**
 * ResultMerger - Combines outputs from multiple processing stages
 * 
 * Handles:
 * - Merging expert pipeline results with legacy outputs
 * - Conflict resolution between sources
 * - Confidence-weighted field selection
 * - Output normalization for paperless-ngx
 */
class ResultMerger {
    /**
     * Merge expert pipeline result with legacy extraction result
     * 
     * @param {Object} expertResult - Output from expert pipeline
     * @param {Object} legacyResult - Output from legacy vision/text processing
     * @param {Object} options - Merge options
     * @returns {Object} Merged result
     */
    static merge(expertResult, legacyResult, options = {}) {
        const mergeStrategy = options.strategy || 'confidence_weighted';
        
        switch (mergeStrategy) {
            case 'expert_priority':
                return this._mergeExpertPriority(expertResult, legacyResult);
            case 'legacy_priority':
                return this._mergeLegacyPriority(expertResult, legacyResult);
            case 'confidence_weighted':
            default:
                return this._mergeConfidenceWeighted(expertResult, legacyResult);
        }
    }
    
    /**
     * Merge with expert results taking priority
     */
    static _mergeExpertPriority(expertResult, legacyResult) {
        // Start with legacy as base
        const merged = { ...legacyResult };
        
        // Overlay expert results
        if (expertResult?.result?.primary_output) {
            const expertData = expertResult.result.primary_output;
            
            // Merge entities
            if (expertData.entities || expertData.unified_record?.conditions) {
                merged.entities = this._mergeEntities(
                    expertData.entities || expertData.unified_record,
                    legacyResult?.entities
                );
            }
            
            // Merge summary
            if (expertData.summary || expertData.patient_summary) {
                merged.summary = expertData.summary?.brief || 
                                 expertData.patient_summary ||
                                 merged.summary;
            }
            
            // Add expert-specific fields
            merged.expert_extraction = expertData;
            merged.pipeline_id = expertResult.pipeline_id;
            merged.confidence = expertResult.metadata?.confidence || 0;
        }
        
        merged._merge_strategy = 'expert_priority';
        merged._merge_timestamp = new Date().toISOString();
        
        return merged;
    }
    
    /**
     * Merge with legacy results taking priority
     */
    static _mergeLegacyPriority(expertResult, legacyResult) {
        const merged = { ...legacyResult };
        
        // Add expert results as supplementary data
        if (expertResult?.result?.primary_output) {
            merged.expert_supplement = expertResult.result.primary_output;
            merged.expert_confidence = expertResult.metadata?.confidence || 0;
        }
        
        merged._merge_strategy = 'legacy_priority';
        merged._merge_timestamp = new Date().toISOString();
        
        return merged;
    }
    
    /**
     * Merge using confidence weighting
     */
    static _mergeConfidenceWeighted(expertResult, legacyResult) {
        const expertConfidence = expertResult?.metadata?.confidence || 0;
        const legacyConfidence = legacyResult?.confidence || 0.5;
        
        // Determine which source to prefer
        const useExpert = expertConfidence >= legacyConfidence;
        
        if (useExpert) {
            return this._mergeExpertPriority(expertResult, legacyResult);
        } else {
            return this._mergeLegacyPriority(expertResult, legacyResult);
        }
    }
    
    /**
     * Merge entity lists from different sources
     */
    static _mergeEntities(expertEntities, legacyEntities) {
        const merged = {};
        
        // Entity categories to merge
        const categories = [
            'conditions', 'medications', 'procedures', 'providers',
            'people', 'organizations', 'dates', 'amounts'
        ];
        
        for (const category of categories) {
            const expertList = expertEntities?.[category] || [];
            const legacyList = legacyEntities?.[category] || [];
            
            // Combine and deduplicate
            const combined = [...expertList];
            
            for (const legacyItem of legacyList) {
                const isDuplicate = combined.some(expertItem => 
                    this._isSameEntity(expertItem, legacyItem, category)
                );
                
                if (!isDuplicate) {
                    combined.push({ ...legacyItem, _source: 'legacy' });
                }
            }
            
            if (combined.length > 0) {
                merged[category] = combined;
            }
        }
        
        return merged;
    }
    
    /**
     * Check if two entities are the same
     */
    static _isSameEntity(entity1, entity2, category) {
        // Simple name-based matching for now
        const name1 = (entity1.name || entity1.text || entity1.drug_name || 
                       entity1.condition || entity1.medication || '').toLowerCase();
        const name2 = (entity2.name || entity2.text || entity2.drug_name || 
                       entity2.condition || entity2.medication || '').toLowerCase();
        
        if (!name1 || !name2) return false;
        
        // Exact match
        if (name1 === name2) return true;
        
        // Substring match for partial matches
        if (name1.includes(name2) || name2.includes(name1)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Convert merged result to paperless-ngx format
     */
    static toPaperlessFormat(mergedResult, documentId) {
        return {
            document_id: documentId,
            title: mergedResult.title || mergedResult.document_info?.subject || null,
            content: mergedResult.summary || mergedResult.content || null,
            tags: this._extractTags(mergedResult),
            correspondent: this._extractCorrespondent(mergedResult),
            document_type: this._extractDocumentType(mergedResult),
            created_date: this._extractDate(mergedResult),
            custom_fields: this._extractCustomFields(mergedResult),
            
            // Metadata
            _extraction_confidence: mergedResult.confidence || 0,
            _pipeline_id: mergedResult.pipeline_id || null,
            _processed_at: new Date().toISOString()
        };
    }
    
    /**
     * Extract suggested tags from result
     */
    static _extractTags(result) {
        const tags = new Set();
        
        // From suggested_tags
        if (result.suggested_tags) {
            result.suggested_tags.forEach(t => tags.add(t));
        }
        
        // From document classification
        if (result.classification?.primary_domain) {
            tags.add(result.classification.primary_domain.toLowerCase());
        }
        if (result.classification?.document_type) {
            tags.add(result.classification.document_type.toLowerCase().replace(/_/g, '-'));
        }
        
        // From medical conditions (for medical documents)
        if (result.entities?.conditions) {
            result.entities.conditions.slice(0, 3).forEach(c => {
                if (c.normalized || c.condition) {
                    tags.add(`condition:${(c.normalized || c.condition).toLowerCase()}`);
                }
            });
        }
        
        return Array.from(tags);
    }
    
    /**
     * Extract correspondent from result
     */
    static _extractCorrespondent(result) {
        // From providers
        if (result.entities?.providers?.[0]?.name) {
            return result.entities.providers[0].name;
        }
        
        // From organizations
        if (result.entities?.organizations?.[0]?.name) {
            return result.entities.organizations[0].name;
        }
        
        // From detected entities in classification
        if (result.classification?.metadata_hints?.detected_entities?.[0]) {
            return result.classification.metadata_hints.detected_entities[0];
        }
        
        return null;
    }
    
    /**
     * Extract document type from result
     */
    static _extractDocumentType(result) {
        if (result.classification?.document_type) {
            return result.classification.document_type;
        }
        if (result.document_info?.detected_type) {
            return result.document_info.detected_type;
        }
        return null;
    }
    
    /**
     * Extract date from result
     */
    static _extractDate(result) {
        // From temporal info
        if (result.temporal_info?.document_date) {
            return result.temporal_info.document_date;
        }
        
        // From classification hints
        if (result.classification?.metadata_hints?.detected_date) {
            return result.classification.metadata_hints.detected_date;
        }
        
        // From entities
        if (result.entities?.dates?.[0]?.normalized) {
            return result.entities.dates[0].normalized;
        }
        
        return null;
    }
    
    /**
     * Extract custom fields for paperless-ngx
     */
    static _extractCustomFields(result) {
        const customFields = {};
        
        // Add pipeline info
        customFields['ai_pipeline'] = result.pipeline_id || 'legacy';
        customFields['ai_confidence'] = result.confidence || 0;
        
        // Add domain-specific fields
        if (result.classification?.primary_domain === 'Medical') {
            if (result.entities?.conditions?.length > 0) {
                customFields['diagnoses'] = result.entities.conditions
                    .map(c => c.normalized || c.condition)
                    .join('; ');
            }
            if (result.entities?.medications?.length > 0) {
                customFields['medications'] = result.entities.medications
                    .map(m => m.drug_name || m.medication)
                    .join('; ');
            }
        }
        
        return customFields;
    }
}

// ============================================================================
// MAIN DOCUMENT PROCESSOR
// ============================================================================

/**
 * DocumentProcessor - Main entry point for document processing
 * 
 * Provides unified interface for:
 * - Expert pipeline processing
 * - Legacy processing fallback
 * - Hybrid processing modes
 * - Result normalization
 */
class DocumentProcessor {
    /**
     * @param {Object} ollamaService - Reference to existing Ollama service
     * @param {Object} options - Processor options
     */
    constructor(ollamaService, options = {}) {
        this.ollamaService = ollamaService;
        this.config = { ...ProcessorConfig, ...options };
        
        // Initialize expert pipeline executor
        this.pipelineExecutor = new ExpertPipelineExecutor(ollamaService, {
            defaultTimeout: this.config.timeouts.extraction,
            maxRetries: 2,
            enableMetrics: this.config.features.enableMetricsLogging
        });
        
        // Register medical prompts if enabled
        if (this.config.features.enableMedicalPipeline) {
            registerMedicalPrompts(promptRegistry);
        }
        
        // Processing statistics
        this.stats = {
            totalProcessed: 0,
            expertPipelineUsed: 0,
            legacyFallbackUsed: 0,
            averageConfidence: 0,
            byDomain: {}
        };
        
        logger.info('DocumentProcessor initialized', {
            mode: this.config.defaultMode,
            expertEnabled: this.config.features.enableExpertPipeline,
            medicalEnabled: this.config.features.enableMedicalPipeline
        });
    }
    
    /**
     * Process a document through the appropriate pipeline
     * 
     * @param {Object} document - Document to process
     * @param {Object} options - Processing options
     * @returns {Object} Processing result
     */
    async process(document, options = {}) {
        const startTime = Date.now();
        const processingMode = options.mode || this.config.defaultMode;
        
        this.stats.totalProcessed++;
        
        logger.info({
            event: 'document_processing_start',
            documentId: document.id,
            filename: document.filename,
            mode: processingMode
        });
        
        try {
            let result;
            
            switch (processingMode) {
                case ProcessorConfig.modes.EXPERT_PIPELINE:
                    result = await this._processExpertPipeline(document, options);
                    break;
                    
                case ProcessorConfig.modes.LEGACY_VISION:
                    result = await this._processLegacyVision(document, options);
                    break;
                    
                case ProcessorConfig.modes.LEGACY_TEXT:
                    result = await this._processLegacyText(document, options);
                    break;
                    
                case ProcessorConfig.modes.HYBRID:
                default:
                    result = await this._processHybrid(document, options);
                    break;
            }
            
            // Convert to paperless format
            const paperlessResult = ResultMerger.toPaperlessFormat(
                result,
                document.id
            );
            
            // Update statistics
            this._updateStats(result, processingMode);
            
            const totalTime = Date.now() - startTime;
            
            logger.info({
                event: 'document_processing_complete',
                documentId: document.id,
                mode: processingMode,
                pipelineId: result.pipeline_id,
                confidence: result.confidence,
                processingTimeMs: totalTime
            });
            
            return {
                success: true,
                result: result,
                paperless: paperlessResult,
                metadata: {
                    processingMode: processingMode,
                    pipelineId: result.pipeline_id,
                    confidence: result.confidence,
                    processingTimeMs: totalTime
                }
            };
            
        } catch (error) {
            logger.error({
                event: 'document_processing_error',
                documentId: document.id,
                error: error.message,
                stack: error.stack
            });
            
            // Attempt fallback if enabled
            if (this.config.features.enableFallbackToLegacy && 
                processingMode !== ProcessorConfig.modes.LEGACY_TEXT) {
                logger.info('Attempting legacy text fallback');
                try {
                    const fallbackResult = await this._processLegacyText(document, options);
                    this.stats.legacyFallbackUsed++;
                    
                    return {
                        success: true,
                        result: fallbackResult,
                        paperless: ResultMerger.toPaperlessFormat(fallbackResult, document.id),
                        metadata: {
                            processingMode: 'fallback_text',
                            originalError: error.message,
                            processingTimeMs: Date.now() - startTime
                        }
                    };
                } catch (fallbackError) {
                    logger.error('Fallback also failed', { error: fallbackError.message });
                }
            }
            
            return {
                success: false,
                error: error.message,
                metadata: {
                    processingMode: processingMode,
                    processingTimeMs: Date.now() - startTime
                }
            };
        }
    }
    
    /**
     * Process using full expert pipeline
     */
    async _processExpertPipeline(document, options) {
        // Prepare image if available
        let preparedImage = null;
        if (document.image_path || document.image_data) {
            const imageSource = document.image_data || document.image_path;
            const prepared = await ImagePreparator.prepare(imageSource);
            preparedImage = prepared.base64;
            document.image_data = preparedImage;
        }

        let vatContext = '';
        let vatContextSources = [];
        if (this.config.features.enableVatRag) {
            const vatQuery = document.ocr_text || document.content || '';
            const vatResult = await InternalVatRag.retrieveVatContext(vatQuery, this.config.rag);
            vatContext = vatResult.contextText;
            vatContextSources = vatResult.sources;
        }

        // Run full pipeline processing
        const result = await processDocument(
            document,
            this.ollamaService,
            {
                ...options,
                context: {
                    source: 'paperless-ngx',
                    vat_context: vatContext,
                    vat_context_sources: vatContextSources,
                    vat_context_policy: 'internal-only',
                    ...(options.context || {})
                }
            }
        );
        
        this.stats.expertPipelineUsed++;
        
        // Extract primary output
        const primaryOutput = result.result?.primary_output || result.result?.outputs || {};
        
        return {
            ...primaryOutput,
            classification: result.result?.classification,
            pipeline_id: result.pipeline_id,
            confidence: result.metadata?.confidence || 0,
            _expert_result: result
        };
    }
    
    /**
     * Process using legacy vision flow (existing vision.js)
     */
    async _processLegacyVision(document, options) {
        // Import legacy vision processing
        // This integrates with the existing vision.js flow
        const vision = require('../ollama/vision');
        const content = document.ocr_text || document.content || '';
        const legacyOptions = {
            ...options,
            existingTags: options.existingTags || [],
            existingCorrespondentList: options.existingCorrespondentList || [],
            existingDocumentTypesList: options.existingDocumentTypesList || []
        };

        // Call existing vision processing
        const result = await vision.analyzeDocumentWithVision(
            document.id,
            content,
            legacyOptions
        );

        return {
            ...result,
            pipeline_id: 'legacy_vision',
            confidence: result.confidence || 0.5,
            _legacy: true
        };
    }
    
    /**
     * Process using legacy text flow (existing text.js)
     */
    async _processLegacyText(document, options) {
        // Import legacy text processing
        const text = require('../ollama/text');
        const content = document.ocr_text || document.content || '';
        const existingTags = options.existingTags || [];
        const existingCorrespondentList = options.existingCorrespondentList || [];
        const existingDocumentTypesList = options.existingDocumentTypesList || [];

        // Call existing text processing
        const result = await text.analyzeDocument(
            content,
            existingTags,
            existingCorrespondentList,
            existingDocumentTypesList,
            document.id,
            options.customPrompt || null,
            options
        );

        return {
            ...result,
            pipeline_id: 'legacy_text',
            confidence: result.confidence || 0.5,
            _legacy: true
        };
    }
    
    /**
     * Process using hybrid approach (expert + legacy fallback)
     */
    async _processHybrid(document, options) {
        // First, try expert pipeline
        let expertResult = null;
        let expertError = null;
        
        if (this.config.features.enableExpertPipeline) {
            try {
                expertResult = await this._processExpertPipeline(document, options);
            } catch (error) {
                expertError = error;
                logger.warn('Expert pipeline failed, will use legacy', {
                    error: error.message
                });
            }
        }
        
        // Check if expert result is good enough
        const expertConfidence = expertResult?.confidence || 0;
        const needsFallback = !expertResult || 
                              expertConfidence < this.config.thresholds.fallbackTrigger;
        
        // If expert succeeded with good confidence, return it
        if (expertResult && !needsFallback) {
            return expertResult;
        }
        
        // Otherwise, also run legacy for comparison/fallback
        let legacyResult = null;
        try {
            // Choose legacy mode based on document
            const hasImage = document.image_path || document.image_data;
            if (hasImage) {
                legacyResult = await this._processLegacyVision(document, options);
            } else {
                legacyResult = await this._processLegacyText(document, options);
            }
            this.stats.legacyFallbackUsed++;
        } catch (legacyError) {
            logger.warn('Legacy processing also failed', { error: legacyError.message });
        }
        
        // Merge results
        if (expertResult && legacyResult) {
            return ResultMerger.merge(
                { result: { primary_output: expertResult }, metadata: { confidence: expertConfidence } },
                legacyResult,
                { strategy: 'confidence_weighted' }
            );
        }
        
        // Return whichever succeeded
        if (expertResult) return expertResult;
        if (legacyResult) return legacyResult;
        
        // Both failed
        throw new Error('All processing methods failed');
    }
    
    /**
     * Classify document without full processing
     * Useful for routing decisions
     */
    async classify(document, options = {}) {
        // Prepare image
        let preparedImage = null;
        if (document.image_path || document.image_data) {
            const imageSource = document.image_data || document.image_path;
            const prepared = await ImagePreparator.prepare(imageSource);
            preparedImage = prepared.base64;
        }
        
        // Build router messages
        const routerMessages = promptRegistry.buildMessages(
            'SYS_ROUTER_V1',
            {
                source_system: document.source || 'paperless-ngx',
                filename: document.filename || 'unknown',
                resolution: document.resolution || 'standard',
                file_size: document.file_size || 'unknown'
            },
            preparedImage
        );
        
        // Call router
        const response = await this.pipelineExecutor._callOllama(
            this.config.models.router,
            routerMessages,
            promptRegistry.getOptions('SYS_ROUTER_V1')
        );
        
        // Parse classification
        const classification = await this.pipelineExecutor._parseResponse(response, {
            id: 'router',
            model: this.config.models.router
        });
        
        return classification;
    }
    
    /**
     * Get recommended pipeline for a document
     */
    async recommendPipeline(document) {
        const classification = await this.classify(document);
        const { pipeline, routingMetadata } = expertRegistry.route(classification);
        
        return {
            classification: classification,
            recommendedPipeline: pipeline.id,
            pipelineName: pipeline.name,
            routing: routingMetadata
        };
    }
    
    /**
     * Update processing statistics
     */
    _updateStats(result, mode) {
        const confidence = result.confidence || 0;
        const n = this.stats.totalProcessed;
        
        // Update running average confidence
        this.stats.averageConfidence = 
            ((this.stats.averageConfidence * (n - 1)) + confidence) / n;
        
        // Update domain counts
        const domain = result.classification?.primary_domain || 'Unknown';
        this.stats.byDomain[domain] = (this.stats.byDomain[domain] || 0) + 1;
    }
    
    /**
     * Get processing statistics
     */
    getStats() {
        return {
            ...this.stats,
            executorStats: this.pipelineExecutor.getStats(),
            registeredPipelines: expertRegistry.list().length,
            registeredPrompts: promptRegistry.list().length
        };
    }
    
    /**
     * Health check for processor and dependencies
     */
    async healthCheck() {
        const health = {
            status: 'healthy',
            components: {}
        };
        
        // Check Ollama connectivity
        try {
            const ollamaHost = config.ollama.apiUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
            const response = await axios.get(`${ollamaHost}/api/tags`, { timeout: 5000 });
            const data = response.data;

            health.components.ollama = {
                status: 'healthy',
                modelsLoaded: data.models?.length || 0
            };

            // Check for required models
            const modelNames = data.models?.map(m => m.name) || [];
            health.components.requiredModels = {
                router: modelNames.some(n => n.includes('qwen3-vl')),
                medicalImaging: modelNames.some(n => n.includes('llava-med')),
                medicalText: modelNames.some(n => n.includes('medtext')),
                general: modelNames.some(n => n.includes('llama3')),
                financeReasoning: modelNames.some(n => n.includes('fino1')),
                financeGeneral: modelNames.some(n => n.includes('llm-pro-finance'))
            };
        } catch (error) {
            health.components.ollama = { status: 'unhealthy', error: error.message };
            health.status = 'unhealthy';
        }
        
        // Component counts
        health.components.pipelines = expertRegistry.list().length;
        health.components.prompts = promptRegistry.list().length;
        
        return health;
    }
}

// ============================================================================
// FACTORY AND EXPORTS
// ============================================================================

/**
 * Create a configured DocumentProcessor instance
 */
function createDocumentProcessor(ollamaService, options = {}) {
    return new DocumentProcessor(ollamaService, options);
}

// ============================================================================
// EXPRESS MIDDLEWARE (for integration with existing server.js)
// ============================================================================

/**
 * Express middleware for document processing endpoint
 */
function createProcessingMiddleware(documentProcessor) {
    return async (req, res, next) => {
        try {
            const document = req.body.document || req.body;
            const options = {
                mode: req.query.mode || req.body.mode,
                context: req.body.context
            };
            
            const result = await documentProcessor.process(document, options);
            
            res.json(result);
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Express middleware for classification endpoint
 */
function createClassificationMiddleware(documentProcessor) {
    return async (req, res, next) => {
        try {
            const document = req.body.document || req.body;
            const classification = await documentProcessor.classify(document);
            
            res.json({
                success: true,
                classification: classification
            });
        } catch (error) {
            next(error);
        }
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Main classes
    DocumentProcessor,
    ImagePreparator,
    ResultMerger,
    
    // Factory function
    createDocumentProcessor,
    
    // Express middleware
    createProcessingMiddleware,
    createClassificationMiddleware,
    
    // Configuration
    ProcessorConfig,
    
    // Re-export pipeline components for direct access
    promptRegistry,
    expertRegistry,
    ExpertPipelineExecutor
};
