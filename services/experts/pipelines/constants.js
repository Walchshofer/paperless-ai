/**
 * Pipeline Constants
 *
 * Defines stage types and execution modes for expert pipelines.
 */

/**
 * Pipeline stage types - ordered execution within a pipeline
 */
const StageType = Object.freeze({
    CLASSIFICATION: 'classification',    // Initial document routing
    VISUAL_ANALYSIS: 'visual_analysis',  // Image/visual processing
    TEXT_EXTRACTION: 'text_extraction',  // Text content extraction
    ENTITY_RECOGNITION: 'entity_recognition', // NER for domain entities
    REASONING: 'reasoning',              // Domain-specific inference
    INTEGRATION: 'integration',          // Multi-source data fusion
    VALIDATION: 'validation',            // Output quality checks
    RECOVERY: 'recovery',                // Error recovery attempts
    VISUAL_QUERY_GENERATION: 'visual_query_generation',  // Phase 3: Generate visual queries for missing/low-confidence fields
    VISUAL_QUERY_EXECUTION: 'visual_query_execution'     // Phase 4: Execute visual queries against Visual RAG sidecar
});

/**
 * Execution modes for pipeline stages
 */
const ExecutionMode = Object.freeze({
    SEQUENTIAL: 'sequential',   // Stages run in order, output feeds next
    PARALLEL: 'parallel',       // Stages run concurrently where possible
    CONDITIONAL: 'conditional', // Stage runs based on prior stage output
    FALLBACK: 'fallback'        // Stage runs only if prior stage fails
});

module.exports = { StageType, ExecutionMode };
