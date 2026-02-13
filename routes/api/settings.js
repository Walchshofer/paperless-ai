/**
 * Settings API Routes
 *
 * Provides JSON API endpoints for settings islands to fetch/update configuration.
 * These endpoints are used by the React islands in the settings page.
 */
const express = require('express');
const router = express.Router();
const logger = require('../../services/logger');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { authenticateApi, requireAdmin } = require('../../middleware/auth');
const setupService = require('../../services/setupService');
const configFile = require('../../config/config');

// Environment file path
const ENV_FILE_PATH = path.join(__dirname, '../../data/runtime.env');
const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isEnabled(value, fallback = false) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    return TRUTHY_VALUES.has(String(value).trim().toLowerCase());
}

/**
 * GET /api/settings/config
 * Returns current configuration for islands hydration
 */
router.get('/config', authenticateApi, requireAdmin, async (req, res) => {
    try {
        // Read current env file
        let envContent = {};
        try {
            const envFile = await fs.readFile(ENV_FILE_PATH, 'utf8');
            envFile.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split('=');
                if (key && key.trim() && !key.startsWith('#')) {
                    envContent[key.trim()] = valueParts.join('=').trim();
                }
            });
        } catch (e) {
            logger.warn('[Settings API] Could not read env file:', e.message);
        }

        const activeProvider = envContent.AI_PROVIDER || process.env.AI_PROVIDER || 'ollama';

        res.json({
            connection: {
                // Active Sync
                activeProvider,
                // Paperless
                paperlessApiUrl: envContent.PAPERLESS_API_URL || process.env.PAPERLESS_API_URL || '',
                paperlessApiToken: (envContent.PAPERLESS_API_TOKEN || process.env.PAPERLESS_API_TOKEN) ? '***hidden***' : '',
                paperlessUsername: envContent.PAPERLESS_USERNAME || process.env.PAPERLESS_USERNAME || '',
                
                // AI Providers
                ollamaApiUrl: envContent.OLLAMA_API_URL || process.env.OLLAMA_API_URL || 'http://localhost:11434',
                openaiApiKey: (envContent.PAPERLESS_OPENAI_API_KEY || process.env.PAPERLESS_OPENAI_API_KEY) ? '***hidden***' : '',
                azureEndpoint: envContent.AZURE_ENDPOINT || process.env.AZURE_ENDPOINT || '',
                azureApiKey: (envContent.AZURE_API_KEY || process.env.AZURE_API_KEY) ? '***hidden***' : '',
                customApiUrl: envContent.CUSTOM_BASE_URL || process.env.CUSTOM_BASE_URL || '',
                customApiKey: (envContent.CUSTOM_API_KEY || process.env.CUSTOM_API_KEY) ? '***hidden***' : '',

                // Sidecar Services
                visualRagUrl: envContent.VISUAL_RAG_URL || process.env.VISUAL_RAG_URL || 'http://visual-rag:8001',
                textRagUrl: envContent.TEXT_RAG_URL || process.env.TEXT_RAG_URL || 'http://text-rag:8004',
                guidanceServiceUrl: envContent.GUIDANCE_SERVICE_URL || process.env.GUIDANCE_SERVICE_URL || 'http://guidance-service:8002',
                biasEngineUrl: envContent.BIAS_ENGINE_URL || process.env.BIAS_ENGINE_URL || 'bias-engine:50051',
                redisUrl: envContent.REDIS_URL || process.env.REDIS_URL || 'redis://broker:6379',

                // Vector Store
                qdrantHost: envContent.QDRANT_HOST || process.env.QDRANT_HOST || 'qdrant',
                qdrantPort: envContent.QDRANT_PORT || process.env.QDRANT_PORT || '6333',
                qdrantApiKey: (envContent.QDRANT_API_KEY || process.env.QDRANT_API_KEY) ? '***hidden***' : '',

                // External API
                externalApiEnabled: (envContent.EXTERNAL_API_ENABLED || process.env.EXTERNAL_API_ENABLED) === 'yes',
                externalApiUrl: envContent.EXTERNAL_API_URL || process.env.EXTERNAL_API_URL || '',
                externalApiMethod: envContent.EXTERNAL_API_METHOD || process.env.EXTERNAL_API_METHOD || 'GET',
                externalApiHeaders: envContent.EXTERNAL_API_HEADERS || process.env.EXTERNAL_API_HEADERS || '{}',
                externalApiBody: envContent.EXTERNAL_API_BODY || process.env.EXTERNAL_API_BODY || '{}',
                externalApiTimeout: parseInt(envContent.EXTERNAL_API_TIMEOUT || process.env.EXTERNAL_API_TIMEOUT || '5000', 10),
                externalApiTransform: envContent.EXTERNAL_API_TRANSFORM || process.env.EXTERNAL_API_TRANSFORM || ''
            },
            aiProvider: {
                provider: activeProvider,
                openai: {
                    model: {
                        name: envContent.PAPERLESS_OPENAI_MODEL || process.env.PAPERLESS_OPENAI_MODEL || 'gpt-4',
                        limits: {
                            contextWindow: parseInt(envContent.TOKEN_LIMIT || '128000', 10),
                            maxResponseTokens: parseInt(envContent.RESPONSE_TOKENS || '4096', 10)
                        }
                    }
                },
                ollama: {
                    text: {
                        name: envContent.OLLAMA_MODEL || process.env.OLLAMA_MODEL || 'sauerkraut-llama3.1:8b',
                        limits: {
                            contextWindow: parseInt(envContent.OLLAMA_CONTEXT_WINDOW || process.env.OLLAMA_CONTEXT_WINDOW || '128000', 10),
                            maxResponseTokens: parseInt(envContent.OLLAMA_MAX_RESPONSE_TOKENS || process.env.OLLAMA_MAX_RESPONSE_TOKENS || '4096', 10)
                        }
                    },
                    vision: {
                        name: envContent.OLLAMA_VISION_MODEL || process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:8b',
                        promptId: 'VIS_OCR_V1',
                        limits: {
                            contextWindow: parseInt(envContent.OLLAMA_VISION_CONTEXT_WINDOW || process.env.OLLAMA_VISION_CONTEXT_WINDOW || '32768', 10),
                            maxResponseTokens: parseInt(envContent.OLLAMA_VISION_MAX_RESPONSE_TOKENS || process.env.OLLAMA_VISION_MAX_RESPONSE_TOKENS || '2048', 10)
                        }
                    },
                    router: {
                        name: envContent.ROUTER_MODEL || process.env.ROUTER_MODEL || '',
                        promptId: 'SYS_ROUTER_V1',
                        limits: {
                            contextWindow: 32768,
                            maxResponseTokens: 2048
                        }
                    },
                    planner: {
                        name: envContent.PLANNER_MODEL || process.env.PLANNER_MODEL || '',
                        limits: {
                            contextWindow: parseInt(envContent.OLLAMA_PLANNER_CONTEXT_WINDOW || process.env.OLLAMA_PLANNER_CONTEXT_WINDOW || '32768', 10),
                            maxResponseTokens: parseInt(envContent.OLLAMA_PLANNER_MAX_RESPONSE_TOKENS || process.env.OLLAMA_PLANNER_MAX_RESPONSE_TOKENS || '2048', 10)
                        }
                    },
                    orchestrator: {
                        name: envContent.ORCHESTRATOR_MODEL || process.env.ORCHESTRATOR_MODEL || '',
                        promptId: 'SYS_ORCHESTRATOR_V1',
                        limits: {
                            contextWindow: 32768,
                            maxResponseTokens: 2048
                        }
                    },
                    translation: {
                        name: envContent.TRANSLATION_MODEL || process.env.TRANSLATION_MODEL || '',
                        limits: {
                            contextWindow: parseInt(envContent.TRANSLATION_CONTEXT_WINDOW || process.env.TRANSLATION_CONTEXT_WINDOW || '128000', 10),
                            maxResponseTokens: 4096
                        }
                    },
                    guidance: {
                        name: envContent.GUIDANCE_MODEL || process.env.GUIDANCE_MODEL || '',
                        limits: {
                            contextWindow: 128000,
                            maxResponseTokens: 4096
                        }
                    },
                    imageTokenOverhead: parseInt(envContent.OLLAMA_VISION_IMAGE_TOKENS || process.env.OLLAMA_VISION_IMAGE_TOKENS || '1024', 10)
                },
                azure: {
                    deploymentName: envContent.AZURE_DEPLOYMENT_NAME || '',
                    apiVersion: envContent.AZURE_API_VERSION || '2023-05-15',
                    model: {
                        name: envContent.AZURE_DEPLOYMENT_NAME || '',
                        limits: {
                            contextWindow: parseInt(envContent.TOKEN_LIMIT || '128000', 10),
                            maxResponseTokens: parseInt(envContent.RESPONSE_TOKENS || '4096', 10)
                        }
                    }
                },
                custom: {
                    model: {
                        name: envContent.CUSTOM_MODEL || '',
                        limits: {
                            contextWindow: parseInt(envContent.TOKEN_LIMIT || '128000', 10),
                            maxResponseTokens: parseInt(envContent.RESPONSE_TOKENS || '4096', 10)
                        }
                    }
                },
                globalLimits: {
                    tokenLimit: parseInt(envContent.TOKEN_LIMIT || '128000', 10),
                    responseTokens: parseInt(envContent.RESPONSE_TOKENS || '4096', 10)
                },
                qualitySettings: {
                    textQualityThreshold: parseInt(envContent.TEXT_QUALITY_THRESHOLD || '60', 10),
                    maxVisionPages: parseInt(envContent.MAX_VISION_PAGES || '4', 10)
                },
                expertPipelineEnabled: (envContent.EXPERT_PIPELINE_ENABLED || process.env.EXPERT_PIPELINE_ENABLED) === 'yes',
                expertModels: {
                    medical: {
                        vision: { name: envContent.MEDICAL_VISION_MODEL || 'llava-med-v1.6', promptId: 'MED_RADIOLOGY_V1', limits: { contextWindow: 32768, maxResponseTokens: 4096 } },
                        analysis: { name: envContent.MEDICAL_ANALYSIS_MODEL || 'medtext-llama3', promptId: 'MED_DOCTOR_V1', limits: { contextWindow: 128000, maxResponseTokens: 4096 } },
                        radiology: { name: envContent.MEDICAL_RADIOLOGY_MODEL || 'llava-med-v1.6', promptId: 'MED_RADIOLOGY_V1', limits: { contextWindow: 32768, maxResponseTokens: 4096 } },
                        integrator: { name: envContent.MEDICAL_ANALYSIS_MODEL || 'medtext-llama3', promptId: 'MED_INTEGRATOR_V1', limits: { contextWindow: 128000, maxResponseTokens: 4096 } }
                    },
                    financial: {
                        vision: { name: envContent.FINANCIAL_VISION_MODEL || 'llm-pro-finance-8b', promptId: 'FIN_EXTRACT_V1', limits: { contextWindow: 32768, maxResponseTokens: 4096 } },
                        analysis: { name: envContent.FINANCIAL_ANALYSIS_MODEL || 'fino1-8b', promptId: 'FIN_EXTRACT_V1', limits: { contextWindow: 128000, maxResponseTokens: 4096 } },
                        reasoning: { name: envContent.FINANCIAL_REASONING_MODEL || 'llm-pro-finance-8b', promptId: 'FIN_REASONER_V1', limits: { contextWindow: 128000, maxResponseTokens: 4096 } },
                        vatExpert: { name: envContent.FINANCIAL_VAT_EXPERT || 'llm-pro-finance-8b', promptId: 'FIN_VAT_EXPERT_V1', limits: { contextWindow: 128000, maxResponseTokens: 4096 } }
                    },
                    legal: {
                        vision: { name: envContent.LEGAL_VISION_MODEL || 'qwen3-vl:8b', promptId: 'LEGAL_ORCHESTRATOR_V1', limits: { contextWindow: 32768, maxResponseTokens: 4096 } },
                        analysis: { name: envContent.LEGAL_ANALYSIS_MODEL || 'gpt-oss', promptId: 'LEGAL_EXTRACTOR_V1', limits: { contextWindow: 128000, maxResponseTokens: 4096 } },
                        orchestrator: { name: envContent.LEGAL_ORCHESTRATOR_MODEL || '', promptId: 'LEGAL_ORCHESTRATOR_V1', limits: { contextWindow: 32768, maxResponseTokens: 2048 } }
                    }
                }
            },
            processing: {
                addAiProcessedTag: (envContent.ADD_AI_PROCESSED_TAG || process.env.ADD_AI_PROCESSED_TAG) === 'yes',
                processExistingDocuments: (envContent.PROCESS_EXISTING_DOCUMENTS || process.env.PROCESS_EXISTING_DOCUMENTS) === 'yes',
                scanInterval: envContent.SCAN_INTERVAL || process.env.SCAN_INTERVAL || '*/30 * * * *',
                disableAutomaticProcessing: (envContent.DISABLE_AUTOMATIC_PROCESSING || process.env.DISABLE_AUTOMATIC_PROCESSING) === 'yes' ? 'yes' : 'no'
            },
            version: configFile.PAPERLESS_AI_VERSION || 'unknown'
        });
    } catch (error) {
        logger.error('[Settings API] Get config failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/settings/test-connection
 * Test connection to Paperless-ngx API
 */
router.post('/test-connection', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const { paperlessApiUrl, paperlessApiToken, timeout = 10000 } = req.body;

        if (!paperlessApiUrl) {
            return res.status(400).json({ success: false, message: 'API URL is required' });
        }

        // Ensure URL ends with /api
        let cleanUrl = paperlessApiUrl.trim();
        if (!cleanUrl.endsWith('/api')) {
            cleanUrl = cleanUrl.replace(/\/?$/, '/api');
        }

        // Handle masked token
        let token = paperlessApiToken;
        if (token === '***hidden***') {
            token = process.env.PAPERLESS_API_TOKEN;
        }

        const testUrl = `${cleanUrl}/documents/?page_size=1`;

        const response = await axios.get(testUrl, {
            headers: token ? {
                'Authorization': `Token ${token}`
            } : {},
            timeout
        });

        if (response.status === 200) {
            const docCount = response.data?.count || 0;
            res.json({
                success: true,
                message: `Connection successful! Found ${docCount} documents.`,
                documentCount: docCount
            });
        } else {
            res.json({
                success: false,
                message: `Unexpected response: ${response.status}`
            });
        }
    } catch (error) {
        logger.error('[Settings API] Connection test failed:', error.message);
        res.json({
            success: false,
            message: error.response?.data?.detail || error.message || 'Connection failed'
        });
    }
});

/**
 * POST /api/settings/test-ollama
 * Test connection to Ollama API
 */
router.post('/test-ollama', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, message: 'Ollama URL is required' });

        const isValid = await setupService.validateOllamaConfig(url);
        if (isValid) {
            res.json({ success: true, message: 'Ollama connection successful!' });
        } else {
            res.json({ success: false, message: 'Ollama connection failed. Check URL and ensure service is running.' });
        }
    } catch (error) {
        logger.error('[Settings API] Ollama test failed:', error.message);
        res.json({ success: false, message: error.message });
    }
});

/**
 * POST /api/settings/test-qdrant
 * Test connection to Qdrant Vector Store
 */
router.post('/test-qdrant', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const { host, port, apiKey } = req.body;
        const qdrantUrl = `http://${host || 'qdrant'}:${port || '6333'}/healthz`;
        
        const response = await axios.get(qdrantUrl, {
            headers: apiKey ? { 'api-key': apiKey } : {},
            timeout: 5000
        });

        if (response.status === 200) {
            res.json({ success: true, message: 'Qdrant connection successful!' });
        } else {
            res.json({ success: false, message: `Qdrant returned status: ${response.status}` });
        }
    } catch (error) {
        logger.error('[Settings API] Qdrant test failed:', error.message);
        res.json({ success: false, message: `Qdrant unreachable: ${error.message}` });
    }
});

/**
 * POST /api/settings/save
 * Save settings (partial update)
 */
router.post('/save', express.json(), authenticateApi, requireAdmin, async (req, res) => {
    try {
        const updates = req.body;

        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Invalid request body' });
        }

        // Read current env file
        let envLines = [];
        try {
            const envFile = await fs.readFile(ENV_FILE_PATH, 'utf8');
            envLines = envFile.split('\n');
        } catch (e) {
            logger.warn('[Settings API] Creating new env file');
        }

        // Update or add new values
        const existingKeys = new Set();
        envLines = envLines.map(line => {
            const match = line.match(/^([A-Z_]+)=/);
            if (match) {
                const key = match[1];
                existingKeys.add(key);
                if (Object.hasOwn(updates, key)) {
                    return `${key}=${updates[key]}`;
                }
            }
            return line;
        });

        // Add new keys that weren't in the file
        Object.entries(updates).forEach(([key, value]) => {
            if (!existingKeys.has(key)) {
                envLines.push(`${key}=${value}`);
            }
        });

        // Write back
        await fs.writeFile(ENV_FILE_PATH, envLines.join('\n'), 'utf8');

        // Determine if restart is required
        // Most settings in the Expert Pipeline environment require a full process restart to reload config
        const restartRequired = Object.keys(updates).some(key =>
            ['PAPERLESS_API_URL', 'PAPERLESS_API_TOKEN', 'AI_PROVIDER',
             'OLLAMA_API_URL', 'PAPERLESS_OPENAI_API_KEY', 'EXPERT_PIPELINE_ENABLED',
             'OLLAMA_MODEL', 'OLLAMA_VISION_MODEL', 'PLANNER_MODEL', 'ROUTER_MODEL',
             'ORCHESTRATOR_MODEL', 'MEDICAL_VISION_MODEL', 'MEDICAL_ANALYSIS_MODEL',
             'MEDICAL_RADIOLOGY_MODEL', 'FINANCIAL_ANALYSIS_MODEL', 'FINANCIAL_REASONING_MODEL',
             'FINANCIAL_VISION_MODEL', 'FINANCIAL_VAT_EXPERT', 'LEGAL_VISION_MODEL',
             'LEGAL_ANALYSIS_MODEL', 'LEGAL_ORCHESTRATOR_MODEL',
             'AZURE_ENDPOINT', 'AZURE_API_KEY', 'CUSTOM_BASE_URL', 'CUSTOM_API_KEY',
             'QDRANT_HOST', 'QDRANT_PORT', 'QDRANT_API_KEY',
             'VISUAL_RAG_URL', 'TEXT_RAG_URL', 'GUIDANCE_SERVICE_URL', 'BIAS_ENGINE_URL',
             'REDIS_URL', 'VISION_KEEP_ALIVE', 'TEXT_KEEP_ALIVE', 'ROUTER_KEEP_ALIVE',
             'GUIDANCE_TIMEOUT', 'VISUAL_RAG_TIMEOUT',
             'OLLAMA_CONTEXT_WINDOW', 'OLLAMA_MAX_RESPONSE_TOKENS',
             'OLLAMA_VISION_CONTEXT_WINDOW', 'OLLAMA_VISION_MAX_RESPONSE_TOKENS',
             'OLLAMA_VISION_IMAGE_TOKENS', 'OLLAMA_PLANNER_CONTEXT_WINDOW',
             'OLLAMA_PLANNER_MAX_RESPONSE_TOKENS', 'OLLAMA_EXPERT_CONTEXT_WINDOW',
             'OLLAMA_EXPERT_MAX_RESPONSE_TOKENS', 'TRANSLATION_CONTEXT_WINDOW',
             'TOKEN_LIMIT', 'RESPONSE_TOKENS', 'TEXT_QUALITY_THRESHOLD',
             'MAX_VISION_PAGES', 'PAPERLESS_OPENAI_MODEL', 'CUSTOM_MODEL', 'AZURE_DEPLOYMENT_NAME', 'AZURE_API_VERSION'].includes(key)
        );

        const autoRestartEnabled = isEnabled(
            process.env.SETTINGS_AUTO_RESTART_ENABLED,
            false
        );

        const message = restartRequired
            ? autoRestartEnabled
                ? 'Settings saved. Restart scheduled.'
                : 'Settings saved. Restart required to apply changes.'
            : 'Settings saved.';

        res.json({ success: true, message, restartRequired });

        if (restartRequired && autoRestartEnabled) {
            logger.info(
                '[Settings API] Auto-restart enabled. Restarting due to config '
                + 'change...'
            );
            setTimeout(() => {
                process.exit(0);
            }, 1000);
            return;
        }

        if (restartRequired) {
            logger.info(
                '[Settings API] Restart required; deferred to explicit '
                + '/api/settings/restart request.'
            );
        }
    } catch (error) {
        logger.error('[Settings API] Save failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/settings/regenerate-api-key
 * Regenerates the system API key
 */
router.post('/regenerate-api-key', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const newKey = crypto.randomBytes(64).toString('hex');
        
        // Read current env file
        let envLines = [];
        try {
            const envFile = await fs.readFile(ENV_FILE_PATH, 'utf8');
            envLines = envFile.split('\n');
        } catch (e) {
            logger.warn('[Settings API] Creating new env file for API key');
        }

        // Update or add API_KEY
        let keyUpdated = false;
        envLines = envLines.map(line => {
            if (line.startsWith('API_KEY=')) {
                keyUpdated = true;
                return `API_KEY=${newKey}`;
            }
            return line;
        });

        if (!keyUpdated) {
            envLines.push(`API_KEY=${newKey}`);
        }

        // Write back
        await fs.writeFile(ENV_FILE_PATH, envLines.join('\n'), 'utf8');
        
        logger.info('[Settings API] System API Key regenerated');
        
        res.json({
            success: true,
            apiKey: newKey,
            message: 'API Key regenerated successfully.'
        });
    } catch (error) {
        logger.error('[Settings API] API key regeneration failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/settings/health
 * Check health of connected services
 */
router.get('/health', async (req, res) => {
    const health = {
        paperless: { status: 'unknown', message: '' },
        ollama: { status: 'unknown', message: '', models: [] },
        text_rag: { status: 'unknown', message: '' },
        visual_rag: { status: 'unknown', message: '' },
        qdrant: { status: 'unknown', message: '' },
        guidance: { status: 'unknown', message: '' },
        redis: { status: 'unknown', message: '' }
    };

    // Check Paperless
    try {
        const paperlessUrl = process.env.PAPERLESS_API_URL || 'http://webserver:8000/api';
        const response = await axios.get(`${paperlessUrl}/documents/?page_size=1`, {
            headers: { 'Authorization': `Token ${process.env.PAPERLESS_API_TOKEN}` },
            timeout: 5000
        });
        health.paperless = { status: 'ok', message: `${response.data?.count || 0} documents` };
    } catch (e) {
        health.paperless = { status: 'error', message: e.message };
    }

    // Check Ollama
    try {
        const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
        const response = await axios.get(`${ollamaUrl}/api/tags`, { timeout: 5000 });
        health.ollama = {
            status: 'ok',
            message: `${response.data?.models?.length || 0} models`,
            models: response.data?.models?.map(m => m.name) || []
        };
    } catch (e) {
        health.ollama = { status: 'error', message: e.message };
    }

    // Check Text-RAG
    const text_rag_url = process.env.RAG_SERVICE_URL || process.env.TEXT_RAG_URL || 'http://text-rag:8004';
    try {
        const response = await axios.get(`${text_rag_url}/health`, { timeout: 5000 });
        // Use 'status' key consistently for frontend HealthBadge
        health.text_rag = { 
            status: response.data?.status || response.data?.overall_status || 'ok', 
            message: response.data?.message || '' 
        };
    } catch (e) {
        health.text_rag = { status: 'error', message: e.message };
    }

    // Check Visual-RAG
    const visual_rag_url = process.env.VISUAL_RAG_URL || 'http://visual-rag:8001';
    try {
        const response = await axios.get(`${visual_rag_url}/health`, { timeout: 5000 });
        health.visual_rag = {
            status: response.data?.status || 'ok',
            message: response.data?.model_id || '',
            vram: response.data?.vram_gb
        };
    } catch (e) {
        health.visual_rag = { status: 'error', message: e.message };
    }

    // Check Qdrant
    try {
        const qdrantHost = process.env.QDRANT_HOST || 'qdrant';
        const qdrantPort = process.env.QDRANT_PORT || '6333';
        const response = await axios.get(`http://${qdrantHost}:${qdrantPort}/collections`, { timeout: 5000 });
        const collections = response.data?.result?.collections || [];
        health.qdrant = { status: 'ok', message: `${collections.length} collections` };
    } catch (e) {
        health.qdrant = { status: 'error', message: e.message };
    }

    // Check Guidance Service
    try {
        const guidanceUrl = process.env.GUIDANCE_SERVICE_URL || 'http://guidance-service:8002';
        const response = await axios.get(`${guidanceUrl}/health`, { timeout: 5000 });
        health.guidance = { status: 'ok', message: response.data?.message || 'Connected' };
    } catch (e) {
        health.guidance = { status: 'error', message: e.message };
    }

    // Check Redis (TCP connect test)
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://broker:6379';
        const parsed = new URL(redisUrl);
        const host = parsed.hostname || 'broker';
        const port = parsed.port || '6379';
        const net = require('net');
        const connected = await new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(5000);
            socket.connect(parseInt(port, 10), host, () => { socket.destroy(); resolve(true); });
            socket.on('error', () => { socket.destroy(); resolve(false); });
            socket.on('timeout', () => { socket.destroy(); resolve(false); });
        });
        health.redis = connected
            ? { status: 'ok', message: 'Connected' }
            : { status: 'error', message: 'Unreachable' };
    } catch (e) {
        health.redis = { status: 'error', message: e.message };
    }

    res.json(health);
});

/**
 * POST /api/settings/test-guidance
 * Test connection to Guidance Service
 */
router.post('/test-guidance', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const { url } = req.body;
        const guidanceUrl = url || process.env.GUIDANCE_SERVICE_URL || 'http://guidance-service:8002';
        const response = await axios.get(`${guidanceUrl}/health`, { timeout: 5000 });
        if (response.status === 200) {
            res.json({ success: true, message: 'Guidance Service connection successful!' });
        } else {
            res.json({ success: false, message: `Guidance Service returned status: ${response.status}` });
        }
    } catch (error) {
        logger.error('[Settings API] Guidance test failed:', error.message);
        res.json({ success: false, message: `Guidance Service unreachable: ${error.message}` });
    }
});

/**
 * POST /api/settings/test-text-rag
 * Test connection to Text RAG Service
 */
router.post('/test-text-rag', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const { url } = req.body;
        const testUrl = url || process.env.RAG_SERVICE_URL || process.env.TEXT_RAG_URL || 'http://text-rag:8004';
        const response = await axios.get(`${testUrl}/health`, { timeout: 5000 });
        if (response.status === 200) {
            res.json({ success: true, message: 'Text RAG connection successful!' });
        } else {
            res.json({ success: false, message: `Text RAG returned status: ${response.status}` });
        }
    } catch (error) {
        logger.error('[Settings API] Text RAG test failed:', error.message);
        res.json({ success: false, message: `Text RAG unreachable: ${error.message}` });
    }
});

/**
 * POST /api/settings/test-visual-rag
 * Test connection to Visual RAG Service
 */
router.post('/test-visual-rag', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const { url } = req.body;
        const testUrl = url || process.env.VISUAL_RAG_URL || 'http://visual-rag:8001';
        const response = await axios.get(`${testUrl}/health`, { timeout: 5000 });
        if (response.status === 200) {
            res.json({ success: true, message: 'Visual RAG connection successful!' });
        } else {
            res.json({ success: false, message: `Visual RAG returned status: ${response.status}` });
        }
    } catch (error) {
        logger.error('[Settings API] Visual RAG test failed:', error.message);
        res.json({ success: false, message: `Visual RAG unreachable: ${error.message}` });
    }
});

/**
 * POST /api/settings/test-redis
 * Test connection to Redis
 */
router.post('/test-redis', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const { url } = req.body;
        const redisUrl = url || process.env.REDIS_URL || 'redis://broker:6379';
        const parsed = new URL(redisUrl);
        const host = parsed.hostname || 'broker';
        const port = parsed.port || '6379';
        const net = require('net');
        const connected = await new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(5000);
            socket.connect(parseInt(port, 10), host, () => { socket.destroy(); resolve(true); });
            socket.on('error', () => { socket.destroy(); resolve(false); });
            socket.on('timeout', () => { socket.destroy(); resolve(false); });
        });
        if (connected) {
            res.json({ success: true, message: 'Redis connection successful!' });
        } else {
            res.json({ success: false, message: 'Redis unreachable' });
        }
    } catch (error) {
        logger.error('[Settings API] Redis test failed:', error.message);
        res.json({ success: false, message: `Redis unreachable: ${error.message}` });
    }
});

/**
 * GET /api/settings/presets
 * Returns list of available configuration presets
 */
router.get('/presets', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const presetsDir = path.join(__dirname, '../../config/presets');
        const files = await fs.readdir(presetsDir);
        
        const presets = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await fs.readFile(path.join(presetsDir, file), 'utf8');
                    const preset = JSON.parse(content);
                    // Use file name without ext as the internal name
                    presets.push({
                        name: path.parse(file).name,
                        displayName: preset.displayName || path.parse(file).name,
                        description: preset.description || '',
                        category: preset.category || 'custom',
                        icon: preset.icon || '📦'
                    });
                } catch (e) {
                    logger.warn(`[Settings API] Could not parse preset file ${file}:`, e.message);
                }
            }
        }
        
        res.json({ success: true, presets });
    } catch (error) {
        logger.error('[Settings API] List presets failed:', error);
        res.status(500).json({ error: 'Failed to list presets' });
    }
});

/**
 * POST /api/settings/presets/:name
 * Preview (diff) or apply a preset
 */
router.post('/presets/:name', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const { name } = req.params;
        const { preview = true } = req.body;
        
        const presetPath = path.join(__dirname, '../../config/presets', `${name}.json`);
        let presetData;
        try {
            const content = await fs.readFile(presetPath, 'utf8');
            presetData = JSON.parse(content);
        } catch (e) {
            return res.status(404).json({ success: false, error: `Preset "${name}" not found` });
        }
        
        const presetValues = presetData.settings || {};
        
        // Read current env file for diff
        let currentEnv = {};
        try {
            const envFile = await fs.readFile(ENV_FILE_PATH, 'utf8');
            envFile.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split('=');
                if (key && key.trim() && !key.startsWith('#')) {
                    currentEnv[key.trim()] = valueParts.join('=').trim();
                }
            });
        } catch (e) {}
        
        // Calculate diff
        const changes = [];
        let requiresRestart = false;
        
        const restartKeys = [
            'PAPERLESS_API_URL', 'PAPERLESS_API_TOKEN', 'AI_PROVIDER',
            'OLLAMA_API_URL', 'PAPERLESS_OPENAI_API_KEY', 'EXPERT_PIPELINE_ENABLED'
        ];
        
        Object.entries(presetValues).forEach(([key, newValue]) => {
            const currentValue = currentEnv[key];
            if (String(currentValue) !== String(newValue)) {
                changes.push({
                    key,
                    currentValue: currentValue || null,
                    newValue,
                    category: key.split('_')[0] || 'General'
                });
                if (restartKeys.some(rk => key.startsWith(restartKeys))) {
                    requiresRestart = true;
                }
            }
        });
        
        if (preview) {
            return res.json({
                success: true,
                diff: {
                    presetName: name,
                    changes,
                    requiresRestart
                }
            });
        }
        
        // Apply logic: update ENV file
        let envLines = [];
        try {
            const envFile = await fs.readFile(ENV_FILE_PATH, 'utf8');
            envLines = envFile.split('\n');
        } catch (e) {}
        
        const existingKeys = new Set();
        envLines = envLines.map(line => {
            const match = line.match(/^([A-Z_]+)=/);
            if (match) {
                const key = match[1];
                existingKeys.add(key);
                if (Object.hasOwn(presetValues, key)) {
                    return `${key}=${presetValues[key]}`;
                }
            }
            return line;
        });
        
        Object.entries(presetValues).forEach(([key, value]) => {
            if (!existingKeys.has(key)) {
                envLines.push(`${key}=${value}`);
            }
        });
        
        await fs.writeFile(ENV_FILE_PATH, envLines.join('\n'), 'utf8');
        
        res.json({
            success: true,
            message: `Preset "${name}" applied successfully`,
            requiresRestart
        });
        
    } catch (error) {
        logger.error('[Settings API] Apply preset failed:', error);
        res.status(500).json({ error: 'Failed to apply preset' });
    }
});

/**
 * GET /api/settings/export
 * Downloads the current runtime.env as a file
 */
router.get('/export', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const content = await fs.readFile(ENV_FILE_PATH, 'utf8');
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename=paperless-ai.env');
        res.send(content);
    } catch (error) {
        res.status(500).send('Failed to export settings');
    }
});

/**
 * POST /api/settings/import
 * Previews or applies an uploaded .env file
 */
router.post('/import', express.json(), authenticateApi, requireAdmin, async (req, res) => {
    try {
        const { content, preview = true } = req.body;
        if (!content) return res.status(400).json({ error: 'No content provided' });
        
        // Simple .env parser
        const importedValues = {};
        content.split('\n').forEach(line => {
            const match = line.match(/^([A-Z_]+)=(.*)$/);
            if (match) {
                importedValues[match[1]] = match[2].trim();
            }
        });
        
        // Read current
        let currentEnv = {};
        try {
            const envFile = await fs.readFile(ENV_FILE_PATH, 'utf8');
            envFile.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split('=');
                if (key && key.trim() && !key.startsWith('#')) {
                    currentEnv[key.trim()] = valueParts.join('=').trim();
                }
            });
        } catch (e) {}
        
        // Diff
        const changes = [];
        let requiresRestart = false;
        Object.entries(importedValues).forEach(([key, newValue]) => {
            const currentValue = currentEnv[key];
            if (String(currentValue) !== String(newValue)) {
                changes.push({ key, currentValue: currentValue || null, newValue });
                requiresRestart = true; // Imports always trigger restart for safety
            }
        });
        
        if (preview) {
            return res.json({ success: true, diff: { presetName: 'Import', changes, requiresRestart } });
        }
        
        // Apply
        await fs.writeFile(ENV_FILE_PATH, content, 'utf8');
        res.json({ success: true, changesCount: changes.length, requiresRestart });
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to import settings' });
    }
});

/**
 * POST /api/settings/restart
 * Trigger a graceful application restart
 */
router.post('/restart', authenticateApi, requireAdmin, (req, res) => {
    logger.info('[Settings API] Restart requested by admin user:', req.user.username);
    
    res.json({ success: true, message: 'Application is restarting...' });

    // Trigger graceful exit (PM2 or Docker will restart the container)
    setTimeout(() => {
        logger.info('[Settings API] Exiting process for restart...');
        process.exit(0);
    }, 1000);
});

module.exports = router;
