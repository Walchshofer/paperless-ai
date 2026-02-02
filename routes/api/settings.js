/**
 * Settings API Routes
 *
 * Provides JSON API endpoints for settings islands to fetch/update configuration.
 * These endpoints are used by the React islands in the settings page.
 */
const express = require('express');
const router = express.Router();
const config = require('../../config/config.js');
const logger = require('../../services/logger');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { authenticateApi, requireAdmin } = require('../../middleware/auth');

// Environment file path
const ENV_FILE_PATH = path.join(__dirname, '../../data/runtime.env');

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

        res.json({
            connection: {
                paperlessApiUrl: envContent.PAPERLESS_API_URL || process.env.PAPERLESS_API_URL || '',
                paperlessApiToken: envContent.PAPERLESS_API_TOKEN ? '***hidden***' : '',
                paperlessUsername: envContent.PAPERLESS_USERNAME || process.env.PAPERLESS_USERNAME || ''
            },
            aiProvider: {
                provider: envContent.AI_PROVIDER || process.env.AI_PROVIDER || 'ollama',
                openai: {
                    apiKey: envContent.PAPERLESS_OPENAI_API_KEY ? '***hidden***' : '',
                    model: envContent.PAPERLESS_OPENAI_MODEL || process.env.PAPERLESS_OPENAI_MODEL || 'gpt-4'
                },
                ollama: {
                    url: envContent.OLLAMA_API_URL || process.env.OLLAMA_API_URL || 'http://localhost:11434',
                    model: envContent.OLLAMA_MODEL || process.env.OLLAMA_MODEL || ''
                },
                azure: {
                    endpoint: envContent.AZURE_ENDPOINT || '',
                    deploymentName: envContent.AZURE_DEPLOYMENT_NAME || ''
                }
            },
            processing: {
                addAiProcessedTag: envContent.ADD_AI_PROCESSED_TAG === 'yes',
                processExistingDocuments: envContent.PROCESS_EXISTING_DOCUMENTS === 'yes',
                scanInterval: parseInt(envContent.SCAN_INTERVAL, 10) || 60
            },
            version: config.PAPERLESS_AI_VERSION || 'unknown'
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
        let apiUrl = paperlessApiUrl.trim();
        if (!apiUrl.endsWith('/api')) {
            apiUrl = apiUrl.replace(/\/?$/, '/api');
        }

        const testUrl = `${apiUrl}/documents/?page_size=1`;

        const response = await axios.get(testUrl, {
            headers: paperlessApiToken ? {
                'Authorization': `Token ${paperlessApiToken}`
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
        const restartRequired = Object.keys(updates).some(key =>
            ['PAPERLESS_API_URL', 'PAPERLESS_API_TOKEN', 'AI_PROVIDER',
             'OLLAMA_API_URL', 'PAPERLESS_OPENAI_API_KEY'].includes(key)
        );

        res.json({
            success: true,
            message: restartRequired ? 'Settings saved. Restart required.' : 'Settings saved.',
            restartRequired
        });
    } catch (error) {
        logger.error('[Settings API] Save failed:', error);
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
        textRag: { status: 'unknown', message: '' },
        visualRag: { status: 'unknown', message: '' },
        qdrant: { status: 'unknown', message: '' }
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
    try {
        const textRagUrl = process.env.TEXT_RAG_URL || 'http://text-rag:8004';
        const response = await axios.get(`${textRagUrl}/health`, { timeout: 5000 });
        health.textRag = { status: response.data?.overall_status || 'ok', message: response.data?.message || '' };
    } catch (e) {
        health.textRag = { status: 'error', message: e.message };
    }

    // Check Visual-RAG
    try {
        const visualRagUrl = process.env.VISUAL_RAG_URL || 'http://visual-rag:8001';
        const response = await axios.get(`${visualRagUrl}/health`, { timeout: 5000 });
        health.visualRag = {
            status: response.data?.status || 'ok',
            message: response.data?.model_id || '',
            vram: response.data?.vram_gb
        };
    } catch (e) {
        health.visualRag = { status: 'error', message: e.message };
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

    res.json(health);
});

module.exports = router;
