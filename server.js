const express = require('express');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs').promises;
const config = require('./config/config');
const paperlessService = require('./services/paperlessService');
const AIServiceFactory = require('./services/aiServiceFactory');
const documentModel = require('./services/documentModel');
const setupService = require('./services/setupService');
const setupRoutes = require('./routes/setup');
const duplicateDetector = require('./services/DuplicateDetector');
const healthMetricsService = require('./services/HealthMetricsService');
const PatternDetectionEngine = require('./services/PatternDetectionEngine');
const { metricsCollector } = require('./services/metrics/PrometheusMetrics');

// Add environment variables for RAG service if not already set
process.env.RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://webserver:8000';
process.env.RAG_SERVICE_ENABLED = process.env.RAG_SERVICE_ENABLED || 'true';
const cors = require('cors');
const cookieParser = require('cookie-parser');
const Logger = require('./services/loggerService');
const logger = require('./services/logger');
const { max } = require('date-fns');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const htmlLogger = new Logger({
  logFile: 'logs.html',
  format: 'html',
  timestamp: true,
  maxFileSize: 1024 * 1024 * 10
});

const txtLogger = new Logger({
  logFile: 'logs.txt',
  format: 'txt',
  timestamp: true,
  maxFileSize: 1024 * 1024 * 10
});

const app = express();
let runningTask = false;


const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'x-api-key',
    'Access-Control-Allow-Private-Network'
  ],
  credentials: false
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Access-Control-Allow-Private-Network');
  res.header('Access-Control-Allow-Private-Network', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// Swagger documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    url: '/api-docs/openapi.json'
  }
}));

/**
 * @swagger
 * /api-docs/openapi.json:
 *   get:
 *     summary: Retrieve the OpenAPI specification
 *     description: |
 *       Returns the complete OpenAPI specification for the Paperless-AI API.
 *       This endpoint attempts to serve a static OpenAPI JSON file first, falling back
 *       to dynamically generating the specification if the file cannot be read.
 *       
 *       The OpenAPI specification document contains all API endpoints, parameters,
 *       request bodies, responses, and schemas for the entire application.
 *     tags: [API, System]
 *     responses:
 *       200:
 *         description: OpenAPI specification returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The complete OpenAPI specification
 *       404:
 *         description: OpenAPI specification file not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error occurred while retrieving the OpenAPI specification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api-docs/openapi.json', (req, res) => {
  const openApiPath = path.join(process.cwd(), 'OPENAPI', 'openapi.json');
  res.setHeader('Content-Type', 'application/json');
  
  // Try to serve the static file first
  fs.readFile(openApiPath)
    .then(data => {
      try {
        const text = data && typeof data.toString === 'function' ? data.toString('utf8') : String(data);
        res.send(JSON.parse(text));
      } catch (e) {
        console.warn('Error parsing OpenAPI file, falling back to generated spec:', e && e.message ? e.message : e);
        res.send(swaggerSpec);
      }
    })
    .catch(err => {
      console.warn('Error reading OpenAPI file, generating dynamically:', err.message);
      // Fallback to generating the spec if file can't be read
      res.send(swaggerSpec);
    });
});

// Add a redirect for the old endpoint for backward compatibility
app.get('/api-docs.json', (req, res) => {
  res.redirect('/api-docs/openapi.json');
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// //Layout middleware
// app.use((req, res, next) => {
//   const originalRender = res.render;
//   res.render = function (view, locals = {}) {
//     originalRender.call(this, view, locals, (err, html) => {
//       if (err) return next(err);
//       originalRender.call(this, 'layout', { content: html, ...locals });
//     });
//   };
//   next();
// });


// Initialize data directory
async function initializeDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.access(dataDir);
  } catch {
    console.log('Creating data directory...');
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Save OpenAPI specification to file
async function saveOpenApiSpec() {
  const openApiDir = path.join(process.cwd(), 'OPENAPI');
  const openApiPath = path.join(openApiDir, 'openapi.json');
  try {
    // Ensure the directory exists
    try {
      await fs.access(openApiDir);
    } catch {
      console.log('Creating OPENAPI directory...');
      await fs.mkdir(openApiDir, { recursive: true });
    }
    
    // Write the specification to file
    await fs.writeFile(openApiPath, JSON.stringify(swaggerSpec, null, 2));
    console.log(`OpenAPI specification saved to ${openApiPath}`);
    return true;
  } catch (error) {
    console.error('Failed to save OpenAPI specification:', error);
    return false;
  }
}

// Document processing functions
async function tagDocumentAsDuplicate(duplicateDocId, originalDocId) {
  try {
    const tagName = config.duplicateDetection?.duplicateTagName || 'duplicate';
    await paperlessService.addTagToDocument(duplicateDocId, tagName);
    await paperlessService.addNoteToDocument(
      duplicateDocId,
      `Marked as duplicate of document #${originalDocId} by Paperless-AI`
    );
    return true;
  } catch (error) {
    console.error(`[DUPLICATE_DETECTOR] Failed to tag document ${duplicateDocId}:`, error.message);
    return false;
  }
}

async function archiveDuplicateDocument(duplicateDocId, originalDocId) {
  try {
    const mode = config.duplicateDetection?.duplicateArchiveMode || 'remove_tag';
    if (mode === 'storage_path') {
      const storagePathId = config.duplicateDetection?.duplicateArchiveStoragePathId;
      if (!storagePathId) {
        console.warn('[DUPLICATE_DETECTOR] Archive storage path not configured, skipping archive');
        return false;
      }
      await paperlessService.setStoragePath(duplicateDocId, storagePathId);
    } else {
      const tagName = config.duplicateDetection?.duplicateArchiveTagName || 'Inbox';
      const tagId = await paperlessService.getTagIdByName(tagName);
      if (!tagId) {
        console.warn(`[DUPLICATE_DETECTOR] Archive tag "${tagName}" not found, skipping archive`);
        return false;
      }
      await paperlessService.removeTagFromDocument(duplicateDocId, tagId);
    }

    await paperlessService.addNoteToDocument(
      duplicateDocId,
      `Archived duplicate of document #${originalDocId} by Paperless-AI`
    );
    return true;
  } catch (error) {
    console.error(`[DUPLICATE_DETECTOR] Failed to archive document ${duplicateDocId}:`, error.message);
    return false;
  }
}

async function mergeDuplicateDocument(duplicateDocId, originalDocId) {
  try {
    const deleteOriginals = config.duplicateDetection?.duplicateMergeDeleteOriginals === 'yes';
    const merged = await paperlessService.mergeDocuments([duplicateDocId], originalDocId, deleteOriginals);
    if (merged) {
      await paperlessService.addNoteToDocument(
        originalDocId,
        `Merged duplicate document #${duplicateDocId} into this document by Paperless-AI`
      );
    }
    return merged;
  } catch (error) {
    console.error(`[DUPLICATE_DETECTOR] Failed to merge document ${duplicateDocId}:`, error.message);
    return false;
  }
}

async function applyDuplicateAction(duplicateDocId, originalDocId) {
  const action = config.duplicateDetection?.duplicateAction || 'skip';

  if (action === 'merge') {
    return mergeDuplicateDocument(duplicateDocId, originalDocId);
  }
  if (action === 'archive') {
    return archiveDuplicateDocument(duplicateDocId, originalDocId);
  }

  // Default behavior: tag duplicates for review.
  return tagDocumentAsDuplicate(duplicateDocId, originalDocId);
}

async function preprocessForDuplicates(documentId) {
  try {
    const pageImages = await paperlessService.getDocumentPageImages(documentId);

    if (!pageImages || pageImages.length === 0) {
      console.log(`[DUPLICATE_DETECTOR] No page images for document ${documentId}, skipping duplicate check`);
      return { action: 'process', reason: 'No page images available' };
    }

    const fingerprint = await duplicateDetector.generateFingerprint(documentId, pageImages);
    const duplicateCheck = await duplicateDetector.checkDuplicate(fingerprint);

    if (duplicateCheck.action === 'skip') {
      duplicateDetector.markAsDuplicate(documentId, duplicateCheck.originalDocumentId);
      await applyDuplicateAction(documentId, duplicateCheck.originalDocumentId);
      console.log(`[DUPLICATE_DETECTOR] Skipping document ${documentId}: ${duplicateCheck.reason}`);

      return duplicateCheck;
    }

    if (duplicateCheck.action === 'replace') {
      duplicateDetector.markAsDuplicate(duplicateCheck.originalDocumentId, documentId);
      duplicateDetector.removeFingerprint(duplicateCheck.originalDocumentId);
      await applyDuplicateAction(duplicateCheck.originalDocumentId, documentId);
      console.log(`[DUPLICATE_DETECTOR] Document ${documentId} replaces ${duplicateCheck.originalDocumentId}: ${duplicateCheck.reason}`);
    }

    duplicateDetector.registerFingerprint(fingerprint);

    return { action: 'process', reason: 'Not a duplicate or is superset' };
  } catch (error) {
    console.error(`[DUPLICATE_DETECTOR] Error checking document ${documentId}:`, error.message);
    return { action: 'process', reason: 'Duplicate check failed, processing anyway' };
  }
}

async function processDocument(doc, existingTags, existingCorrespondentList, existingDocumentTypesList, ownUserId) {
  const isProcessed = await documentModel.isDocumentProcessed(doc.id);
  if (isProcessed) return null;
  await documentModel.setProcessingStatus(doc.id, doc.title, 'processing');

  //Check if the Document can be edited
  const documentEditable = await paperlessService.getPermissionOfDocument(doc.id);
  if (!documentEditable) {
    console.log(`[DEBUG] Document belongs to: ${documentEditable}, skipping analysis`);
    console.log(`[DEBUG] Document ${doc.id} Not Editable by Paper-Ai User, skipping analysis`);
    return null;
  }else {
    console.log(`[DEBUG] Document ${doc.id} rights for AI User - processed`);
  }

  if (config.duplicateDetection?.enabled === 'yes') {
    const duplicateResult = await preprocessForDuplicates(doc.id);
    if (duplicateResult.action === 'skip') {
      console.log(`[PROCESSOR] Skipping document ${doc.id} - duplicate detected`);
      await documentModel.addProcessedDocument(doc.id, doc.title);
      await documentModel.setProcessingStatus(doc.id, doc.title, 'complete');
      return null;
    }
  }

  let [content, originalData] = await Promise.all([
    paperlessService.getDocumentContent(doc.id),
    paperlessService.getDocument(doc.id)
  ]);

  if (!content || !content.length >= 10) {
    console.log(`[DEBUG] Document ${doc.id} has no content, skipping analysis`);
    return null;
  }

  if (content.length > 50000) {
    content = content.substring(0, 50000);
  }

  const aiService = AIServiceFactory.getService();
  const analysis = await aiService.analyzeDocument(content, existingTags, existingCorrespondentList, existingDocumentTypesList, doc.id);
  console.log('Repsonse from AI service:', analysis);
  if (analysis.error) {
    throw new Error(`[ERROR] Document analysis failed: ${analysis.error}`);
  }
  await documentModel.setProcessingStatus(doc.id, doc.title, 'complete');
  return { analysis, originalData };
}

async function buildUpdateData(analysis, doc) {
  const updateData = {};

  const documentType = analysis.document.document_type
    ? String(analysis.document.document_type).toLowerCase()
    : '';
  const isNote = ['note', 'memo', 'list', 'notiz', 'notizen'].includes(documentType);

  if (isNote) {
    if (!analysis.document.correspondent) {
      analysis.document.correspondent = 'AI User';
    }
    if (!analysis.document.document_date) {
      analysis.document.document_date = new Date().toISOString().slice(0, 10);
    }
  }

  logger.debug('config.addAIProcessedTag: %o', config.addAIProcessedTag);
  logger.debug('config.addAIProcessedTags: %o', config.addAIProcessedTags);
  // Only process tags if tagging is activated
  if (config.limitFunctions?.activateTagging !== 'no') {
    const { tagIds, errors } = await paperlessService.processTags(analysis.document.tags);
    if (errors.length > 0) {
      logger.warn('Some tags could not be processed: %o', errors);
    }
    updateData.tags = tagIds;
  } else if (config.limitFunctions?.activateTagging === 'no' && config.addAIProcessedTag === 'yes') {
    // Add AI processed tags to the document (processTags function awaits a tags array)
    // get tags from .env file and split them by comma and make an array
    logger.debug('Tagging is deactivated but AI processed tag will be added');
    const tags = config.addAIProcessedTags.split(',');
    const { tagIds, errors } = await paperlessService.processTags(tags);
    if (errors.length > 0) {
      logger.warn('Some tags could not be processed: %o', errors);
    }
    updateData.tags = tagIds;
    logger.debug('Tagging is deactivated');
  }

  // Only process title if title generation is activated
  if (config.limitFunctions?.activateTitle !== 'no') {
    updateData.title = analysis.document.title || doc.title;
  }

  // Add created date regardless of settings as it's a core field
  updateData.created = analysis.document.document_date || doc.created;

  // Only process document type if document type classification is activated
  if (config.limitFunctions?.activateDocumentType !== 'no' && analysis.document.document_type) {
    try {
      const documentType = await paperlessService.getOrCreateDocumentType(analysis.document.document_type);
      if (documentType) {
        updateData.document_type = documentType.id;
      }
    } catch (error) {
      console.error(`[ERROR] Error processing document type:`, error);
    }
  }
  
  // Only process custom fields if custom fields detection is activated
  if (config.limitFunctions?.activateCustomFields !== 'no' && analysis.document.custom_fields) {
    const customFields = analysis.document.custom_fields;
    const processedFields = [];

    // Get existing custom fields
    const existingFields = await paperlessService.getExistingCustomFields(doc.id);
    console.log(`[DEBUG] Found existing fields:`, existingFields);

    // Keep track of which fields we've processed to avoid duplicates
    const processedFieldIds = new Set();

    // First, add any new/updated fields
    for (const key in customFields) {
      const customField = customFields[key];

      if (!customField || !customField.field_name) {
        logger.debug('Skipping null/invalid custom field');
        continue;
      }

      const trimmedValue = typeof customField.value === 'string'
        ? customField.value.trim()
        : null;

      if (!trimmedValue) {
        logger.debug('Skipping empty/invalid custom field');
        continue;
      }

      const fieldDetails = await paperlessService.findExistingCustomField(customField.field_name);
      if (fieldDetails?.id) {
        processedFields.push({
          field: fieldDetails.id,
          value: trimmedValue
        });
        processedFieldIds.add(fieldDetails.id);
      }
    }

    // Then add any existing fields that weren't updated
    for (const existingField of existingFields) {
      if (!processedFieldIds.has(existingField.field)) {
        processedFields.push(existingField);
      }
    }

    if (processedFields.length > 0) {
      updateData.custom_fields = processedFields;
    }
  }

  // Only process correspondent if correspondent detection is activated
  if (config.limitFunctions?.activateCorrespondents !== 'no' && analysis.document.correspondent) {
    try {
      const correspondent = await paperlessService.getOrCreateCorrespondent(analysis.document.correspondent);
      if (correspondent) {
        updateData.correspondent = correspondent.id;
      }
    } catch (error) {
      console.error(`[ERROR] Error processing correspondent:`, error);
    }
  }

  // Always include language if provided as it's a core field
  if (analysis.document.language) {
    updateData.language = analysis.document.language;
  }

  return updateData;
}

async function saveDocumentChanges(docId, updateData, analysis, originalData) {
  const { tags: originalTags, correspondent: originalCorrespondent, title: originalTitle } = originalData;
  
  await Promise.all([
    documentModel.saveOriginalData(docId, originalTags, originalCorrespondent, originalTitle),
    paperlessService.updateDocument(docId, updateData),
    documentModel.addProcessedDocument(docId, updateData.title),
    documentModel.addOpenAIMetrics(
      docId, 
      analysis.metrics.promptTokens,
      analysis.metrics.completionTokens,
      analysis.metrics.totalTokens
    ),
    documentModel.addToHistory(docId, updateData.tags, updateData.title, analysis.document.correspondent)
  ]);
}

// Main scanning functions
async function scanInitial() {
  try {
    const isConfigured = await setupService.isConfigured();
    if (!isConfigured) {
      console.log('[ERROR] Setup not completed. Skipping document scan.');
      return;
    }

    let [existingTags, documents, ownUserId, existingCorrespondentList, existingDocumentTypes] = await Promise.all([
      paperlessService.getTags(),
      paperlessService.getAllDocuments(),
      paperlessService.getOwnUserID(),
      paperlessService.listCorrespondentsNames(),
      paperlessService.listDocumentTypesNames()
    ]);
    //get existing correspondent list
    existingCorrespondentList = existingCorrespondentList.map(correspondent => correspondent.name);
    let existingDocumentTypesList = existingDocumentTypes.map(docType => docType.name);
    
    // Extract tag names from tag objects
    const existingTagNames = existingTags.map(tag => tag.name);

    for (const doc of documents) {
      try {
        const result = await processDocument(doc, existingTagNames, existingCorrespondentList, existingDocumentTypesList, ownUserId);
        if (!result) continue;

        const { analysis, originalData } = result;
        const updateData = await buildUpdateData(analysis, doc);
        await saveDocumentChanges(doc.id, updateData, analysis, originalData);
      } catch (error) {
        console.error(`[ERROR] processing document ${doc.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[ERROR] during initial document scan:', error);
  }
}

async function scanDocuments() {
  if (runningTask) {
    logger.warn('Task already running');
    return;
  }

  runningTask = true;
  try {
    let [existingTags, documents, ownUserId, existingCorrespondentList, existingDocumentTypes] = await Promise.all([
      paperlessService.getTags(),
      paperlessService.getAllDocuments(),
      paperlessService.getOwnUserID(),
      paperlessService.listCorrespondentsNames(),
      paperlessService.listDocumentTypesNames()
    ]);

    //get existing correspondent list
    existingCorrespondentList = existingCorrespondentList.map(correspondent => correspondent.name);
    
    //get existing document types list
    let existingDocumentTypesList = existingDocumentTypes.map(docType => docType.name);
    
    // Extract tag names from tag objects
    const existingTagNames = existingTags.map(tag => tag.name);

    for (const doc of documents) {
      try {
        const result = await processDocument(doc, existingTagNames, existingCorrespondentList, existingDocumentTypesList, ownUserId);
        if (!result) continue;

        const { analysis, originalData } = result;
        const updateData = await buildUpdateData(analysis, doc);
        await saveDocumentChanges(doc.id, updateData, analysis, originalData);
      } catch (error) {
        console.error(`[ERROR] processing document ${doc.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[ERROR]  during document scan:', error);
  } finally {
    runningTask = false;
    console.log('[INFO] Task completed');
  }
}

// Routes
app.use('/', setupRoutes);
const authRoutes = require('./routes/auth');
const ragRoutes = require('./routes/rag');
const visualRagRoutes = require('./routes/api/visual-rag');
const feedbackRoutes = require('./routes/api/feedback');

// Mount Visual RAG routes (always enabled - provides hybrid search)
app.use('/api/visual-rag', visualRagRoutes);

// Mount Feedback routes (always enabled - user feedback collection)
app.use('/api/feedback', feedbackRoutes);

// Mount RAG routes if enabled
if (process.env.RAG_SERVICE_ENABLED === 'true') {
  app.use('/api/rag', ragRoutes);
  
  // RAG UI route
  app.get('/rag', async (req, res) => {
    try {
      res.render('rag', { 
        title: 'Dokumenten-Fragen'
      });
    } catch (error) {
      console.error('Error rendering RAG UI:', error);
      res.status(500).send('Error loading RAG interface');
    }
  });
}

/**
 * @swagger
 * /:
 *   get:
 *     summary: Root endpoint that redirects to the dashboard
 *     description: |
 *       This endpoint serves as the entry point for the application.
 *       When accessed, it automatically redirects the user to the dashboard page.
 *       No parameters or authentication are required for this redirection.
 *     tags: [Navigation, System]
 *     responses:
 *       302:
 *         description: Redirects to the dashboard page
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body>Redirecting to dashboard...</body></html>"
 *       500:
 *         description: Server error occurred during redirection
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/', async (req, res) => {
  try {
    res.redirect('/dashboard');
  } catch (error) {
    console.error('[ERROR] in root route:', error);
    res.status(500).send('Error processing request');
  }
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: System health check endpoint
 *     description: |
 *       Checks if the application is properly configured and the database is reachable.
 *       This endpoint can be used by monitoring systems to verify service health.
 *       
 *       The endpoint returns a 200 status code with a "healthy" status if everything is 
 *       working correctly, or a 503 status code with error details if there are issues.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System is healthy and operational
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                   description: Health status indication
 *       503:
 *         description: System is not fully configured or database is unreachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [not_configured, error]
 *                   example: "not_configured"
 *                   description: Error status type
 *                 message:
 *                   type: string
 *                   example: "Application setup not completed"
 *                   description: Detailed error message
 */
app.get('/health', async (req, res) => {
  try {
    const isConfigured = await setupService.isConfigured();
    if (!isConfigured) {
      return res.status(503).json({ 
        status: 'not_configured',
        message: 'Application setup not completed'
      });
    }

    await documentModel.isDocumentProcessed(1);
    res.json({ status: 'healthy' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus metrics export
 *     description: |
 *       Exposes Prometheus-formatted metrics for pipeline observability.
 *       Metrics are collected on a best-effort basis and never block pipeline processing.
 *     tags: [System, API]
 *     responses:
 *       200:
 *         description: Prometheus metrics payload
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       204:
 *         description: Metrics disabled by configuration
 *       500:
 *         description: Metrics export failed
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
app.get('/metrics', async (_req, res) => {
  try {
    if (metricsCollector.enabled === false) {
      res.status(204).send('');
      return;
    }
    const payload = await metricsCollector.getMetrics();
    res.setHeader('Content-Type', metricsCollector.contentType);
    res.status(200).send(payload);
  } catch (error) {
    logger.warn({
      event: 'metrics_export_failed',
      error: error.message
    });
    res.status(500).send('');
  }
});

/**
 * @swagger
 * /health/database:
 *   get:
 *     summary: Database and Qdrant health check
 *     description: |
 *       Detailed health check for PostgreSQL connection and Qdrant availability.
 *       Returns connection status, Qdrant availability, and schema readiness.
 *     tags: [System, Database]
 *     responses:
 *       200:
 *         description: Database is healthy and Qdrant is available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 database:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     host:
 *                       type: string
 *                     port:
 *                       type: number
 *                     database:
 *                       type: string
 *                 qdrant:
 *                   type: object
 *                   properties:
 *                     available:
 *                       type: boolean
 *                     version:
 *                       type: string
 *                 schema:
 *                   type: object
 *                   properties:
 *                     ready:
 *                       type: boolean
 *       503:
 *         description: Database connection failed or Qdrant not available
 */
app.get('/health/database', async (req, res) => {
  try {
    const cfg = require('./config/config');
    const { visualOverlayRepository } = require('./services/visual-rag-client/VisualOverlayRepository');
    const { qdrantAdapter } = require('./services/visual-rag-client/QdrantAdapter');

    // Test basic connectivity
    const isConnected = await visualOverlayRepository.isAvailable(false);
    if (!isConnected) {
      return res.status(503).json({
        status: 'unhealthy',
        database: {
          connected: false,
          host: cfg.postgres.host,
          port: cfg.postgres.port,
          database: cfg.postgres.database,
          error: 'Database connection failed'
        },
        troubleshooting: [
          'Check if PostgreSQL container is running: docker ps | grep paperless_db',
          'Verify credentials in docker-compose.env',
          'Check container logs: docker logs paperless_db'
        ]
      });
    }

    // Check schema readiness
    const schemaReady = await visualOverlayRepository.ensureEnhancedSchema();

    // Check Qdrant vector store
    let qdrantCheck = { healthy: false, error: 'unknown' };
    try {
      qdrantCheck = await qdrantAdapter.healthCheck();
    } catch (e) {
      qdrantCheck = { healthy: false, error: e.message };
    }

    const response = {
      status: schemaReady && qdrantCheck.healthy ? 'healthy' : 'degraded',
      database: {
        connected: true,
        host: cfg.postgres.host,
        port: cfg.postgres.port,
        database: cfg.postgres.database
      },
      qdrant: {
        healthy: qdrantCheck.healthy,
        collections: qdrantCheck.collections,
        error: qdrantCheck.error
      },
      schema: {
        ready: schemaReady
      }
    };

    if (!qdrantCheck.healthy || !schemaReady) {
      response.troubleshooting = [
        'Verify Qdrant container is running: docker ps | grep qdrant',
        'Check Qdrant logs: docker logs paperless_qdrant',
        'Run migration: docker exec paperless_ai node migrations/run-migration.js'
      ];
      return res.status(503).json(response);
    }

    res.json(response);
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: error.message,
      troubleshooting: [
        'Check application logs for detailed error information',
        'Verify all environment variables are set correctly',
        'Restart services: docker-compose restart'
      ]
    });
  }
});

app.get('/api/duplicates/stats', (req, res) => {
  res.json(duplicateDetector.getStats());
});

app.get('/api/duplicates/check/:documentId', (req, res) => {
  const duplicateOf = duplicateDetector.getDuplicateOf(parseInt(req.params.documentId, 10));
  res.json({
    documentId: parseInt(req.params.documentId, 10),
    isDuplicate: duplicateOf !== null,
    duplicateOf
  });
});

app.get('/api/experts/status', (req, res) => {
  const { expertRegistry } = require('./services/experts/ExpertRegistry');
  res.json(expertRegistry.getStatus());
});

app.get('/api/health/patterns', (req, res) => {
  try {
    const engine = new PatternDetectionEngine(healthMetricsService.getDb());
    const patterns = engine.analyzePatterns();
    res.json(patterns);
  } catch (error) {
    console.error('[HEALTH_METRICS] Pattern analysis failed:', error.message);
    res.status(500).json({
      error: 'pattern_analysis_failed',
      message: error.message
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start scanning
async function startScanning() {
  try {
    const isConfigured = await setupService.isConfigured();
    if (!isConfigured) {
      console.log(`Setup not completed. Visit http://your-machine-ip:${process.env.PAPERLESS_AI_PORT || 3000}/setup to complete setup.`);
    }

    const userId = await paperlessService.getOwnUserID();
    if (!userId) {
      console.error('Failed to get own user ID. Abort scanning.');
      return;
    }

    console.log('Configured scan interval:', config.scanInterval);
    console.log(`Starting initial scan at ${new Date().toISOString()}`);
    if(config.disableAutomaticProcessing != 'yes') {
      await scanInitial();
  
      cron.schedule(config.scanInterval, async () => {
        console.log(`Starting scheduled scan at ${new Date().toISOString()}`);
        await scanDocuments();
      });
    }

    // Background job for deferred feedback recovery
    const feedbackRecoveryInterval = process.env.FEEDBACK_RECOVERY_INTERVAL || '*/5 * * * *';
    console.log(`Starting feedback recovery job with interval: ${feedbackRecoveryInterval}`);
    cron.schedule(feedbackRecoveryInterval, async () => {
      try {
        const feedbackService = require('./services/feedback/FeedbackService');
        await feedbackService.processDeferredFeedback();
      } catch (error) {
        console.error('[ERROR] Feedback recovery job failed:', error);
      }
    });
  } catch (error) {
    console.error('[ERROR] in startScanning:', error);
  }
}

// Error handlers
// process.on('SIGTERM', async () => {
//   console.log('Received SIGTERM. Starting graceful shutdown...');
//   try {
//     console.log('Closing database...');
//     await documentModel.closeDatabase(); // Jetzt warten wir wirklich auf den Close
//     console.log('Database closed successfully');
//     process.exit(0);
//   } catch (error) {
//     console.error('[ERROR] during shutdown:', error);
//     process.exit(1);
//   }
// });

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // In test mode or when running under npm test we don't want to exit the process — allow the test runner to handle failures.
  if (process.env.NODE_ENV !== 'test' && process.env.npm_lifecycle_event !== 'test') {
    process.exit(1);
  } else {
    console.error('Test mode or npm test: skipping process.exit on uncaughtException');
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.NODE_ENV !== 'test' && process.env.npm_lifecycle_event !== 'test') {
    process.exit(1);
  } else {
    console.error('Test mode or npm test: skipping process.exit on unhandledRejection');
  }
});

async function gracefulShutdown(signal) {
  logger.info('Received %s signal. Starting graceful shutdown...', signal);
  try {
    logger.info('Closing database...');
    await documentModel.closeDatabase();
    logger.info('Database closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Error during ${signal} shutdown: %o`, error);
    process.exit(1);
  }
}

// Handle both SIGTERM and SIGINT
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function validateDatabaseConnection() {
  const cfg = require('./config/config');

  console.log('[STARTUP] Validating database connection...');
  console.log('[STARTUP] Database credentials:', {
    host: cfg.postgres.host,
    port: cfg.postgres.port,
    database: cfg.postgres.database,
    user: cfg.postgres.user,
    password: cfg.postgres.password ? '******' : '<MISSING>'
  });

  const { visualOverlayRepository } = require('./services/visual-rag-client/VisualOverlayRepository');
  const { qdrantAdapter } = require('./services/visual-rag-client/QdrantAdapter');
  
  try {
    // Test basic connectivity
    const isAvailable = await visualOverlayRepository.isAvailable(true);
    if (!isAvailable) {
      throw new Error('Database connection test failed');
    }
    console.log('[STARTUP] ✓ Database connection successful');

    // Check Qdrant connection
    console.log('[STARTUP] Checking Qdrant connection...');
    try {
      await qdrantAdapter.getCollections();
      console.log('[STARTUP] ✓ Qdrant connection successful');
    } catch (error) {
      console.warn('[STARTUP] ⚠ Qdrant connection failed (Visual RAG will be disabled):', error.message);
      console.warn('[STARTUP] To enable Visual RAG, ensure Qdrant is running.');
      // Degrade gracefully - do not throw
    }

    // Qdrant is already checked above via qdrantAdapter.getCollections()
    // No pg_vector check needed - vectors are stored in Qdrant

    // Ensure schema is ready
    console.log('[STARTUP] Ensuring database schema...');
    const schemaReady = await visualOverlayRepository.ensureEnhancedSchema();
    
    if (!schemaReady) {
      console.error('[STARTUP] ✗ Database schema initialization failed');
      console.error('[STARTUP] Check logs above for specific error details');
      throw new Error('Database schema initialization failed');
    }
    
    console.log('[STARTUP] ✓ Database schema ready');
    return true;
  } catch (error) {
    console.error('[STARTUP] ✗ Database validation failed:', error.message);
    console.error('[STARTUP] Please verify:');
    console.error('  1. PostgreSQL container is running: docker ps | grep paperless_db');
    console.error('  2. Environment variables are set in docker-compose.env');
    console.error('  3. Credentials match between docker-compose.env and PostgreSQL');
    console.error('  4. Qdrant container is running: docker ps | grep qdrant');
    throw error;
  }
}

async function startServer() {
  const port = process.env.PAPERLESS_AI_PORT || 3000;
  try {
    await initializeDataDirectory();
    await saveOpenApiSpec(); // Save OpenAPI specification on startup

    // Validate database connection before starting server
    await validateDatabaseConnection();

    const server = app.listen(port, () => {
      const actualPort = server.address().port;
      process.env.PAPERLESS_AI_PORT = actualPort;
      console.log(`Server running on port ${actualPort}`);
      startScanning();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  // Only start the server when run directly (node server.js). This prevents
  // automatic startup (and DB validation) when the module is required by tests.
  startServer();
}

// Export the Express app for tests that require the app directly
module.exports = app;
