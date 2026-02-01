const express = require('express');
const router = express.Router();
const setupService = require('../services/setupService.js');
const paperlessService = require('../services/paperlessService.js');
const ollamaService = require('../services/ollamaService.js');
const documentModel = require('../services/documentModel.js');
const configFile = require('../config/config.js');
const RAGService = require('../services/ragService.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const _logger = require('../services/logger');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const { expertRegistry } = require('../services/experts/ExpertRegistry');
const config = require('../config/config.js');
const dashboardService = require('../src/services/dashboardService.js');
// Load runtime env persisted by setup (renamed to data/runtime.env)
require('dotenv').config({ path: '../data/runtime.env' });

// Simple in-memory cache for expert models to avoid frequent registry scans
const _expertModelsCache = {
  models: null,
  ts: 0
};
const EXPERT_MODELS_CACHE_TTL_MS = parseInt(process.env.EXPERT_MODELS_CACHE_TTL_MS, 10) || 10000; // 10s default

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: User authentication and authorization endpoints, including login, logout, and token management
 *   - name: Documents
 *     description: Document management and processing endpoints for interacting with Paperless-ngx documents
 *   - name: History
 *     description: Document processing history and tracking of AI-generated metadata
 *   - name: Navigation
 *     description: General navigation endpoints for the web interface
 *   - name: System
 *     description: System configuration, health checks, and administrative functions
 *   - name: Chat
 *     description: Document chat functionality for interacting with document content using AI
 *   - name: Setup
 *     description: Application setup and configuration endpoints
 *   - name: Metadata
 *     description: Endpoints for managing document metadata like tags, correspondents, and document types
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *           example: Error resetting documents
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           description: User's username
 *         password:
 *           type: string
 *           format: password
 *           description: User's password (will be hashed)
 *     Document:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Document ID
 *           example: 123
 *         title:
 *           type: string
 *           description: Document title
 *           example: Invoice #12345
 *         tags:
 *           type: array
 *           items:
 *             type: integer
 *           description: Array of tag IDs
 *           example: [1, 4, 7]
 *         correspondent:
 *           type: integer
 *           description: Correspondent ID
 *           example: 5
 *     HistoryItem:
 *       type: object
 *       properties:
 *         document_id:
 *           type: integer
 *           description: Document ID
 *           example: 123
 *         title:
 *           type: string
 *           description: Document title
 *           example: Invoice #12345
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Date and time when the processing occurred
 *         tags:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Tag'
 *         correspondent:
 *           type: string
 *           description: Document correspondent name
 *           example: Acme Corp
 *         link:
 *           type: string
 *           description: Link to the document in Paperless-ngx
 *     Tag:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Tag ID
 *           example: 5
 *         name:
 *           type: string
 *           description: Tag name
 *           example: Invoice
 *         color:
 *           type: string
 *           description: Tag color (hex code)
 *           example: "#FF5733"
 */

// Explicit public endpoint for Ollama model discovery (placed before auth/setup guard)
router.get('/api/ollama/models', async (req, res) => {
  try {
    let installedModels = [];
    try {
      installedModels = await ollamaService.listModels();
    } catch (e) {
      installedModels = [];
    }

    const installedSet = new Set((installedModels || []).filter(m => typeof m === 'string' && m));

    const configuredSet = new Set();
    const addConfigured = (model) => { if (!model || typeof model !== 'string') return; const trimmed = model.trim(); if (!trimmed) return; configuredSet.add(trimmed); };

    addConfigured(config.ollama?.model);
    addConfigured(config.ollama?.visionModel);
    addConfigured(config.ollama?.plannerModel);
    addConfigured(config.ollama?.routerModel);
    addConfigured(config.ollama?.orchestratorModel);

    const expertConfig = config.expertModels || {};
    const expertMedical = expertConfig.medical || {};
    const expertFinancial = expertConfig.financial || {};
    const expertLegal = expertConfig.legal || {};

    addConfigured(expertMedical.vision);
    addConfigured(expertMedical.analysis);
    addConfigured(expertMedical.radiology);
    addConfigured(expertFinancial.analysis);
    addConfigured(expertFinancial.vision);
    addConfigured(expertFinancial.vatExpert);
    addConfigured(expertLegal.vision);
    addConfigured(expertLegal.analysis);
    addConfigured(expertLegal.orchestrator);

    addConfigured(process.env.FINANCIAL_REASONING_MODEL);
    addConfigured(process.env.LEGAL_ORCHESTRATOR_MODEL);

    const placeholderModels = Array.from(configuredSet).filter(m => !installedSet.has(m));

    res.json({ provider: config.aiProvider, providerMismatch: config.aiProvider !== 'ollama', defaultModel: config.ollama?.model || null, models: installedModels, placeholderModels, expertModels: [] });
  } catch (error) {
    console.error('[ERROR] loading Ollama models (early route):', error);
    res.status(500).json({ error: 'Failed to load Ollama models' });
  }
});

// Routes that don't require authentication
let PUBLIC_ROUTES = [
  '/health',
  '/login',
  '/logout',
  '/setup',
  '/settings',
  '/dashboard',
  '/api/visual-rag',
  '/api/feedback',
  // Allow unauthenticated access to Ollama model discovery for UI dropdowns (harmless metadata)
  '/api/ollama/models',
  // Allow unauthenticated programmatic manual updates for test harnesses and automated integrations
  '/manual/updateDocument'
];

if (
  process.env.NODE_ENV === 'test' ||
  process.env.PLAYWRIGHT_E2E === 'true' ||
  process.env.E2E_TESTS === 'true'
) {
  PUBLIC_ROUTES = PUBLIC_ROUTES.concat([
    '/manual',
    '/manual/preview',
    '/manual/tags',
    '/manual/documents',
    '/manual/analyze',
    '/manual/analyze-visual',
    '/manual/playground'
  ]);
}

// Combined middleware to check authentication and setup
router.use(async (req, res, next) => {
  const token = req.cookies.jwt || req.headers.authorization?.split(' ')[1];
  const apiKey = req.headers['x-api-key'];

  // Public route check - use originalUrl when available to be robust across mounts
  const pathToCheck = req.originalUrl || req.path || '';

  const isPublic = PUBLIC_ROUTES.some(route => pathToCheck.startsWith(route));
  if (isPublic) {
    return next();
  }

  // API key authentication
  if (apiKey && apiKey === process.env.API_KEY) {
    req.user = { apiKey: true };
  } else {
    // Fallback to JWT authentication
    if (!token) {
      // For API requests, return JSON 401 instead of redirecting to /login
      if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      return res.redirect('/login');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch {
      res.clearCookie('jwt');
      // Return JSON 403 for API clients when token verification fails
      if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(403).json({ message: 'Invalid or expired token' });
      }
      return res.redirect('/login');
    }
  }

  // Setup check
  try {
    const isConfigured = await setupService.isConfigured();
 
    // Allow certain informational API endpoints during initial setup (e.g. model discovery)
    if (!isConfigured && (!process.env.PAPERLESS_AI_INITIAL_SETUP || process.env.PAPERLESS_AI_INITIAL_SETUP === 'no') && !req.path.startsWith('/setup') && !req.path.startsWith('/api/ollama/models')) {
      return res.redirect('/setup');
    } else if (!isConfigured && process.env.PAPERLESS_AI_INITIAL_SETUP === 'yes' && !req.path.startsWith('/settings') && !req.path.startsWith('/api/ollama/models')) {
      return res.redirect('/settings');
    }
  } catch (error) {
    console.error('Error checking setup configuration:', error);
    return res.status(500).send('Internal Server Error');
  }
  
  next();
});

// Protected route middleware for API endpoints
const protectApiRoute = (req, res, next) => {
  const token = req.cookies.jwt || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Documents view route
/**
 * @swagger
 * /playground:
 *   get:
 *     summary: AI playground testing environment
 *     description: |
 *       Renders the AI playground page for experimenting with document analysis.
 *       
 *       This interactive environment allows users to test different AI providers and prompts
 *       on document content without affecting the actual document processing workflow.
 *       Users can paste document text, customize prompts, and see raw AI responses
 *       to better understand how the AI models analyze document content.
 *       
 *       The playground is useful for fine-tuning prompts and testing AI capabilities
 *       before applying them to actual document processing.
 *     tags:
 *       - Navigation
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Playground page rendered successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML content of the AI playground interface
 *       401:
 *         description: Unauthorized - user not authenticated
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: "/login"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/playground', protectApiRoute, async (req, res) => {
  // Simplified: Island architecture - no document data needed (ticket:017.4)
  try {
    res.render('playground', {
      vm: {
        version: configFile.PAPERLESS_AI_VERSION || ' ',
        DISABLE_GITHUB_FETCH: config.DISABLE_GITHUB_FETCH || 'no',
        page: 'playground'
      }
    });
  } catch (error) {
    console.error('[ERRO] loading playground view:', error);
    res.status(500).send('Error loading playground');
  }
});

// Dev-only: shadcn/ui compatibility test page
router.get('/islands/shadcn-compat', protectApiRoute, async (req, res) => {
  try {
    res.render('islands/shadcn-compat', {
      version: configFile.PAPERLESS_AI_VERSION || ' '
    });
  } catch (error) {
    console.error('[ERRO] loading shadcn compat view:', error);
    res.status(500).send('Error loading view');
  }
});

// Nachricht senden
router.get('/api/ollama/models', async (req, res) => {
  try {
    const provider = config.aiProvider;
    const defaultModel = config.ollama?.model || null;

    // Always attempt to list models; Ollama can be used for experts even when
    // another provider is selected.
    let installedModels = [];
    try {
      installedModels = await ollamaService.listModels();
    } catch (error) {
      installedModels = [];
    }

    const installedSet = new Set(
      (installedModels || []).filter((m) => typeof m === 'string' && m)
    );

    // Build a placeholder list from configured models so the dropdown is
    // populated even when Ollama is lazy-loading or offline.
    const configuredSet = new Set();
    const addConfigured = (model) => {
      if (!model || typeof model !== 'string') return;
      const trimmed = model.trim();
      if (!trimmed) return;
      configuredSet.add(trimmed);
    };

    addConfigured(config.ollama?.model);
    addConfigured(config.ollama?.visionModel);
    addConfigured(config.ollama?.plannerModel);
    addConfigured(config.ollama?.routerModel);
    addConfigured(config.ollama?.orchestratorModel);

    const expertConfig = config.expertModels || {};
    const expertMedical = expertConfig.medical || {};
    const expertFinancial = expertConfig.financial || {};
    const expertLegal = expertConfig.legal || {};

    addConfigured(expertMedical.vision);
    addConfigured(expertMedical.analysis);
    addConfigured(expertMedical.radiology);
    addConfigured(expertFinancial.analysis);
    addConfigured(expertFinancial.vision);
    addConfigured(expertFinancial.vatExpert);
    addConfigured(expertLegal.vision);
    addConfigured(expertLegal.analysis);
    addConfigured(expertLegal.orchestrator);

    // Optional expert overrides that are not surfaced in config.expertModels
    addConfigured(process.env.FINANCIAL_REASONING_MODEL);
    addConfigured(process.env.LEGAL_ORCHESTRATOR_MODEL);

    const placeholderModels = Array.from(configuredSet).filter(
      (model) => !installedSet.has(model)
    );

    // Build expert models list from canonical registry (pipeline-centric)
    let expertModels = null;
    const now = Date.now();

    if (
      _expertModelsCache.models &&
      now - _expertModelsCache.ts < EXPERT_MODELS_CACHE_TTL_MS
    ) {
      expertModels = _expertModelsCache.models;
    } else {
      const activePipelines = expertRegistry.list();

      // Create entries per (pipeline, model)
      const entries = activePipelines.flatMap((pipeline) => {
        const requiredModels = expertRegistry.getRequiredModels(pipeline.id);
        return requiredModels.map((model) => ({
          model,
          label: `${pipeline.domain} extraction`,
          domain: pipeline.domain,
          stage: 'extraction',
          pipelineId: pipeline.id,
          pipelineName: pipeline.name,
        }));
      });

      // Deduplicate by model string while preserving first-seen order
      const seen = new Set();
      expertModels = [];
      for (const entry of entries) {
        if (!entry?.model || seen.has(entry.model)) continue;
        seen.add(entry.model);
        expertModels.push(entry);
      }

      _expertModelsCache.models = expertModels;
      _expertModelsCache.ts = now;
    }

    res.json({
      provider,
      providerMismatch: provider !== 'ollama',
      defaultModel,
      models: installedModels,
      placeholderModels,
      expertModels,
    });
  } catch (error) {
    console.error('[ERROR] loading Ollama models:', error);
    res.status(500).json({ error: 'Failed to load Ollama models' });
  }
});

// Verify whether a model is installed or currently loaded in Ollama
router.get('/api/ollama/verify', async (req, res) => {
  try {
    const model = req.query.model;
    if (!model) return res.status(400).json({ error: 'model query parameter required' });

    let installed = [];
    try { installed = await ollamaService.listModels(); } catch (e) { installed = []; }

    let loadedModels = [];
    try {
      const ps = await ollamaService.checkStatus();
      loadedModels = Array.isArray(ps.loadedModels) ? ps.loadedModels : [];
    } catch (e) {
      loadedModels = [];
    }

    const result = {
      model,
      installed: installed.includes(model),
      loaded: loadedModels.some((m) => (m.model || m.name) === model),
      installedList: installed,
      loadedList: loadedModels
    };

    res.json(result);
  } catch (err) {
    console.error('[ERROR] verifying Ollama model:', err);
    res.status(500).json({ error: 'Failed to verify model' });
  }
});


const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [];
};

/**
 * @swagger
 * /setup:
 *   get:
 *     summary: Application setup page
 *     description: |
 *       Renders the application setup page for initial configuration.
 *       
 *       This page allows configuring the connection to Paperless-ngx, AI services,
 *       and other application settings. It loads existing configuration if available
 *       and redirects to dashboard if setup is already complete.
 *       
 *       The setup page is the entry point for new installations and guides users through
 *       the process of connecting to Paperless-ngx, configuring AI providers, and setting up
 *       admin credentials.
 *     tags:
 *       - Navigation
 *       - Setup
 *       - System
 *     responses:
 *       200:
 *         description: Setup page rendered successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML content of the application setup page
 *       302:
 *         description: Redirects to dashboard if setup is already complete
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: "/dashboard"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/setup', async (req, res) => {
  try {
    // Base configuration object - load this FIRST, before any checks
    let config = {
      PAPERLESS_API_URL: (process.env.PAPERLESS_API_URL || 'http://localhost:8000').replace(/\/api$/, ''),
      PAPERLESS_API_TOKEN: process.env.PAPERLESS_API_TOKEN || '',
      PAPERLESS_USERNAME: process.env.PAPERLESS_USERNAME || '',
      AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
      PAPERLESS_OPENAI_API_KEY: process.env.PAPERLESS_OPENAI_API_KEY || '',
      PAPERLESS_OPENAI_MODEL: process.env.PAPERLESS_OPENAI_MODEL || 'gpt-4o-mini',
      OLLAMA_API_URL: process.env.OLLAMA_API_URL || 'http://localhost:11434',
      OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'sauerkraut-llama3.1:8b',
      OLLAMA_CONTEXT_WINDOW: process.env.OLLAMA_CONTEXT_WINDOW || '',
      OLLAMA_MAX_RESPONSE_TOKENS: process.env.OLLAMA_MAX_RESPONSE_TOKENS || '',
      OLLAMA_VISION_CONTEXT_WINDOW: process.env.OLLAMA_VISION_CONTEXT_WINDOW || '',
      OLLAMA_VISION_MAX_RESPONSE_TOKENS: process.env.OLLAMA_VISION_MAX_RESPONSE_TOKENS || '',
      OLLAMA_EXPERT_CONTEXT_WINDOW: process.env.OLLAMA_EXPERT_CONTEXT_WINDOW || '',
      OLLAMA_EXPERT_MAX_RESPONSE_TOKENS: process.env.OLLAMA_EXPERT_MAX_RESPONSE_TOKENS || '',
      TRANSLATION_CONTEXT_WINDOW: process.env.TRANSLATION_CONTEXT_WINDOW || '',
      TRANSLATION_MAX_TOKENS: process.env.TRANSLATION_MAX_TOKENS || '',
      SCAN_INTERVAL: process.env.SCAN_INTERVAL || '*/30 * * * *',
      SYSTEM_PROMPT: process.env.SYSTEM_PROMPT || '',
      PROCESS_PREDEFINED_DOCUMENTS: process.env.PROCESS_PREDEFINED_DOCUMENTS || 'no',
      TOKEN_LIMIT: process.env.TOKEN_LIMIT || 128000,
      RESPONSE_TOKENS: process.env.RESPONSE_TOKENS || 1000,
      TAGS: normalizeArray(process.env.TAGS),
      ADD_AI_PROCESSED_TAG: process.env.ADD_AI_PROCESSED_TAG || 'no',
      AI_PROCESSED_TAG_NAME: process.env.AI_PROCESSED_TAG_NAME || 'ai-processed',
      USE_PROMPT_TAGS: process.env.USE_PROMPT_TAGS || 'no',
      PROMPT_TAGS: normalizeArray(process.env.PROMPT_TAGS),
      PAPERLESS_AI_VERSION: configFile.PAPERLESS_AI_VERSION || ' ',
      PROCESS_ONLY_NEW_DOCUMENTS: process.env.PROCESS_ONLY_NEW_DOCUMENTS || 'yes',
      USE_EXISTING_DATA: process.env.USE_EXISTING_DATA || 'no',
      PIPELINE_TAG_REPLACE: process.env.PIPELINE_TAG_REPLACE || 'no',
      DISABLE_AUTOMATIC_PROCESSING: process.env.DISABLE_AUTOMATIC_PROCESSING || 'no',
      AZURE_ENDPOINT: process.env.AZURE_ENDPOINT|| '',
      AZURE_API_KEY: process.env.AZURE_API_KEY || '',
      AZURE_DEPLOYMENT_NAME: process.env.AZURE_DEPLOYMENT_NAME || '',
      AZURE_API_VERSION: process.env.AZURE_API_VERSION || '',
      QDRANT_HOST: process.env.QDRANT_HOST || 'qdrant',
      QDRANT_PORT: process.env.QDRANT_PORT || '6333',
      QDRANT_API_KEY: process.env.QDRANT_API_KEY || '',
      VECTOR_STORE: process.env.VECTOR_STORE || 'qdrant'
    };

    // Check both configuration and users
    const [isEnvConfigured, users] = await Promise.all([
      setupService.isConfigured(),
      documentModel.getUsers()
    ]);

    // Load saved config if it exists
    if (isEnvConfigured) {
      const savedConfig = await setupService.loadConfig();
      if (savedConfig.PAPERLESS_API_URL) {
        savedConfig.PAPERLESS_API_URL = savedConfig.PAPERLESS_API_URL.replace(/\/api$/, '');
      }

      savedConfig.TAGS = normalizeArray(savedConfig.TAGS);
      savedConfig.PROMPT_TAGS = normalizeArray(savedConfig.PROMPT_TAGS);

      config = { ...config, ...savedConfig };
    }

    // Debug output
    console.log('Current config TAGS:', config.TAGS);
    console.log('Current config PROMPT_TAGS:', config.PROMPT_TAGS);

    // Check if system is fully configured
    const hasUsers = Array.isArray(users) && users.length > 0;
    const isFullyConfigured = isEnvConfigured && hasUsers;

    // Generate appropriate success message
    let successMessage;
    if (isEnvConfigured && !hasUsers) {
      successMessage = 'Environment is configured, but no users exist. Please create at least one user.';
    } else if (isEnvConfigured) {
      successMessage = 'The application is already configured. You can update the configuration below.';
    }

    // If everything is configured and we have users, redirect to dashboard
    // BUT only after we've loaded all the config
    if (isFullyConfigured) {
      return res.redirect('/dashboard');
    }

    // Render setup page with config and appropriate message
    res.render('setup', {
      vm: Object.assign({}, config || {}, { page: 'setup' }),
      success: successMessage
    });
  } catch (error) {
    console.error('Setup route error:', error);
    res.status(500).render('setup', {
      config: {},
      error: 'An error occurred while loading the setup page.'
    });
  }
});

/**
 * @swagger
 * /api/correspondentsCount:
 *   get:
 *     summary: Get count of correspondents
 *     description: |
 *       Retrieves the list of correspondents with their document counts.
 *       This endpoint returns all correspondents in the system along with 
 *       the number of documents associated with each correspondent.
 *     tags: 
 *       - API
 *       - Metadata
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of correspondents with document counts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: ID of the correspondent
 *                     example: 1
 *                   name:
 *                     type: string
 *                     description: Name of the correspondent
 *                     example: "ACME Corp"
 *                   count:
 *                     type: integer
 *                     description: Number of documents associated with this correspondent
 *                     example: 5
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/api/correspondentsCount', async (req, res) => {
  const correspondents = await paperlessService.listCorrespondentsNames();
  res.json(correspondents);
});

/**
 * @swagger
 * /api/tagsCount:
 *   get:
 *     summary: Get count of tags
 *     description: |
 *       Retrieves the list of tags with their document counts.
 *       This endpoint returns all tags in the system along with 
 *       the number of documents associated with each tag.
 *     tags: 
 *       - API
 *       - Metadata
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of tags with document counts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: ID of the tag
 *                     example: 1
 *                   name:
 *                     type: string
 *                     description: Name of the tag
 *                     example: "Invoice"
 *                   count:
 *                     type: integer
 *                     description: Number of documents associated with this tag
 *                     example: 12
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/api/tagsCount', async (req, res) => {
  const tags = await paperlessService.listTagNames();
  res.json(tags);
});

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Main dashboard page
 *     description: |
 *       Renders the main dashboard page of the application with summary statistics and visualizations.
 *       The dashboard provides an overview of processed documents, system metrics, and important statistics
 *       about document processing including tag counts, correspondent counts, and token usage.
 *       
 *       The page displays visualizations for document processing status, token distribution, 
 *       processing time statistics, and document type categorization to help administrators
 *       understand system performance and document processing patterns.
 *     tags:
 *       - Navigation
 *       - System
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Dashboard page rendered successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML content of the dashboard page
 *       401:
 *         description: Unauthorized - user not authenticated
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: "/login"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/dashboard', async (req, res) => {
  try {
    console.log(`[DASHBOARD] Loading metrics at: ${new Date().toISOString()}`);

    // Extract authenticated user from JWT cookie
    let decoded = null;
    try {
      const token = req.cookies.jwt || req.headers.authorization?.split(' ')[1];
      if (token) {
        decoded = jwt.verify(token, JWT_SECRET);
      }
    } catch (err) {
      console.warn('[DASHBOARD] Invalid JWT token, falling back to guest info');
    }

    const user = {
      id: decoded?.id || null,
      username: decoded?.username || 'elfman',
      isAdmin: decoded?.isAdmin !== undefined ? decoded.isAdmin : true,
      lastLogin: new Date().toISOString()
    };

    const vm = await dashboardService.getMetrics(user);
    vm.page = 'dashboard';

    console.log('[DASHBOARD] Metrics loaded successfully:', { 
      documentCount: vm.paperless_data.documentCount, 
      processedDocumentCount: vm.paperless_data.processedDocumentCount,
      tagCount: vm.paperless_data.tagCount,
      correspondentCount: vm.paperless_data.correspondentCount
    });

    if (vm.errors.length > 0) {
       const friendly = 'Some dashboard data could not be loaded. Please check server logs for details.';
       return res.render('dashboard', { vm, error: friendly });
    }

    return res.render('dashboard', { 
      vm, 
      paperless_data: vm.paperless_data, 
      openai_data: vm.openai_data,
      user: vm.user,
      health: vm.health,
      processingStatus: vm.processingStatus,
      recentActivity: vm.recentActivity,
      version: vm.version
    });

  } catch (err) {
    console.error('[ERROR] loading dashboard route:', err);
    // On catastrophic failure, render a friendly error state with safe defaults
    const vm = {
      user: { username: 'elfman', isAdmin: true },
      paperless_data: {
        tagCount: 0,
        correspondentCount: 0,
        documentCount: 0,
        processedDocumentCount: 0,
        processingTimeStats: {},
        tokenDistribution: [{ range: 'No data', count: 0 }],
        documentTypes: [{ type: 'No data', count: 0 }]
      },
      openai_data: {
        averagePromptTokens: 0,
        averageCompletionTokens: 0,
        averageTotalTokens: 0,
        tokensOverall: 0
      },
      processingStatus: { isProcessing: false, processedToday: 0 },
      health: { paperless: 'error', local_db: 'error', ai_service: 'error' },
      version: configFile.PAPERLESS_AI_VERSION || ' ',
      page: 'dashboard'
    };
    return res.status(500).render('dashboard', { 
      vm, 
      paperless_data: vm.paperless_data, 
      openai_data: vm.openai_data,
      user: vm.user,
      health: vm.health,
      processingStatus: vm.processingStatus,
      recentActivity: vm.recentActivity,
      version: vm.version,
      error: 'Unable to load dashboard at this time. Please try again later.' 
    });
  }
});

/**
 * @swagger
 * /api/dashboard/metrics:
 *   get:
 *     summary: Get dashboard metrics as JSON
 *     description: Returns document counts, token distribution, and service health status.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Metrics data
 *       500:
 *         description: Server error
 */
router.get('/api/dashboard/metrics', async (req, res) => {
  try {
    const data = await dashboardService.getMetrics();
    
    res.set('Cache-Control', 'no-store');
    return res.json({
      timestamp: data.lastUpdated,
      metrics: {
        documentCount: data.paperless_data.documentCount,
        processedDocumentCount: data.paperless_data.processedDocumentCount,
        tagCount: data.paperless_data.tagCount,
        correspondentCount: data.paperless_data.correspondentCount,
        tokenDistribution: data.paperless_data.tokenDistribution,
        documentTypes: data.paperless_data.documentTypes
      },
      health: {
        paperless: data.health.paperless,
        local_db: data.health.local_db
      }
    });
  } catch (err) {
    console.error('[ERROR] /api/dashboard/metrics failed:', err);
    return res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// router.get('/test/:correspondent', async (req, res) => {
//   //create a const for the correspondent that is base64 encoded and decode it
//   const correspondentx = Buffer.from(req.params.correspondent, 'base64').toString('ascii');
//   const correspondent = await paperlessService.searchForExistingCorrespondent(correspondentx);
//   res.send(correspondent);
// });

/**
 * @swagger
 * /setup:
 *   post:
 *     summary: Submit initial application setup configuration
 *     description: |
 *       Configures the initial setup of the Paperless-AI application, including connections
 *       to Paperless-ngx, AI provider settings, processing parameters, and user authentication.
 *       
 *       This endpoint is primarily used during the first-time setup of the application and
 *       creates the necessary configuration files and database tables.
 *     tags:
 *       - System
 *       - Setup
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paperlessUrl
 *               - paperlessToken
 *               - aiProvider
 *               - username
 *               - password
 *             properties:
 *               paperlessUrl:
 *                 type: string
 *                 description: URL of the Paperless-ngx instance
 *                 example: "https://paperless.example.com"
 *               paperlessToken:
 *                 type: string
 *                 description: API token for Paperless-ngx access
 *                 example: "abc123def456"
 *               paperlessUsername:
 *                 type: string
 *                 description: Username for Paperless-ngx (alternative to token authentication)
 *                 example: "admin"
 *               aiProvider:
 *                 type: string
 *                 description: Selected AI provider for document analysis
 *                 enum: ["openai", "ollama", "custom", "azure"]
 *                 example: "openai"
 *               openaiKey:
 *                 type: string
 *                 description: API key for OpenAI (required when aiProvider is 'openai')
 *                 example: "sk-abc123def456"
 *               openaiModel:
 *                 type: string
 *                 description: OpenAI model to use for analysis
 *                 example: "gpt-4"
 *               ollamaUrl:
 *                 type: string
 *                 description: URL for Ollama API (required when aiProvider is 'ollama')
 *                 example: "http://localhost:11434"
 *               ollamaModel:
 *                 type: string
 *                 description: Ollama model to use for analysis
 *                 example: "sauerkraut-llama3.1:8b"
 *               customApiKey:
 *                 type: string
 *                 description: API key for custom LLM provider
 *                 example: "api-key-123"
 *               customBaseUrl:
 *                 type: string
 *                 description: Base URL for custom LLM provider
 *                 example: "https://api.customllm.com"
 *               customModel:
 *                 type: string
 *                 description: Model name for custom LLM provider
 *                 example: "custom-model"
 *               scanInterval:
 *                 type: number
 *                 description: Interval in minutes for scanning new documents
 *                 example: 15
 *               systemPrompt:
 *                 type: string
 *                 description: Custom system prompt for document analysis
 *                 example: "Extract key information from the following document..."
 *               showTags:
 *                 type: boolean
 *                 description: Whether to show tags in the UI
 *                 example: true
 *               tags:
 *                 type: string
 *                 description: Comma-separated list of tags to use for filtering
 *                 example: "Invoice,Receipt,Contract"
 *               aiProcessedTag:
 *                 type: boolean
 *                 description: Whether to add a tag for AI-processed documents
 *                 example: true
 *               aiTagName:
 *                 type: string
 *                 description: Tag name to use for AI-processed documents
 *                 example: "AI-Processed"
 *               usePromptTags:
 *                 type: boolean
 *                 description: Whether to use tags in prompts
 *                 example: true
 *               promptTags:
 *                 type: string
 *                 description: Comma-separated list of tags to use in prompts
 *                 example: "Invoice,Receipt"
 *               username:
 *                 type: string
 *                 description: Admin username for Paperless-AI
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 description: Admin password for Paperless-AI
 *                 example: "securepassword"
 *               useExistingData:
 *                 type: boolean
 *                 description: Whether to use existing data from a previous setup
 *                 example: false
 *               activateTagging:
 *                 type: boolean
 *                 description: Enable AI-based tag suggestions
 *                 example: true
 *               activateCorrespondents:
 *                 type: boolean
 *                 description: Enable AI-based correspondent suggestions
 *                 example: true
 *               activateDocumentType:
 *                 type: boolean
 *                 description: Enable AI-based document type suggestions
 *                 example: true
 *               activateTitle:
 *                 type: boolean
 *                 description: Enable AI-based title suggestions
 *                 example: true
 *               activateCustomFields:
 *                 type: boolean
 *                 description: Enable AI-based custom field extraction
 *                 example: false
 *     responses:
 *       200:
 *         description: Setup completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: ["success"]
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Configuration saved successfully"
 *       400:
 *         description: Invalid configuration parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: ["error"]
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Missing required configuration parameters"
 *       500:
 *         description: Server error during setup
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: ["error"]
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Failed to save configuration: Database error"
 */
router.post('/setup', express.json(), async (req, res) => {
  try {
    const { 
      paperlessUrl, 
      paperlessToken,
      paperlessUsername,
      aiProvider,
      openaiKey,
      openaiModel,
      ollamaUrl,
      ollamaModel,
      ollamaContextWindow,
      ollamaMaxResponseTokens,
      ollamaVisionContextWindow,
      ollamaVisionMaxResponseTokens,
      ollamaExpertContextWindow,
      ollamaExpertMaxResponseTokens,
      translationContextWindow,
      translationMaxTokens,
      expertPipelineEnabled,
      medicalVisionModel,
      medicalAnalysisModel,
      medicalRadiologyModel,
      medicalVisionContextWindow,
      medicalVisionMaxResponseTokens,
      medicalAnalysisContextWindow,
      medicalAnalysisMaxResponseTokens,
      medicalRadiologyContextWindow,
      medicalRadiologyMaxResponseTokens,
      plannerModel,
      routerModel,
      plannerContextWindow,
      plannerMaxResponseTokens,
      routerContextWindow,
      routerMaxResponseTokens,
      financialVisionModel,
      financialAnalysisModel,
      financialVatExpertModel,
      financialVisionContextWindow,
      financialVisionMaxResponseTokens,
      financialAnalysisContextWindow,
      financialAnalysisMaxResponseTokens,
      financialVatExpertContextWindow,
      financialVatExpertMaxResponseTokens,
      legalVisionModel,
      legalAnalysisModel,
      legalOrchestratorModel,
      legalVisionContextWindow,
      legalVisionMaxResponseTokens,
      legalAnalysisContextWindow,
      legalAnalysisMaxResponseTokens,
      legalOrchestratorContextWindow,
      legalOrchestratorMaxResponseTokens,
      scanInterval,
      systemPrompt,
      showTags,
      tokenLimit,
      responseTokens,
      tags,
      aiProcessedTag,
      aiTagName,
      usePromptTags,
      promptTags,
      username,
      password,
      useExistingData,
      pipelineTagReplace,
      customApiKey,
      customBaseUrl,
      customModel,
      activateTagging,
      activateCorrespondents,
      activateDocumentType,
      activateTitle,
      activateCustomFields,
      customFields,
      disableAutomaticProcessing,
      azureEndpoint,
      azureApiKey,
      azureDeploymentName,
      azureApiVersion,
      qdrantHost,
      qdrantPort,
      qdrantApiKey,
      vectorStore
    } = req.body;

    // Log setup request with sensitive data redacted
    const sensitiveKeys = ['paperlessToken', 'openaiKey', 'customApiKey', 'password', 'confirmPassword', 'qdrantApiKey', 'azureApiKey'];
    const redactedBody = Object.fromEntries(
      Object.entries(req.body).map(([key, value]) => [
      key,
      sensitiveKeys.includes(key) ? '******' : value
      ])
    );
    console.log('Setup request received:', redactedBody);


    // Initialize paperlessService with the new credentials
    const cleanPaperlessUrl = paperlessUrl ? paperlessUrl.replace(/\/+$/, '') : '';
    const paperlessApiUrl = cleanPaperlessUrl + '/api';
    
    const initSuccess = await paperlessService.initializeWithCredentials(paperlessApiUrl, paperlessToken);
    
    if (!initSuccess) {
      return res.status(400).json({ 
        error: 'Failed to initialize connection to Paperless-ngx. Please check URL and Token.'
      });
    }

    // Validate Paperless credentials
    const isPaperlessValid = await setupService.validatePaperlessConfig(paperlessUrl, paperlessToken);
    if (!isPaperlessValid) {
      return res.status(400).json({ 
        error: 'Paperless-ngx connection failed. Please check URL and Token.'
      });
    }

    const isPermissionValid = await setupService.validateApiPermissions(paperlessUrl, paperlessToken);
    if (!isPermissionValid.success) {
      return res.status(400).json({
        error: 'Paperless-ngx API permissions are insufficient. Error: ' + isPermissionValid.message
      });
    }

    const normalizeArray = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return value.split(',').filter(Boolean).map(item => item.trim());
      return [];
    };

    // Process custom fields if enabled
    let processedCustomFields = [];
    if (customFields && activateCustomFields) {
      try {
        const parsedFields = typeof customFields === 'string' 
          ? JSON.parse(customFields) 
          : customFields;
        
        for (const field of parsedFields.custom_fields) {
          try {
            const createdField = await paperlessService.createCustomFieldSafely(
              field.value,
              field.data_type,
              field.currency
            );
            
            if (createdField) {
              processedCustomFields.push({
                value: field.value,
                data_type: field.data_type,
                ...(field.currency && { currency: field.currency })
              });
              console.log(`[SUCCESS] Created/found custom field: ${field.value}`);
            }
          } catch (fieldError) {
            console.error(`[WARNING] Error creating custom field ${field.value}:`, fieldError);
          }
        }
      } catch (error) {
        console.error('[ERROR] Error processing custom fields:', error);
      }
    }

    // Generate tokens if not provided in environment
    const apiToken = process.env.API_KEY || require('crypto').randomBytes(64).toString('hex');
    const jwtToken = process.env.JWT_SECRET || require('crypto').randomBytes(64).toString('hex');

    const processedPrompt = systemPrompt 
      ? systemPrompt.replace(/\r\n/g, '\n').replace(/\n/g, '\\n').replace(/=/g, '')
      : '';

    // Prepare base config
    const config = {
      PAPERLESS_API_URL: paperlessApiUrl,
      PAPERLESS_API_TOKEN: paperlessToken,
      PAPERLESS_USERNAME: paperlessUsername,
      AI_PROVIDER: aiProvider,
      SCAN_INTERVAL: scanInterval || '*/30 * * * *',
      SYSTEM_PROMPT: processedPrompt,
      PROCESS_PREDEFINED_DOCUMENTS: showTags || 'no',
      TOKEN_LIMIT: tokenLimit || 128000,
      RESPONSE_TOKENS: responseTokens || 1000,
      OLLAMA_CONTEXT_WINDOW: ollamaContextWindow || '',
      OLLAMA_MAX_RESPONSE_TOKENS: ollamaMaxResponseTokens || '',
      OLLAMA_VISION_CONTEXT_WINDOW: ollamaVisionContextWindow || '',
      OLLAMA_VISION_MAX_RESPONSE_TOKENS: ollamaVisionMaxResponseTokens || '',
      OLLAMA_EXPERT_CONTEXT_WINDOW: ollamaExpertContextWindow || '',
      OLLAMA_EXPERT_MAX_RESPONSE_TOKENS: ollamaExpertMaxResponseTokens || '',
      TRANSLATION_CONTEXT_WINDOW: translationContextWindow || '',
      TRANSLATION_MAX_TOKENS: translationMaxTokens || '',
      
      // Medical Domain
      MEDICAL_VISION_MODEL: medicalVisionModel || '',
      MEDICAL_ANALYSIS_MODEL: medicalAnalysisModel || '',
      MEDICAL_RADIOLOGY_MODEL: medicalRadiologyModel || '',
      MEDICAL_VISION_CONTEXT_WINDOW: medicalVisionContextWindow || '',
      MEDICAL_VISION_MAX_RESPONSE_TOKENS: medicalVisionMaxResponseTokens || '',
      MEDICAL_ANALYSIS_CONTEXT_WINDOW: medicalAnalysisContextWindow || '',
      MEDICAL_ANALYSIS_MAX_RESPONSE_TOKENS: medicalAnalysisMaxResponseTokens || '',
      MEDICAL_RADIOLOGY_CONTEXT_WINDOW: medicalRadiologyContextWindow || '',
      MEDICAL_RADIOLOGY_MAX_RESPONSE_TOKENS: medicalRadiologyMaxResponseTokens || '',
      
      // Financial Domain
      FINANCIAL_VISION_MODEL: financialVisionModel || '',
      FINANCIAL_ANALYSIS_MODEL: financialAnalysisModel || '',
      VAT_EXPERT_MODEL: financialVatExpertModel || '',
      FINANCIAL_VISION_CONTEXT_WINDOW: financialVisionContextWindow || '',
      FINANCIAL_VISION_MAX_RESPONSE_TOKENS: financialVisionMaxResponseTokens || '',
      FINANCIAL_ANALYSIS_CONTEXT_WINDOW: financialAnalysisContextWindow || '',
      FINANCIAL_ANALYSIS_MAX_RESPONSE_TOKENS: financialAnalysisMaxResponseTokens || '',
      VAT_EXPERT_CONTEXT_WINDOW: financialVatExpertContextWindow || '',
      VAT_EXPERT_MAX_RESPONSE_TOKENS: financialVatExpertMaxResponseTokens || '',
      
      // Legal Domain
      LEGAL_VISION_MODEL: legalVisionModel || '',
      LEGAL_ANALYSIS_MODEL: legalAnalysisModel || '',
      LEGAL_ORCHESTRATOR_MODEL: legalOrchestratorModel || '',
      LEGAL_VISION_CONTEXT_WINDOW: legalVisionContextWindow || '',
      LEGAL_VISION_MAX_RESPONSE_TOKENS: legalVisionMaxResponseTokens || '',
      LEGAL_ANALYSIS_CONTEXT_WINDOW: legalAnalysisContextWindow || '',
      LEGAL_ANALYSIS_MAX_RESPONSE_TOKENS: legalAnalysisMaxResponseTokens || '',
      LEGAL_ORCHESTRATOR_CONTEXT_WINDOW: legalOrchestratorContextWindow || '',
      LEGAL_ORCHESTRATOR_MAX_RESPONSE_TOKENS: legalOrchestratorMaxResponseTokens || '',
      
      // Routing & Planning
      PLANNER_MODEL: plannerModel || '',
      ROUTER_MODEL: routerModel || '',
      PLANNER_CONTEXT_WINDOW: plannerContextWindow || '',
      PLANNER_MAX_RESPONSE_TOKENS: plannerMaxResponseTokens || '',
      ROUTER_CONTEXT_WINDOW: routerContextWindow || '',
      ROUTER_MAX_RESPONSE_TOKENS: routerMaxResponseTokens || '',

      EXPERT_PIPELINE_ENABLED: (expertPipelineEnabled === 'on' || expertPipelineEnabled === 'yes') ? 'yes' : 'no',
      TAGS: normalizeArray(tags),
      ADD_AI_PROCESSED_TAG: aiProcessedTag || 'no',
      AI_PROCESSED_TAG_NAME: aiTagName || 'ai-processed',
      USE_PROMPT_TAGS: usePromptTags || 'no',
      PROMPT_TAGS: normalizeArray(promptTags),
      USE_EXISTING_DATA: useExistingData || 'no',
      PIPELINE_TAG_REPLACE: pipelineTagReplace ? 'yes' : 'no',
      API_KEY: apiToken,
      JWT_SECRET: jwtToken,
      CUSTOM_API_KEY: customApiKey || '',
      CUSTOM_BASE_URL: customBaseUrl || '',
      CUSTOM_MODEL: customModel || '',
      PAPERLESS_AI_INITIAL_SETUP: 'yes',
      ACTIVATE_TAGGING: activateTagging ? 'yes' : 'no',
      ACTIVATE_CORRESPONDENTS: activateCorrespondents ? 'yes' : 'no',
      ACTIVATE_DOCUMENT_TYPE: activateDocumentType ? 'yes' : 'no',
      ACTIVATE_TITLE: activateTitle ? 'yes' : 'no',
      ACTIVATE_CUSTOM_FIELDS: activateCustomFields ? 'yes' : 'no',
      CUSTOM_FIELDS: processedCustomFields.length > 0 
        ? JSON.stringify({ custom_fields: processedCustomFields }) 
        : '{"custom_fields":[]}',
      DISABLE_AUTOMATIC_PROCESSING: disableAutomaticProcessing ? 'yes' : 'no',
      AZURE_ENDPOINT: azureEndpoint || '',
      AZURE_API_KEY: azureApiKey || '',
      AZURE_DEPLOYMENT_NAME: azureDeploymentName || '',
      AZURE_API_VERSION: azureApiVersion || '',
      QDRANT_HOST: qdrantHost || 'qdrant',
      QDRANT_PORT: qdrantPort || '6333',
      QDRANT_API_KEY: qdrantApiKey || '',
      VECTOR_STORE: vectorStore || 'qdrant'
    };
    
    // Validate AI provider config
    if (aiProvider === 'openai') {
      const isOpenAIValid = await setupService.validateOpenAIConfig(openaiKey);
      if (!isOpenAIValid) {
        return res.status(400).json({ 
          error: 'OpenAI API Key is not valid. Please check the key.'
        });
      }
      config.PAPERLESS_OPENAI_API_KEY = openaiKey;
      config.PAPERLESS_OPENAI_MODEL = openaiModel || 'gpt-4o-mini';
    } else if (aiProvider === 'ollama') {
      const isOllamaValid = await setupService.validateOllamaConfig(ollamaUrl, ollamaModel);
      if (!isOllamaValid) {
        return res.status(400).json({ 
          error: 'Ollama connection failed. Please check URL and Model.'
        });
      }
      config.OLLAMA_API_URL = ollamaUrl || 'http://localhost:11434';
      config.OLLAMA_MODEL = ollamaModel || 'sauerkraut-llama3.1:8b';
    } else if (aiProvider === 'custom') {
      const isCustomValid = await setupService.validateCustomConfig(customBaseUrl, customApiKey, customModel);
      if (!isCustomValid) {
        return res.status(400).json({
          error: 'Custom connection failed. Please check URL, API Key and Model.'
        });
      }
      config.CUSTOM_BASE_URL = customBaseUrl;
      config.CUSTOM_API_KEY = customApiKey;
      config.CUSTOM_MODEL = customModel;
    } else if (aiProvider === 'azure') {
      const isAzureValid = await setupService.validateAzureConfig(azureApiKey, azureEndpoint, azureDeploymentName, azureApiVersion);
      if (!isAzureValid) {
        return res.status(400).json({
          error: 'Azure connection failed. Please check URL, API Key, Deployment Name and API Version.'
        });
      }
    }

    // Save configuration
    await setupService.saveConfig(config);
    const hashedPassword = await bcrypt.hash(password, 15);
    await documentModel.addUser(username, hashedPassword);

    res.json({ 
      success: true,
      message: 'Configuration saved successfully.',
      restart: true
    });

    // Trigger application restart
    setTimeout(() => {
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('[ERROR] Setup error:', error);
    res.status(500).json({ 
      error: 'An error occurred: ' + error.message
    });
  }
});

router.get('/api/rag-test', async (req, res) => {
  RAGService.initialize();
  try { 
    if(await RAGService.sendDocumentsToRAGService()){
      res.status(200).json({ success: true });
    }else{
      res.status(500).json({ success: false });
    }    
  } catch {
    res.status(500).json({ error: 'Failed to fetch processing status' });
  }
}
);

router.get('/dashboard/doc/:id', async (req, res) => {
  const docId = req.params.id;
  if (!docId) {
    return res.status(400).json({ error: 'Document ID is required' });
  }
  try {
    // Redirect to paperless-ngx and show detail page of the document (for example https://paperless.example.com/documents/887/details)
    const paperlessUrl = process.env.PAPERLESS_API_URL;
    const paperlessUrlWithoutApi = paperlessUrl.replace('/api', '');
    const redirectUrl = `${paperlessUrlWithoutApi}/documents/${docId}/details`;
    console.log('Redirecting to Paperless-ngx URL:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

module.exports = router;
