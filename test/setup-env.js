/**
 * setup-env.js
 *
 * Test environment configuration and initialization
 * Sets up required environment variables and database schema for integration tests
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function isEnabled(value) {
    if (!value) return false;
    const normalized = String(value).toLowerCase();
    return normalized === '1' || normalized === 'true' ||
        normalized === 'yes';
}

function loadProjectEnvFallbacks() {
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;

    const parsed = dotenv.parse(fs.readFileSync(envPath));
    const fallbackKeys = [
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_DB',
        'POSTGRES_HOST',
        'POSTGRES_PORT',
        'PAPERLESS_DBHOST',
        'PAPERLESS_DBUSER',
        'PAPERLESS_DBPASS',
        'PAPERLESS_DBNAME',
        'JWT_SECRET'
    ];

    for (const key of fallbackKeys) {
        if (!process.env[key] && parsed[key]) {
            process.env[key] = parsed[key];
        }
    }

    const inDocker = fs.existsSync('/.dockerenv');
    const dbHost = process.env.POSTGRES_HOST || process.env.PAPERLESS_DBHOST;
    if (!inDocker && ['db', 'paperless_db'].includes(dbHost)) {
        process.env.POSTGRES_HOST = '127.0.0.1';
        process.env.PAPERLESS_DBHOST = '127.0.0.1';
        console.log(
            '[test/setup-env] normalized DB host to 127.0.0.1 for host test run'
        );
    }
}

loadProjectEnvFallbacks();

// Ensure test runner mode is visible to runtime and enable Guidance by default
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// Default to enabling Guidance to prevent JSON truncation issues.
process.env.GUIDANCE_ENABLED = process.env.GUIDANCE_ENABLED || 'true';
process.env.GUIDANCE_SERVICE_ENABLED = process.env.GUIDANCE_SERVICE_ENABLED || 'no';

if (isEnabled(process.env.TEST_AUTH_MOCK)) {
    require('./helpers/auth-mock');
    console.log('[test/setup-env] TEST_AUTH_MOCK enabled');
}

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

// Patch JSDOM globally to provide a fake canvas 2D context before any script runs.
// This avoids "Not implemented: HTMLCanvasElement.prototype.getContext" errors
// when built islands call canvas APIs during mount-time.
try {
    const jsdom = require('jsdom');
    const OriginalJSDOM = jsdom.JSDOM;
    class JSDOMWithCanvasStub extends OriginalJSDOM {
        constructor(html, options) {
            options = options || {};
            const userBeforeParse = options.beforeParse;
            options.beforeParse = function(window) {
                try {
                    if (window && window.HTMLCanvasElement) {
                        const fakeCtx = {
                            getImageData: () => ({ data: new Uint8ClampedArray(0) }),
                            putImageData: () => {},
                            measureText: () => ({ width: 0 }),
                            fillRect: () => {},
                            clearRect: () => {},
                            drawImage: () => {},
                            beginPath: () => {},
                            arc: () => {},
                            fillText: () => {},
                            getContextAttributes: () => ({})
                        };
                        try {
                            window.HTMLCanvasElement.prototype.getContext = function() { return fakeCtx; };
                        } catch (assignErr) {
                            Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
                                value: function() { return fakeCtx; },
                                configurable: true,
                                writable: true
                            });
                        }
                    }
                } catch (e) {
                    console.warn('[test/setup-env] canvas stub failed:', e && e.message);
                }
                if (typeof userBeforeParse === 'function') userBeforeParse(window);
            };
            super(html, options);
        }
    }
    jsdom.JSDOM = JSDOMWithCanvasStub;
    
    // Explicitly set up global environment if not present
    if (typeof global.window === 'undefined') {
        const dom = new jsdom.JSDOM('<!doctype html><html><body></body></html>', {
            url: 'http://localhost'
        });
        global.window = dom.window;
        global.document = dom.window.document;
        global.navigator = dom.window.navigator;
        global.HTMLElement = dom.window.HTMLElement;
        global.Node = dom.window.Node;
    }
    
    console.log('[test/setup-env] Patched and initialized JSDOM globals');
} catch (e) {
    console.warn('[test/setup-env] Could not patch JSDOM for canvas stub:', e && e.message);
}

// Polyfill Image for component tests that instantiate `new Image()`.
try {
    if (typeof global.Image === 'undefined') {
        class MockImage {
            constructor() {
                this._src = '';
                this.onload = null;
                this.onerror = null;
                this.width = 0;
                this.height = 0;
            }

            set src(value) {
                this._src = value || '';
                if (typeof this.onload === 'function') {
                    setTimeout(() => {
                        try {
                            this.onload();
                        } catch {
                            // Ignore callback errors in test polyfill.
                        }
                    }, 0);
                }
            }

            get src() {
                return this._src;
            }
        }

        global.Image = MockImage;
        if (typeof window !== 'undefined') {
            window.Image = MockImage;
        }
        console.log('[test/setup-env] Patched Image for JSDOM');
    }
} catch (err) {
    console.warn('[test/setup-env] Image patch failed:', err && err.message);
}

// Polyfill JSDOM CustomEvent for tests that dispatch CustomEvent (fixes VisualAnnotation tests)
try {
    if (typeof global !== 'undefined' && typeof global.CustomEvent === 'undefined') {
        function CustomEvent(event, params) {
            params = params || { bubbles: false, cancelable: false, detail: null };
            var evt = (typeof document !== 'undefined' && document.createEvent) ? document.createEvent('CustomEvent') : null;
            if (evt && evt.initCustomEvent) {
                evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
            } else if (typeof window !== 'undefined') {
                evt = new window.Event(event, params);
                evt.detail = params.detail;
            } else {
                evt = { type: event, detail: params.detail, bubbles: params.bubbles, cancelable: params.cancelable };
            }
            return evt;
        }
        CustomEvent.prototype = (typeof window !== 'undefined' && window.Event) ? window.Event.prototype : Object.prototype;
        global.CustomEvent = CustomEvent;
        if (typeof window !== 'undefined') window.CustomEvent = CustomEvent;
        console.log('[test/setup-env] Patched CustomEvent for JSDOM');
    }
} catch (err) {
    console.warn('[test/setup-env] CustomEvent patch failed:', err && err.message);
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
    if (!isEnabled(process.env.TEST_ENABLE_DB_INIT)) {
        process.env.PG_AVAILABLE = 'false';
        console.log(
            '[test/setup-env] TEST_ENABLE_DB_INIT is not enabled; ' +
            'skipping database schema initialization'
        );
        return;
    }

    // Allow skipping DB init for fast unit-only runs via TEST_SKIP_DB_INIT
    if (isEnabled(process.env.TEST_SKIP_DB_INIT)) {
        process.env.PG_AVAILABLE = 'false';
        console.log('[test/setup-env] TEST_SKIP_DB_INIT is set; skipping database schema initialization');
        return;
    }

    // Retry helper with exponential backoff
    // Use an unref'd timer for the wait so pending backoff timers don't keep the
    // Node process alive when running focused unit tests that don't need or have
    // an active database. This allows Mocha to exit cleanly even if retries
    // would otherwise continue in the background.
    const wait = (ms) => new Promise((res) => {
        const t = setTimeout(res, ms);
        if (t && typeof t.unref === 'function') t.unref();
    });
    async function retry(fn, { attempts = 8, initialDelay = 1000 } = {}) {
        let delay = initialDelay;
        for (let i = 0; i < attempts; ++i) {
            try {
                return await fn();
            } catch (err) {
                if (i === attempts - 1) throw err;
                console.warn(`[test] Retry ${i + 1}/${attempts} failed: ${err && err.message}. Retrying in ${delay}ms`);
                await wait(delay);
                delay *= 2;
            }
        }
    }

    try {
        // Strategy 1: Prefer to reuse VisualOverlayRepository's pool if available
        try {
            const { visualOverlayRepository } = require('../services/visual-rag-client/VisualOverlayRepository');
            if (visualOverlayRepository) {
                await retry(async () => {
                    await visualOverlayRepository.isAvailable();
                    const client = await visualOverlayRepository.pool.connect();
                    try {
                        await client.query(
                            'ALTER TABLE visual_overlays ADD COLUMN IF NOT EXISTS vector_id UUID;'
                        );
                    } finally {
                        client.release();
                    }
                }, { attempts: 8, initialDelay: 1000 });

                process.env.PG_AVAILABLE = 'true';
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

        // Strategy 2: Direct pg connection as fallback (with retries)
        try {
            const { Pool } = require('pg');
            const configuredHost = process.env.POSTGRES_HOST || process.env.PAPERLESS_DBHOST;
            // Try container name as well (paperless_db) — helpful when tests run in the compose network
            const defaultHosts = configuredHost ? [configuredHost, 'paperless_db', '127.0.0.1', 'localhost'] : ['paperless_db', '127.0.0.1', 'localhost'];
            const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
            const database = process.env.POSTGRES_DB || 'paperless';
            const user = getTestEnv('POSTGRES_USER', 'PAPERLESS_DBUSER');
            const password = getTestEnv('POSTGRES_PASSWORD', 'PAPERLESS_DBPASS');

            // Skip connection if credentials are missing
            if (!user || !password) {
                process.env.PG_AVAILABLE = 'false';
                console.warn('⚠️ [test] Skipping database schema initialization due to missing credentials');
                if (process.env.PG_STRICT_MODE === 'true' || process.env.PG_STRICT_MODE === 'yes') {
                    throw new Error('PG_STRICT_MODE enabled but database credentials missing. Set POSTGRES_USER and POSTGRES_PASSWORD or unset PG_STRICT_MODE.');
                }
                return;
            }

            // Try candidate hosts sequentially within the retry loop. This handles cases
            // where Docker DNS name (e.g., 'db') is not resolvable from the host running
            // tests (common on Windows or when services are not attached to the same
            // network). We still use exponential backoff across attempts.
            await retry(async () => {
                let lastErr;
                for (const hostCandidate of defaultHosts) {
                    const pool = new Pool({
                        host: hostCandidate,
                        port,
                        database,
                        user,
                        password,
                        max: 1,
                        idleTimeoutMillis: 1000,
                        connectionTimeoutMillis: 10000
                    });

                    console.log(`[test] Attempting direct pool connection to ${hostCandidate}:${port}/${database}`);

                    try {
                        const client = await pool.connect();
                        try {
                            await client.query(
                                'ALTER TABLE visual_overlays ADD COLUMN IF NOT EXISTS vector_id UUID;'
                            );
                            await pool.end();
                            // success - return from retry fn
                            return;
                        } finally {
                            client.release();
                        }
                    } catch (err) {
                        lastErr = err;
                        console.warn(`[test] Direct pool connection to ${hostCandidate} failed: ${err && err.message}`);
                        try { await pool.end(); } catch (e) {}
                        // try next hostCandidate
                    }
                }
                // If we reach here, all host candidates failed - throw last error to trigger retry
                throw lastErr || new Error('Direct pool connection failed for all host candidates');
            }, { attempts: 8, initialDelay: 1000 });

            process.env.PG_AVAILABLE = 'true';
            console.log(
                '✅ [test] visual_overlays.vector_id column ensured via direct pool'
            );
            return;
        } catch (directPoolError) {
            process.env.PG_AVAILABLE = 'false';
            console.warn({
                event: 'test_schema_direct_pool_failed',
                error: directPoolError && directPoolError.message,
                code: directPoolError && directPoolError.code,
                hint: 'Ensure PostgreSQL is running and connection parameters are correct'
            });
            console.warn(
                '⚠️ [test] Could not ensure visual_overlays.vector_id column'
            );
            // If strict mode is requested, surface a clear error early rather than
            // letting downstream services throw ambiguous DNS/connection errors.
            if (process.env.PG_STRICT_MODE === 'true' || process.env.PG_STRICT_MODE === 'yes') {
                throw new Error('PG_STRICT_MODE enabled but database not reachable. Start PostgreSQL or unset PG_STRICT_MODE for local runs.');
            }
            return;
        }
    } catch (unexpectedError) {
        process.env.PG_AVAILABLE = 'false';
        console.error({
            event: 'test_schema_unexpected_error',
            error: unexpectedError.message,
            stack: unexpectedError.stack
        });
        console.error(
            '❌ [test] Unexpected error during schema initialization'
        );
        if (process.env.PG_STRICT_MODE === 'true' || process.env.PG_STRICT_MODE === 'yes') {
            throw unexpectedError;
        }
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

// Register ts-node to transpile TypeScript/TSX during tests (ensures server imports that reference .ts/.tsx succeed)
try {
    require('ts-node').register({
        transpileOnly: true,
        skipProject: true, // MUST be true to ignore incompatible tsconfig.json settings
        compilerOptions: {
            module: 'CommonJS',
            jsx: 'react-jsx',
            jsxImportSource: 'preact',
            esModuleInterop: true,
            moduleResolution: 'node',
            allowSyntheticDefaultImports: true
        },
        ignore: []
    });
    console.log('[test/setup-env] ts-node registered for TS/TSX transpilation (skipProject: true, moduleResolution: node)');
} catch (e) {
    console.warn('[test/setup-env] ts-node registration failed:', e && e.message);
}

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
