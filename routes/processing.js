const express = require('express');
const router = express.Router();
const setupService = require('../services/setupService.js');
const paperlessService = require('../services/paperlessService.js');
const openaiService = require('../services/openaiService.js');
const ollamaService = require('../services/ollamaService.js');
const azureService = require('../services/azureService.js');
const documentModel = require('../services/documentModel.js');
const AIServiceFactory = require('../services/aiServiceFactory');
const logger = require('../services/logger');
const config = require('../config/config.js');
const customService = require('../services/customService.js');
const { DocumentProcessor } = require('../services/integration/DocumentProcessor');
const { pdfRenderer } = require('../services/visual-rag-client/PDFRenderer');
const path = require('path');
const axios = require('axios');

// Global task lock
let runningTask = false;
let documentQueue = [];
let isProcessing = false;
let _usePrompt = false;

/**
 * @swagger
 * /api/reset-all-documents:
 *   post:
 *     summary: Reset all processed documents
 *     description: |
 *       Deletes all processing records from the database, allowing documents to be processed again.
 *       This doesn't delete the actual documents from Paperless-ngx, only their processing status in Paperless-AI.
 *
 *       This operation can be useful when changing AI models or prompts, as it allows reprocessing
 *       all documents with the updated configuration.
 *     tags:
 *       - Documents
 *       - API
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: All documents successfully reset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Authentication required"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error resetting documents"
 */
router.post('/api/reset-all-documents', async (req, res) => {
  try {
    await documentModel.deleteAllDocuments();
    res.json({ success: true });
  }
  catch (error) {
    console.error('[ERROR] resetting documents:', error);
    res.status(500).json({ error: 'Error resetting documents' });
  }
});

/**
 * @swagger
 * /api/reset-documents:
 *   post:
 *     summary: Reset specific documents
 *     description: |
 *       Deletes processing records for specific documents, allowing them to be processed again.
 *       This doesn't delete the actual documents from Paperless-ngx, only their processing status in Paperless-AI.
 *
 *       This operation is useful when you want to reprocess only selected documents after changes to
 *       the AI model, prompt, or document metadata configuration.
 *     tags:
 *       - Documents
 *       - API
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of document IDs to reset
 *                 example: [123, 456, 789]
 *     responses:
 *       200:
 *         description: Documents successfully reset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid document IDs"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Authentication required"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error resetting documents"
 */
router.post('/api/reset-documents', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Invalid document IDs' });
    }

    await documentModel.deleteDocumentsIdList(ids);
    res.json({ success: true });
  }
  catch (error) {
    console.error('[ERROR] resetting documents:', error);
    res.status(500).json({ error: 'Error resetting documents' });
  }
});

/**
 * @swagger
 * /api/scan/now:
 *   post:
 *     summary: Trigger immediate document scan
 *     description: |
 *       Initiates an immediate scan of documents in Paperless-ngx that haven't been processed yet.
 *       This endpoint can be used to manually trigger processing without waiting for the scheduled interval.
 *
 *       The scan will:
 *       - Connect to Paperless-ngx API
 *       - Fetch all unprocessed documents
 *       - Process each document with the configured AI service
 *       - Update documents in Paperless-ngx with generated metadata
 *
 *       The process respects the function limitations set in the configuration.
 *     tags:
 *       - Documents
 *       - API
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Scan initiated successfully
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Task completed"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Authentication required"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error during document scan"
 */
router.post('/api/scan/now', async (req, res) => {
try {
    const isConfigured = await setupService.isConfigured();
    if (!isConfigured) {
      console.log(`Setup not completed. Visit http://your-machine-ip:${process.env.PAPERLESS_AI_PORT || 3000}/setup to complete setup.`);
      return;
    }

    const userId = await paperlessService.getOwnUserID();
    if (!userId) {
      console.error('Failed to get own user ID. Abort scanning.');
      return;
    }

    if (runningTask) {
      return res.status(409).json({ error: 'Scan already in progress' });
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

            if (result.updateData) {
              await savePipelineChanges(doc.id, result.updateData, result.analysis, result.originalData, req.user?.username || 'elfman');
            } else {
              const { analysis, originalData } = result;
              const updateData = await buildUpdateData(analysis, doc);
              await saveDocumentChanges(doc.id, updateData, analysis, originalData, req.user?.username || 'elfman');
            }
          } catch (error) {
            console.error(`[ERROR] processing document ${doc.id}:`, error);
          }
        }
      } catch (error) {
        console.error('[ERROR]  during document scan:', error);
      } finally {
        runningTask = false;
        console.log('[INFO] Task completed');
        res.send('Task completed');
      }
  } catch (error) {
    console.error('[ERROR] in startScanning:', error);
  }
});

async function processDocument(doc, existingTags, existingCorrespondentList, existingDocumentTypesList, ownUserId, customPrompt = null) {
  const isProcessed = await documentModel.isDocumentProcessed(doc.id);
  if (isProcessed) return null;
  await documentModel.setProcessingStatus(doc.id, doc.title, 'processing');

  const documentEditable = await paperlessService.getPermissionOfDocument(doc.id);
  if (!documentEditable) {
    console.log(`[DEBUG] Document belongs to: ${documentEditable}, skipping analysis`);
    console.log(`[DEBUG] Document ${doc.id} Not Editable by Paper-Ai User, skipping analysis`);
    return null;
  }else {
    console.log(`[DEBUG] Document ${doc.id} rights for AI User - processed`);
  }

  const useExpertPipeline = config.expertPipelineEnabled === true || config.expertPipelineEnabled === 'yes';
  const originalData = await paperlessService.getDocument(doc.id);
  const sourceDocument = originalData || doc;
  const documentCreated = sourceDocument?.created || sourceDocument?.added || doc.created || doc.added;

  if (useExpertPipeline) {
    const preparedDocument = await prepareDocumentForExpertPipeline(sourceDocument, doc.id);
    const processor = new DocumentProcessor(ollamaService, {
      mode: 'hybrid',
      enableVisualRAG: true
    });
    const result = await processor.process(preparedDocument, {
      mode: 'expert_pipeline',
      triggerVisualIngestion: true,
      existingTags: existingTags || [],
      existingCorrespondentList: existingCorrespondentList || [],
      existingDocumentTypesList: existingDocumentTypesList || [],
      customPrompt,
      documentCreated
    });
    if (!result.success || !result.paperless) {
      throw new Error(`[ERROR] Expert pipeline failed: ${result.error || 'unknown error'}`);
    }
    await documentModel.setProcessingStatus(doc.id, doc.title, 'complete');
    return {
      updateData: result.paperless,
      analysis: result.result,
      originalData: sourceDocument,
      pipeline: 'expert'
    };
  }

  let content = await paperlessService.getDocumentContent(doc.id);

  if (!content || !content.length >= 10) {
    console.log(`[DEBUG] Document ${doc.id} has no content, skipping analysis`);
    return null;
  }

  if (content.length > 50000) {
    content = content.substring(0, 50000);
  }

  // Prepare options for AI service
  const options = {
    restrictToExistingTags: config.restrictToExistingTags === 'yes',
    restrictToExistingCorrespondents: config.restrictToExistingCorrespondents === 'yes',
    documentCreated
  };

  // Get external API data if enabled
  if (config.externalApiConfig.enabled === 'yes') {
    try {
      const externalApiService = require('../services/externalApiService');
      const externalData = await externalApiService.fetchData();
      if (externalData) {
        options.externalApiData = externalData;
        logger.debug('Retrieved external API data for prompt enrichment');
      }
    } catch (error) {
      console.error('[ERROR] Failed to fetch external API data:', error.message);
    }
  }

  const aiService = AIServiceFactory.getService();
  let analysis;
  if(customPrompt) {
    logger.debug('Starting document analysis with custom prompt');
    analysis = await aiService.analyzeDocument(content, existingTags, existingCorrespondentList, existingDocumentTypesList, doc.id, customPrompt, options);
  }else{
    analysis = await aiService.analyzeDocument(content, existingTags, existingCorrespondentList, existingDocumentTypesList, doc.id, null, options);
  }
  logger.debug('Response from AI service: %o', analysis);
  if (analysis.error) {
    throw new Error(`[ERROR] Document analysis failed: ${analysis.error}`);
  }
  await documentModel.setProcessingStatus(doc.id, doc.title, 'complete');
  return { analysis, originalData: sourceDocument };
}

async function buildUpdateData(analysis, doc) {
  const updateData = {};

  // Create options object with restriction settings
  const options = {
    restrictToExistingTags: config.restrictToExistingTags === 'yes' ? true : false,
    restrictToExistingCorrespondents: config.restrictToExistingCorrespondents === 'yes' ? true : false
  };

  logger.debug('Building update data with restrictions: tags=%s, correspondents=%s', options.restrictToExistingTags, options.restrictToExistingCorrespondents);

  // Only process tags if tagging is activated
  if (config.limitFunctions?.activateTagging !== 'no') {
    const { tagIds, errors } = await paperlessService.processTags(analysis.document.tags, options);
    if (errors.length > 0) {
      console.warn('[ERROR] Some tags could not be processed:', errors);
    }
    updateData.tags = tagIds;
  } else if (config.limitFunctions?.activateTagging === 'no' && config.addAIProcessedTag === 'yes') {
    // Add AI processed tags to the document (processTags function awaits a tags array)
    // get tags from .env file and split them by comma and make an array
    logger.debug('Tagging is deactivated but AI processed tag will be added');
    const tags = config.addAIProcessedTags.split(',');
    const { tagIds, errors } = await paperlessService.processTags(tags, options);
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

      if (!customField.field_name || !customField.value?.trim()) {
        console.log(`[DEBUG] Skipping empty/invalid custom field`);
        continue;
      }

      const fieldDetails = await paperlessService.findExistingCustomField(customField.field_name);
      if (fieldDetails?.id) {
        processedFields.push({
          field: fieldDetails.id,
          value: customField.value.trim()
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
      const correspondent = await paperlessService.getOrCreateCorrespondent(analysis.document.correspondent, options);
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

async function saveDocumentChanges(docId, updateData, analysis, originalData, username = 'elfman') {
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
    documentModel.addToHistory(docId, updateData.tags, updateData.title, analysis.document.correspondent, username)
  ]);
}

async function applyPipelineTagGovernance(docId, updateData, analysis, originalTags = null) {
  const hadTagField = Object.prototype.hasOwnProperty.call(updateData || {}, 'tags');
  let tags = updateData?.tags || [];
  if (typeof tags === 'string') {
    tags = [tags];
  }
  const allowTagReplace = String(process.env.PIPELINE_TAG_REPLACE || '').toLowerCase() === 'yes';
  const missingTags = new Set();
  let combinedTagIds = [];

  if (Array.isArray(tags) && tags.length > 0) {
    const numericTagIds = [];
    const nameTags = [];

    tags.forEach(tag => {
      if (typeof tag === 'number' && Number.isFinite(tag)) {
        numericTagIds.push(tag);
        return;
      }
      if (typeof tag === 'string') {
        const trimmed = tag.trim();
        if (trimmed) nameTags.push(trimmed);
        return;
      }
      if (tag && typeof tag === 'object') {
        if (typeof tag.id === 'number' && Number.isFinite(tag.id)) {
          numericTagIds.push(tag.id);
        }
        if (typeof tag.name === 'string') {
          const trimmed = tag.name.trim();
          if (trimmed) nameTags.push(trimmed);
        }
      }
    });

    let resolvedTagIds = [];
    if (nameTags.length > 0) {
      const { tagIds, errors } = await paperlessService.processTags(nameTags, {
        restrictToExistingTags: true
      });
      resolvedTagIds = tagIds;
      if (Array.isArray(errors) && errors.length > 0) {
        errors.forEach(err => {
          if (err?.tagName) missingTags.add(String(err.tagName).trim());
        });
      }
    }

    combinedTagIds = [...new Set([...numericTagIds, ...resolvedTagIds])];
  }

  if (combinedTagIds.length > 0) {
    tags = combinedTagIds;
    updateData.tags = combinedTagIds;
  } else if (hadTagField) {
    if (allowTagReplace) {
      tags = [];
      updateData.tags = [];
    } else {
      if (Array.isArray(originalTags)) {
        tags = originalTags;
      }
      if (updateData && Object.prototype.hasOwnProperty.call(updateData, 'tags')) {
        delete updateData.tags;
      }
    }
  }

  if (Array.isArray(analysis?.missing_tags)) {
    analysis.missing_tags.forEach(tag => {
      if (tag) missingTags.add(String(tag).trim());
    });
  }
  if (Array.isArray(analysis?.tagging?.missing_tags)) {
    analysis.tagging.missing_tags.forEach(tag => {
      if (tag) missingTags.add(String(tag).trim());
    });
  }

  if (missingTags.size > 0) {
    const stagedMissingTags = Array.from(missingTags).filter(Boolean);
    let customFieldReady = true;
    try {
      await paperlessService.createCustomFieldSafely('ai_missing_tags', 'text');
    } catch (error) {
      customFieldReady = false;
      logger.warn('[Pipeline] Failed to ensure ai_missing_tags field', {
        docId,
        error: error.message
      });
    }
    if (customFieldReady) {
      updateData.custom_fields = {
        ...(updateData.custom_fields || {}),
        ai_missing_tags: JSON.stringify(stagedMissingTags)
      };
    }
    logger.warn('[Pipeline] Missing tags staged for review', {
      docId,
      missingTags: stagedMissingTags
    });
  }

  return { tags, updateData };
}

async function savePipelineChanges(docId, updateData, analysis, originalData, username = 'elfman') {
  const original = originalData || {};
  const { tags: originalTags, correspondent: originalCorrespondent, title: originalTitle } = original;
  const title = updateData?.title || originalTitle || '';
  const correspondent = updateData?.correspondent || originalCorrespondent || null;
  const governanceResult = await applyPipelineTagGovernance(
    docId,
    updateData,
    analysis,
    originalTags
  );
  const tags = governanceResult.tags;
  const tasks = [
    documentModel.saveOriginalData(docId, originalTags, originalCorrespondent, originalTitle),
    paperlessService.updateDocument(docId, updateData),
    documentModel.addProcessedDocument(docId, title),
    documentModel.addToHistory(docId, tags, title, correspondent, username)
  ];
  const metrics = analysis?.metrics;
  if (metrics &&
      Number.isFinite(metrics.promptTokens) &&
      Number.isFinite(metrics.completionTokens) &&
      Number.isFinite(metrics.totalTokens)) {
    tasks.push(documentModel.addOpenAIMetrics(
      docId,
      metrics.promptTokens,
      metrics.completionTokens,
      metrics.totalTokens
    ));
  }
  await Promise.all(tasks);
}

async function prepareDocumentForExpertPipeline(document, documentId) {
  logger.info(`[Processing] Preparing document ${documentId} for Expert Pipeline`);

  const archiveFileName = document.archive_file_name || document.archive_filename || null;
  const originalFileName = document.original_file_name || `doc-${documentId}.pdf`;
  const relativePdfPath = archiveFileName
    ? path.posix.join('documents', 'archive', archiveFileName)
    : path.posix.join('documents', 'originals', originalFileName);
  const mediaRoot = process.env.PAPERLESS_MEDIA_ROOT || '/usr/src/paperless/media';
  const absolutePdfPath = path.posix.join(mediaRoot, relativePdfPath);

  const preparedDoc = {
    id: documentId,
    title: document.title,
    filename: document.original_file_name || `document-${documentId}.pdf`,
    content: document.content || '',
    pdf_path: relativePdfPath,
    pdf_path_abs: absolutePdfPath,
    tags: document.tags,
    correspondent: document.correspondent,
    document_type: document.document_type,
    created: document.created
  };

  try {
    const ocrText = await paperlessService.getDocumentContent(documentId);
    if (ocrText && typeof ocrText === 'string' && ocrText.length > 0) {
      preparedDoc.ocr_text = ocrText;
      preparedDoc.content = ocrText;
    }
  } catch (ocrError) {
    logger.warn(`[Processing] Could not fetch OCR text for doc ${documentId}: ${ocrError.message}`);
  }

  const isPdf = document.mime_type === 'application/pdf' ||
                (document.original_file_name && document.original_file_name.toLowerCase().endsWith('.pdf'));

  if (isPdf && pdfRenderer.isAvailable()) {
    try {
      const apiUrl = config.paperless?.apiUrl || process.env.PAPERLESS_API_URL;
      const apiToken = config.paperless?.apiToken || process.env.PAPERLESS_API_TOKEN;

      const pdfResponse = await axios.get(
        `${apiUrl}/documents/${documentId}/download/`,
        {
          headers: { 'Authorization': `Token ${apiToken}` },
          responseType: 'arraybuffer',
          timeout: 60000
        }
      );
      const pdfBuffer = Buffer.from(pdfResponse.data);

      const renderDpi = Number.isFinite(config.visualRag?.visionRenderDpi) ? config.visualRag.visionRenderDpi : 300;
      const maxPages = Number.isFinite(config.visualRag?.maxVisionPages) ? config.visualRag.maxVisionPages : 4;

      const images = await pdfRenderer.renderBuffer(pdfBuffer, {
        dpi: renderDpi,
        maxPages: maxPages,
        docId: documentId
      });

      if (images && images.length > 0) {
        const imageFormat = images[0].format || 'png';
        preparedDoc.image_data = `data:image/${imageFormat};base64,${images[0].base64}`;
        preparedDoc.base64Images = images.map(img => `data:image/${img.format || 'png'};base64,${img.base64}`);
      }
    } catch (pdfError) {
      logger.warn(`[Processing] Could not render PDF for doc ${documentId}: ${pdfError.message}`);
    }
  }

  return preparedDoc;
}

function extractDocumentId(url) {
  const match = url.match(/\/documents\/(\d+)\//);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  throw new Error('Could not extract document ID from URL');
}

async function processQueue(customPrompt) {
  if (customPrompt) {
    console.log('Using custom prompt:', customPrompt);
  }

  if (isProcessing || documentQueue.length === 0) return;

  isProcessing = true;

  try {
    const isConfigured = await setupService.isConfigured();
    if (!isConfigured) {
      console.log(`Setup not completed. Visit http://your-machine-ip:${process.env.PAPERLESS_AI_PORT || 3000}/setup to complete setup.`);
      return;
    }

    const userId = await paperlessService.getOwnUserID();
    if (!userId) {
      console.error('Failed to get own user ID. Abort scanning.');
      return;
    }

    const [existingTags, existingCorrespondentList, existingDocumentTypes, ownUserId] = await Promise.all([
      paperlessService.getTags(),
      paperlessService.listCorrespondentsNames(),
      paperlessService.listDocumentTypesNames(),
      paperlessService.getOwnUserID()
    ]);

    const existingDocumentTypesList = existingDocumentTypes.map(docType => docType.name);

    while (documentQueue.length > 0) {
      const item = documentQueue.shift();
      const doc = item.doc || item; // Handle both {doc, username} and legacy doc objects
      const username = item.username || 'system';

      try {
        const result = await processDocument(doc, existingTags, existingCorrespondentList, existingDocumentTypesList, ownUserId, customPrompt);
        if (!result) continue;

        if (result.updateData) {
          await savePipelineChanges(doc.id, result.updateData, result.analysis, result.originalData, username);
        } else {
          const { analysis, originalData } = result;
          const updateData = await buildUpdateData(analysis, doc);
          await saveDocumentChanges(doc.id, updateData, analysis, originalData, username);
        }
      } catch (error) {
        console.error(`[ERROR] Failed to process document ${doc.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[ERROR] Error during queue processing:', error);
  } finally {
    isProcessing = false;

    if (documentQueue.length > 0) {
      processQueue();
    }
  }
}

/**
 * @swagger
 * /api/webhook/document:
 *   post:
 *     summary: Webhook for document updates
 *     description: |
 *       Processes incoming webhook notifications from Paperless-ngx about document
 *       changes, additions, or deletions. The webhook allows Paperless-AI to respond
 *       to document changes in real-time.
 *
 *       When a new document is added or updated in Paperless-ngx, this endpoint can
 *       trigger automatic AI processing for metadata extraction.
 *     tags:
 *       - Documents
 *       - API
 *       - System
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event_type
 *               - document_id
 *             properties:
 *               event_type:
 *                 type: string
 *                 description: Type of event that occurred
 *                 enum: ["added", "updated", "deleted"]
 *                 example: "added"
 *               document_id:
 *                 type: integer
 *                 description: ID of the affected document
 *                 example: 123
 *               document_info:
 *                 type: object
 *                 description: Additional information about the document (optional)
 *                 properties:
 *                   title:
 *                     type: string
 *                     example: "Invoice"
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Document event processed"
 *                 processing_queued:
 *                   type: boolean
 *                   description: Whether AI processing was queued for this document
 *                   example: true
 *       400:
 *         description: Invalid webhook payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Missing required fields: event_type, document_id"
 *       401:
 *         description: Unauthorized - invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized: Invalid API key"
 *       500:
 *         description: Server error processing webhook
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/api/webhook/document', async (req, res) => {
  try {
    const { url, prompt } = req.body;
    if (!url) {
      return res.status(400).send('Missing document URL');
    }

    try {
      const documentId = extractDocumentId(url);
      const document = await paperlessService.getDocument(documentId);

      if (!document) {
        return res.status(404).send(`Document with ID ${documentId} not found`);
      }

      documentQueue.push({ doc: document, username: 'system' });
      if (prompt) {
        _usePrompt = true;
        logger.debug('Using custom prompt: %s', prompt);
        await processQueue(prompt);
      } else {
        await processQueue();
      }


      res.status(202).send({
        message: 'Document accepted for processing',
        documentId: documentId,
        queuePosition: documentQueue.length
      });

    } catch (error) {
      console.error('[ERROR] Failed to extract document ID or fetch document:', error);
      return res.status(200).send('Invalid document URL format');
    }

  } catch (error) {
    console.error('[ERROR] Error in webhook endpoint:', error);
    res.status(200).send('Internal server error');
  }
});

router.post('/manual/analyze', express.json(), async (req, res) => {
  try {
    const { content, id } = req.body;
    let existingCorrespondentList = await paperlessService.listCorrespondentsNames();
    existingCorrespondentList = existingCorrespondentList.map(correspondent => correspondent.name);
    let existingTagsList = await paperlessService.listTagNames();
    existingTagsList = existingTagsList.map(tags => tags.name);
    let existingDocumentTypes = await paperlessService.listDocumentTypesNames();
    let existingDocumentTypesList = existingDocumentTypes.map(docType => docType.name);

    if (!content || typeof content !== 'string') {
      console.log('Invalid content received:', content);
      return res.status(400).json({ error: 'Valid content string is required' });
    }

    if (process.env.AI_PROVIDER === 'openai') {
      const analyzeDocument = await openaiService.analyzeDocument(content, existingTagsList, existingCorrespondentList, existingDocumentTypesList, id || []);
      await documentModel.addOpenAIMetrics(
            id,
            analyzeDocument.metrics.promptTokens,
            analyzeDocument.metrics.completionTokens,
            analyzeDocument.metrics.totalTokens
          )
      return res.json(analyzeDocument);
    } else if (process.env.AI_PROVIDER === 'ollama') {
      const analyzeDocument = await ollamaService.analyzeDocument(content, existingTagsList, existingCorrespondentList, existingDocumentTypesList, id || []);
      return res.json(analyzeDocument);
    } else if (process.env.AI_PROVIDER === 'custom') {
      const analyzeDocument = await customService.analyzeDocument(content, existingTagsList, existingCorrespondentList, existingDocumentTypesList, id || []);
      return res.json(analyzeDocument);
    } else if (process.env.AI_PROVIDER === 'azure') {
      const analyzeDocument = await azureService.analyzeDocument(content, existingTagsList, existingCorrespondentList, existingDocumentTypesList, id || []);
      return res.json(analyzeDocument);
    } else {
      return res.status(500).json({ error: 'AI provider not configured' });
    }
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /manual/analyze-visual:
 *   post:
 *     summary: Analyze document using Visual Expert Pipeline
 *     description: |
 *       Renders the document at 300 DPI and processes it through the Expert Pipeline
 *       with vision capabilities. This uses the router model (qwen3-vl:8b) to classify
 *       the document and extract visual overlays.
 *     tags:
 *       - Documents
 *       - API
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - docId
 *             properties:
 *               docId:
 *                 type: integer
 *                 description: The document ID from Paperless-ngx
 *     responses:
 *       200:
 *         description: Visual analysis results from Expert Pipeline
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: object
 *                   description: Expert Pipeline analysis result
 *                 overlayCount:
 *                   type: integer
 *                   description: Number of overlays extracted
 *       400:
 *         description: Invalid request parameters
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error or PDF rendering failed
 */
router.post('/manual/analyze-visual', express.json(), async (req, res) => {
  try {
    const { docId } = req.body;

    if (!docId) {
      return res.status(400).json({ success: false, error: 'docId is required' });
    }

    logger.info('[Visual Analysis] Starting for document %s', docId);

    // Step 1: Download PDF from Paperless-ngx
    const pdfBuffer = await paperlessService.downloadDocument(docId);
    if (!pdfBuffer) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Step 2: Get document metadata
    const doc = await paperlessService.getDocument(docId);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document metadata not found' });
    }

    // Step 3: Render PDF at 300 DPI
    const dpi = config.visualRag?.visionRenderDpi || 300;
    const images = await pdfRenderer.renderBuffer(pdfBuffer, {
      dpi,
      docId,
      maxPages: 4 // Limit for Expert Pipeline processing
    });

    if (!images || images.length === 0) {
      return res.status(500).json({ success: false, error: 'Failed to render PDF' });
    }

    logger.info('[Visual Analysis] Rendered %d pages at %d DPI', images.length, dpi);

    // Step 4: Prepare document with image data in data URL format
    const preparedDoc = {
      id: docId,
      title: doc.title,
      filename: doc.original_file_name || `document-${docId}.pdf`,
      content: doc.content || '',
      ocr_text: doc.content || '',
      image_data: `data:image/png;base64,${images[0].base64}`,
      base64Images: images.map(img => `data:image/png;base64,${img.base64}`)
    };

    // Step 5: Process with Expert Pipeline
    const processor = new DocumentProcessor(ollamaService);
    const result = await processor.process(preparedDoc, { forceExpertPipeline: true });

    const visualExecution = result?._expert_result?.result?.outputs?.visual_execution;
    const visualMetadata = visualExecution?.metadata || visualExecution?.execution_metadata || null;
    const visualFallback = visualMetadata?.fallback ? {
      reason: visualMetadata.fallback_reason,
      evidence_source: visualMetadata.evidence_source || 'visual',
      manual_review_required: Boolean(visualMetadata.manual_review_required),
      text_fallback_unavailable: Boolean(visualMetadata.text_fallback_unavailable),
      error: visualMetadata.error || null
    } : null;

    if (visualFallback?.text_fallback_unavailable) {
      return res.status(503).json({
        success: false,
        error: 'Text RAG unavailable while visual fallback required',
        fallback: visualFallback
      });
    }

    // Step 6: Extract and save overlays if overlay extraction is enabled
    let overlayCount = 0;
    if (config.visualRagSidecar?.enableOverlayExtraction && result.overlays) {
      const { visualOverlayRepository } = require('../services/visual-rag-client');
      // Delete existing overlays for this document
      await visualOverlayRepository.deleteByDocId(docId);
      // Save new overlays
      for (const overlay of result.overlays) {
        await visualOverlayRepository.save({
          doc_id: docId,
          page_number: overlay.page || 1,
          field_type: overlay.field_type || 'unknown',
          bbox: overlay.bbox,
          raw_value: overlay.raw_value || '',
          normalized_value: overlay.normalized_value || '',
          confidence: overlay.confidence || 0,
          domain: result.domain || 'general',
          extraction_model: 'expert-pipeline'
        });
        overlayCount++;
      }
      logger.info('[Visual Analysis] Saved %d overlays for document %s', overlayCount, docId);
    }

    res.json({
      success: true,
      result: {
        title: result.title,
        tags: result.tags,
        correspondent: result.correspondent,
        document_type: result.document_type,
        created: result.created,
        domain: result.domain,
        confidence: result.confidence
      },
      overlayCount,
      fallback: visualFallback
    });

  } catch (error) {
    logger.error('[Visual Analysis] Error: %s', error.message);
    console.error('[Visual Analysis] Stack:', error.stack);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /manual/playground:
 *   post:
 *     summary: Process document using a custom prompt in playground mode
 *     description: |
 *       Analyzes document content using a custom user-provided prompt.
 *       This endpoint is primarily used for testing and experimenting with different prompts
 *       without affecting the actual document processing workflow.
 *
 *       The analysis is performed using the AI provider configured in the application settings,
 *       but with a custom prompt that overrides the default system prompt.
 *     tags:
 *       - Documents
 *       - API
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The document text content to analyze
 *                 example: "Invoice from Acme Corp. Total amount: $125.00, Due date: 2023-08-15"
 *               prompt:
 *                 type: string
 *                 description: Custom prompt to use for analysis
 *                 example: "Extract the company name, invoice amount, and due date from this document."
 *               documentId:
 *                 type: string
 *                 description: Optional document ID for tracking metrics
 *                 example: "doc_123"
 *     responses:
 *       200:
 *         description: Document analysis results using the custom prompt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   description: The raw AI response using the custom prompt
 *                   example: "Company: Acme Corp\nAmount: $125.00\nDue Date: 2023-08-15"
 *                 metrics:
 *                   type: object
 *                   description: Token usage metrics (when using OpenAI)
 *                   properties:
 *                     promptTokens:
 *                       type: number
 *                       example: 350
 *                     completionTokens:
 *                       type: number
 *                       example: 120
 *                     totalTokens:
 *                       type: number
 *                       example: 470
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error or AI provider not configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/manual/playground', express.json(), async (req, res) => {
  try {
    const { content, prompt, documentId } = req.body;

    if (!content || typeof content !== 'string') {
      console.log('Invalid content received:', content);
      return res.status(400).json({ error: 'Valid content string is required' });
    }

    if (process.env.AI_PROVIDER === 'openai') {
      const analyzeDocument = await openaiService.analyzePlayground(content, prompt);
      await documentModel.addOpenAIMetrics(
        documentId,
        analyzeDocument.metrics.promptTokens,
        analyzeDocument.metrics.completionTokens,
        analyzeDocument.metrics.totalTokens
      )
      return res.json(analyzeDocument);
    } else if (process.env.AI_PROVIDER === 'ollama') {
      const analyzeDocument = await ollamaService.analyzePlayground(content, prompt);
      return res.json(analyzeDocument);
    } else if (process.env.AI_PROVIDER === 'custom') {
      const analyzeDocument = await customService.analyzePlayground(content, prompt);
      await documentModel.addOpenAIMetrics(
        documentId,
        analyzeDocument.metrics.promptTokens,
        analyzeDocument.metrics.completionTokens,
        analyzeDocument.metrics.totalTokens
      )
      return res.json(analyzeDocument);
    } else if (process.env.AI_PROVIDER === 'azure') {
      const analyzeDocument = await azureService.analyzePlayground(content, prompt);
      await documentModel.addOpenAIMetrics(
        documentId,
        analyzeDocument.metrics.promptTokens,
        analyzeDocument.metrics.completionTokens,
        analyzeDocument.metrics.totalTokens
      )
      return res.json(analyzeDocument);
    } else {
      return res.status(500).json({ error: 'AI provider not configured' });
    }
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /manual/updateDocument:
 *   post:
 *     summary: Update document metadata in Paperless-ngx
 *     description: |
 *       Updates document metadata such as tags, correspondent and title in the Paperless-ngx system.
 *       This endpoint handles the translation between tag names and IDs, and manages the creation of
 *       new tags or correspondents if they don't exist in the system.
 *
 *       The endpoint also removes any unused tags from the document to keep the metadata clean.
 *     tags:
 *       - Documents
 *       - API
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *             properties:
 *               documentId:
 *                 type: number
 *                 description: ID of the document to update in Paperless-ngx
 *                 example: 123
 *               tags:
 *                 type: array
 *                 description: List of tags to apply (can be tag IDs or names)
 *                 items:
 *                   oneOf:
 *                     - type: number
 *                     - type: string
 *                 example: ["Invoice", 42, "Finance"]
 *               correspondent:
 *                 type: string
 *                 description: Correspondent name to assign to the document
 *                 example: "Acme Corp"
 *               title:
 *                 type: string
 *                 description: New title for the document
 *                 example: "Acme Corp Invoice - August 2023"
 *     responses:
 *       200:
 *         description: Document successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Document updated successfully"
 *       400:
 *         description: Invalid request parameters or tag processing errors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Failed to create tag: Invalid tag name"]
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/manual/updateDocument', express.json(), async (req, res) => {
  const crypto = require('crypto');
  const feedbackService = require('../services/feedback/FeedbackService');
  const { normalizeManualUpdatePayload } = require('../services/manualUpdateNormalizer');
  const requestId = req.headers['x-request-id'] || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.floor(Math.random()*10000)}`);

  logger.info('manual.updateDocument.request', { requestId, bodySummary: Object.keys(req.body) });

  try {
    // Support both legacy and unified payload formats
    let documentId = req.body.documentId || req.body.document_id || (req.body.document_updates && req.body.document_updates.documentId);
    if (!documentId) return res.status(400).json({ error: 'documentId is required' });

    // If unified payload
    if (req.body.document_updates || req.body.feedback_events || req.body.visual_annotations) {
      let documentUpdates = req.body.document_updates || {};
      const feedbackEvents = req.body.feedback_events || req.body.feedbackEvents || [];
      const transactional = Boolean(req.body.transactional);

      logger.debug('manual.updateDocument.unifiedPayload', { requestId, documentId, transactional, events: feedbackEvents.length });

      // If transactional, persist feedback first (local) to avoid external partial failures
      if (transactional) {
        const feedbackResult = await feedbackService.recordGranularFeedback(documentId, feedbackEvents, { requestId, transactional: true });
        if (feedbackResult.errors && feedbackResult.errors.length > 0) {
          logger.error('manual.updateDocument.feedback_failed_transactional', { requestId, documentId, errors: feedbackResult.errors });
          return res.status(500).json({ error: 'Failed to persist feedback transactionally', details: feedbackResult.errors });
        }
      }

      // Fetch current document state for later change detection
      let originalDoc;
      try {
        originalDoc = await paperlessService.getDocument(documentId);
      } catch (e) {
        logger.warn('manual.updateDocument.fetch_original_failed', { requestId, documentId, error: e.message });
      }

      // Normalize updates before sending to Paperless
      try {
        documentUpdates = await normalizeManualUpdatePayload(documentUpdates, requestId);
      } catch (normErr) {
        const status = normErr.statusCode || 400;
        logger.warn('manual.updateDocument.normalize_failed', {
          requestId,
          documentId,
          error: normErr.message
        });
        return res.status(status).json({ error: normErr.message });
      }

      const updateTimeoutMs = parseInt(
        process.env.PAPERLESS_UPDATE_TIMEOUT_MS,
        10
      ) || 5000;
      const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(null), ms);
        promise.then((value) => {
          clearTimeout(timer);
          resolve(value);
        }).catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
      });

      // Proceed to update Paperless (primary source of truth)
      const updateDocument = await withTimeout(
        paperlessService.updateDocument(documentId, documentUpdates, { requestId }),
        updateTimeoutMs
      ).catch((err) => {
        logger.warn('manual.updateDocument.paperless_update_timeout', {
          requestId,
          documentId,
          error: err.message
        });
        return null;
      });

      if (!updateDocument) {
        const msg = 'Failed to update document in Paperless';
        logger.error('manual.updateDocument.paperless_update_failed', { requestId, documentId });
        try {
          const { metricsCollector } = require('../services/metrics/PrometheusMetrics');
          metricsCollector && metricsCollector.integrationErrorsTotal && metricsCollector.integrationErrorsTotal.labels && metricsCollector.integrationErrorsTotal.labels('manual_orchestration').inc();
        } catch (mErr) {
          logger.debug('metrics_increment_failed', { error: mErr.message });
        }
        if (transactional) {
          // In transactional mode, we fail the whole operation
          return res.status(500).json({ error: msg });
        } else {
          // In non-transactional mode, we record feedback anyway
          if (!transactional && feedbackEvents.length > 0) {
            await feedbackService.recordGranularFeedback(documentId, feedbackEvents, { requestId, transactional: false });
          }
          return res.status(500).json({ error: msg });
        }
      }

      // If non-transactional and we have feedback, persist it now after Paperless success
      if (!transactional && feedbackEvents.length > 0) {
        await feedbackService.recordGranularFeedback(documentId, feedbackEvents, { requestId, transactional: false });
      }

      // Fire-and-forget: if tags or correspondent changed, trigger a Qdrant payload sync
      try {
        const qdrant = require('../services/visual-rag-client/QdrantAdapter');
        const { metricsCollector } = require('../services/metrics/PrometheusMetrics');

        const origTags = (originalDoc && Array.isArray(originalDoc.tags)) ? originalDoc.tags : [];
        const newTags = (updateDocument && Array.isArray(updateDocument.tags)) ? updateDocument.tags : [];
        const tagsChanged = JSON.stringify(origTags.slice().sort()) !== JSON.stringify(newTags.slice().sort());
        const origCorr = (originalDoc && originalDoc.correspondent !== undefined) ? originalDoc.correspondent : null;
        const newCorr = (updateDocument && updateDocument.correspondent !== undefined) ? updateDocument.correspondent : null;

        if (tagsChanged || origCorr !== newCorr) {
          // Run asynchronously and do not block the response
          setImmediate(async () => {
            try {
              const coll = (qdrant && qdrant.COLLECTIONS && qdrant.COLLECTIONS.document_embeddings && qdrant.COLLECTIONS.document_embeddings.name) ? qdrant.COLLECTIONS.document_embeddings.name : 'document_embeddings';
              await qdrant.qdrantAdapter.updatePayloadForDoc(coll, documentId, { tags: newTags, correspondent: newCorr });
              metricsCollector && metricsCollector.recordQdrantPayloadSync && metricsCollector.recordQdrantPayloadSync(coll);
            } catch (e) {
              logger.warn('manual.updateDocument.qdrant_sync_failed', { requestId, documentId, error: e.message });
            }
          });
        }
      } catch (e) {
        // best-effort; swallow errors to avoid affecting the user request
        logger.debug('manual.updateDocument.qdrant_sync_skipped', { requestId, documentId });
      }

      return res.json({ success: true, message: 'Document updated successfully' });
    }

    // Legacy payload format handling
    const tags = req.body.tags || [];
    const correspondent = req.body.correspondent;
    const title = req.body.title;

    const updateData = {};
    if (Array.isArray(tags) && tags.length > 0) {
      const { tagIds, errors } = await paperlessService.processTags(tags, { restrictToExistingTags: false });
      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }
      updateData.tags = tagIds;
    }

    if (correspondent) {
      const correspondentObj = await paperlessService.getOrCreateCorrespondent(correspondent);
      if (correspondentObj) {
        updateData.correspondent = correspondentObj.id;
      }
    }

    if (title) {
      updateData.title = title;
    }

    await paperlessService.updateDocument(documentId, updateData);
    res.json({ success: true, message: 'Document updated successfully' });
  } catch (error) {
    logger.error('manual.updateDocument.error', { requestId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
