/**
 * setup-env.js
 *
 * Test environment configuration and initialization
 * Sets up required environment variables and database schema for integration tests
 */

// Default to enabling Guidance to prevent JSON truncation issues.
process.env.GUIDANCE_ENABLED = process.env.GUIDANCE_ENABLED || 'true';
process.env.GUIDANCE_SERVICE_ENABLED = process.env.GUIDANCE_SERVICE_ENABLED || 'no';

/**
 * Get required environment variable for tests
 * Logs warning and returns null if not found (tests should handle gracefully)
 */
function getTestEnv(key, fallbackKey = null) {
    const value = process.env[key];
    if (value && value !== '') return value;
    
    if (fallbackKey) {
        const fallbackValue = process.env[fallbackKey];
        if (fallbackValue && fallbackValue !== '') return fallbackValue;
    }
    
    const keys = fallbackKey ? `${key} or ${fallbackKey}` : key;
    console.warn(`⚠️ [test] Missing environment variable: ${keys}`);
    console.warn('   Tests requiring database access may fail.');
    return null;
}

// Default RAG Service URL for tests if not provided
process.env.RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

if (process.env.GUIDANCE_ENABLED === 'false' || process.env.GUIDANCE_SERVICE_ENABLED === 'no') {
    console.warn('[test] Guidance service disabled for this run.');
}

if (process.env.RAG_SERVICE_ENABLED === 'true') {
    console.log(`[test] RAG Service enabled at ${process.env.RAG_SERVICE_URL}`);
} else {
    console.log('[test] RAG Service disabled for this run.');
}

// ============================================================================
// TEST DATABASE SCHEMA INITIALIZATION
// ============================================================================

/**
 * Ensure visual_overlays table has vector_id column for integration tests
 * Attempts two strategies:
 * 1. Use VisualOverlayRepository's connection pool (preferred)
 * 2. Create direct pg connection as fallback
 */
(async function ensureTestDbSchema() {
    try {
        // Strategy 1: Prefer to reuse VisualOverlayRepository's pool if available
        try {
            const { visualOverlayRepository } = require('../services/visual-rag-client/VisualOverlayRepository');
            if (visualOverlayRepository) {
                await visualOverlayRepository.isAvailable();
                const client = await visualOverlayRepository.pool.connect();
                await client.query(
                    'ALTER TABLE visual_overlays ADD COLUMN IF NOT EXISTS vector_id UUID;'
                );
                client.release();
                console.log(
                    '✅ [test] visual_overlays.vector_id column ensured via repository pool'
                );
                return;
            }
        } catch (repositoryError) {
            console.debug({
                event: 'test_schema_repository_unavailable',
                error: repositoryError.message,
                reason: 'Falling back to direct pool connection'
            });
            // Fall through to Strategy 2
        }

        // Strategy 2: Direct pg connection as fallback
        try {
            const { Pool } = require('pg');
            const host = process.env.POSTGRES_HOST || process.env.PAPERLESS_DBHOST || 'localhost';
            const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
            const database = process.env.POSTGRES_DB || 'paperless';
            const user = getTestEnv('POSTGRES_USER', 'PAPERLESS_DBUSER');
            const password = getTestEnv('POSTGRES_PASSWORD', 'PAPERLESS_DBPASS');

            // Skip connection if credentials are missing
            if (!user || !password) {
                console.warn('⚠️ [test] Skipping database schema initialization due to missing credentials');
                return;
            }

            const pool = new Pool({
                host,
                port,
                database,
                user,
                password,
                max: 1,
                idleTimeoutMillis: 1000,
                connectionTimeoutMillis: 5000
            });

            console.log(`[test] Attempting direct pool connection to ${host}:${port}/${database}`);

            const client = await pool.connect();
            await client.query(
                'ALTER TABLE visual_overlays ADD COLUMN IF NOT EXISTS vector_id UUID;'
            );
            client.release();
            await pool.end();

            console.log(
                '✅ [test] visual_overlays.vector_id column ensured via direct pool'
            );
            return;
        } catch (directPoolError) {
            console.warn({
                event: 'test_schema_direct_pool_failed',
                error: directPoolError.message,
                code: directPoolError.code,
                hint: 'Ensure PostgreSQL is running and connection parameters are correct'
            });
            console.warn(
                '⚠️ [test] Could not ensure visual_overlays.vector_id column'
            );
            return;
        }
    } catch (unexpectedError) {
        console.error({
            event: 'test_schema_unexpected_error',
            error: unexpectedError.message,
            stack: unexpectedError.stack
        });
        console.error(
            '❌ [test] Unexpected error during schema initialization'
        );
    }
})();

// ============================================================================
// TEST MODEL ENVIRONMENT CONFIGURATION
// ============================================================================

// Configure production models for tests
// Keep advanced/infrastructure models unset by default

/**
 * Router Model: Initial document classification (multimodal)
 * Classifies documents by domain (medical, financial, legal, general)
 */
process.env.ROUTER_MODEL = process.env.ROUTER_MODEL || 'qwen3-vl:8b';

/**
 * Medical Vision Model: Medical imaging analysis
 * Specialized for analyzing medical documents and imaging
 */
process.env.MEDICAL_VISION_MODEL = process.env.MEDICAL_VISION_MODEL || 'llava-med-v1.6';

/**
 * Medical Analysis Model: Medical text extraction
 * Specialized for extracting data from medical documents
 */
process.env.MEDICAL_ANALYSIS_MODEL = process.env.MEDICAL_ANALYSIS_MODEL || 'medtext-llama3';

/**
 * Financial Analysis Model (Calculator): Financial numeric extraction and calculator
 * Specialized for extraction and math (calculator)
 */
process.env.FINANCIAL_ANALYSIS_MODEL = process.env.FINANCIAL_ANALYSIS_MODEL || 'fino1-8b';
// New: separate reasoning model for text-based financial analysis
process.env.FINANCIAL_REASONING_MODEL = process.env.FINANCIAL_REASONING_MODEL || 'llm-pro-finance-8b';

/**
 * General Model: Fallback for general-purpose tasks
 * Used when no specialized model is available
 */
process.env.GENERAL_MODEL = process.env.GENERAL_MODEL || 'sauerkraut-llama3.1:8b';

/**
 * Orchestrator Model: Tool orchestration and planning
 * NOTE: Keep ORCHESTRATOR_MODEL unset so tests can validate 'null by default' behavior
 * This is intentional - do not set a default value here
 */
// process.env.ORCHESTRATOR_MODEL = ... (intentionally not set)

/**
 * Embedding Model: Vector embeddings for semantic search
 * NOTE: Skip configuring embedding model - tests do not require an Ollama embedding model
 * This can be configured separately if needed for integration tests
 */
// process.env.OLLAMA_EMBEDDING_MODEL = ... (intentionally not set)

console.log('[test] Environment configuration complete');
console.log({
    event: 'test_env_initialized',
    models: {
        router: process.env.ROUTER_MODEL,
        medical_vision: process.env.MEDICAL_VISION_MODEL,
        medical_analysis: process.env.MEDICAL_ANALYSIS_MODEL,
        financial_analysis: process.env.FINANCIAL_ANALYSIS_MODEL,
        financial_reasoning: process.env.FINANCIAL_REASONING_MODEL,
        general: process.env.GENERAL_MODEL,
        orchestrator: process.env.ORCHESTRATOR_MODEL || '(not set - intentional)',
        embedding: process.env.OLLAMA_EMBEDDING_MODEL || '(not set - intentional)'
    },
    services: {
        guidance: {
            enabled: process.env.GUIDANCE_ENABLED,
            service_enabled: process.env.GUIDANCE_SERVICE_ENABLED
        },
        rag: {
            enabled: process.env.RAG_SERVICE_ENABLED,
            url: process.env.RAG_SERVICE_URL
        }
    }
});
