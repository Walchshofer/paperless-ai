const express = require('express');
const router = express.Router();
const paperlessService = require('../services/paperlessService.js');
const documentModel = require('../services/documentModel.js');
const configFile = require('../config/config.js');
const {
  HistoryDocumentVmSchema,
} = require('../src/ui/contracts/HistoryDocument.contract.js');

/**
 * @swagger
 * /history:
 *   get:
 *     summary: Document history page
 *     description: |
 *       Renders the document history page with filtering options.
 *       This page displays a list of all documents that have been processed by Paperless-AI,
 *       showing the changes made to the documents through AI processing.
 *
 *       The page includes filtering capabilities by correspondent, tag, and free text search,
 *       allowing users to easily find specific documents or categories of processed documents.
 *       Each entry includes links to the original document in Paperless-ngx.
 *     tags:
 *       - History
 *       - Navigation
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: History page rendered successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML content of the history page with filtering controls and document list
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
router.get('/history', async (req, res) => {
  try {
    const username = req.user.username;
    const allTags = await paperlessService.getTags();

    // Get all correspondents for filter dropdown
    const historyDocuments = await documentModel.getAllHistory(username);
    const allCorrespondents = [...new Set(historyDocuments.map(doc => doc.correspondent))]
      .filter(Boolean).sort();

    const vm = {
      version: configFile.PAPERLESS_AI_VERSION,
      config: {
        disableGithubFetch: process.env.DISABLE_GITHUB_FETCH || 'no'
      },
      history: {
        filters: {
          tags: allTags,
          correspondents: allCorrespondents
        },
        initialQuery: {
          search: '',
          tag: null,
          correspondent: null,
          sort: { column: 'created_at', dir: 'desc' },
          page: 0,
          pageSize: 10
        }
      }
    };

    res.render('history', { vm });
  } catch (error) {
    console.error('[ERROR] loading history page:', error);
    res.status(500).send('Error loading history page');
  }
});

// Backwards-compatible redirect: /history/:id -> /history/doc/:id
router.get('/history/:id', (req, res) => {
  const documentId = req.params.id;
  if (!documentId) {
    return res.status(400).send('Document ID is required');
  }
  return res.redirect(`/history/doc/${documentId}`);
});

router.get('/history/doc/:id', async (req, res) => {
  try {
    const documentId = req.params.id;
    if (!documentId) {
      return res.status(400).send('Document ID is required');
    }

    let document = null;
    let content = null;

    const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Paperless request timed out'));
      }, ms);
      promise.then((value) => {
        clearTimeout(timer);
        resolve(value);
      }).catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    const fetchTimeoutMs = parseInt(
      process.env.PAPERLESS_HISTORY_TIMEOUT_MS,
      10
    ) || 5000;

    const [docResult, contentResult] = await Promise.allSettled([
      withTimeout(paperlessService.getDocument(documentId), fetchTimeoutMs),
      withTimeout(paperlessService.getDocumentContent(documentId), fetchTimeoutMs)
    ]);

    if (docResult.status === 'fulfilled') {
      document = docResult.value;
    } else if (docResult.reason) {
      console.warn('[WARN] history document fetch failed:', docResult.reason.message);
    }

    if (contentResult.status === 'fulfilled') {
      content = contentResult.value;
    } else if (contentResult.reason) {
      console.warn('[WARN] history content fetch failed:', contentResult.reason.message);
    }

    const parseTagIds = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const resolveWithTimeout = async (promise, fallback, label) => {
      try {
        return await withTimeout(promise, fetchTimeoutMs);
      } catch (error) {
        if (label) {
          console.warn(`[WARN] ${label} timeout`, error.message);
        }
        return fallback;
      }
    };

    const resolveTagName = async (tagId) => {
      const name = await resolveWithTimeout(
        paperlessService.getTagTextFromId(tagId),
        null,
        `tag ${tagId}`
      );
      return name || `Tag ${tagId}`;
    };

    const fallbackHistory = !document
      ? await documentModel.getHistory(documentId, req.user?.username || 'elfman')
      : null;

    const tagIds = parseTagIds(document?.tags || fallbackHistory?.tags);

    const tags = tagIds.length
      ? await Promise.all(tagIds.map(resolveTagName))
      : [];

    // Build tag objects for templates that expect id/name pairs
    const tagObjects = tagIds.length
      ? await Promise.all(tagIds.map(async tagId => {
          const tagName = await resolveTagName(tagId);
          return { id: tagId, name: tagName };
        }))
      : [];

    let correspondentName = fallbackHistory?.correspondent || 'Not assigned';
    if (document?.correspondent) {
      const correspondent = await resolveWithTimeout(
        paperlessService.getCorrespondentNameById(document.correspondent),
        null,
        `correspondent ${document.correspondent}`
      );
      correspondentName = correspondent?.name ||
        correspondent?.value || correspondentName;
    }

    const correspondentId = document?.correspondent || null;
    const documentType = document?.document_type || document?.type || null;
    const modifiedAt = document?.modified || document?.modified_at || null;
    const createdAt = document?.created || document?.created_at ||
      fallbackHistory?.created_at || '';
    const paperlessBaseUrl = process.env.PAPERLESS_API_URL
      ? process.env.PAPERLESS_API_URL.replace(/\/api$/, '')
      : '';

    const metadata = {
      correspondent: correspondentName || null,
      correspondentId,
      tags: tagObjects,
      documentType,
      created: createdAt || null,
      modified: modifiedAt || null
    };

    const vm = {
      documentId: document?.id || documentId,
      title:
        document?.title || fallbackHistory?.title || `Document ${documentId}`,
      content: content || 'No content available for this document.',
      tags,
      tagObjects,
      metadata,
      correspondent: correspondentName,
      correspondentId,
      documentType,
      createdAt,
      modifiedAt,
      paperlessUrl: paperlessBaseUrl,
      original_url: paperlessBaseUrl
        ? `${paperlessBaseUrl}/documents/${document?.id}/download/original/`
        : null,
      page_count: document?.page_count || 1,
      // Keep overlay props null-safe; overlays are fetched client-side.
      images: [],
      overlaysByImage: {},
    };

    const parsedVm = HistoryDocumentVmSchema.parse(vm);
    res.render('history-document', { vm: parsedVm });
  } catch (error) {
    console.error('[ERROR] loading history document:', error);
    res.status(500).send('Error loading document preview');
  }
});

/**
 * @swagger
 * /api/history:
 *   get:
 *     summary: Get processed document history
 *     description: |
 *       Returns a paginated list of documents that have been processed by Paperless-AI.
 *       Supports filtering by tag, correspondent, and search term.
 *       Designed for integration with DataTables jQuery plugin.
 *
 *       This endpoint provides comprehensive information about each processed document,
 *       including its metadata before and after AI processing, allowing users to track
 *       changes made by the system.
 *     tags:
 *       - History
 *       - API
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: draw
 *         schema:
 *           type: integer
 *         description: Draw counter for DataTables (prevents XSS)
 *         example: 1
 *       - in: query
 *         name: start
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Starting record index for pagination
 *         example: 0
 *       - in: query
 *         name: length
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records to return per page
 *         example: 10
 *       - in: query
 *         name: search[value]
 *         schema:
 *           type: string
 *         description: Global search term (searches title, correspondent and tags)
 *         example: "invoice"
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filter by tag ID
 *         example: "5"
 *       - in: query
 *         name: correspondent
 *         schema:
 *           type: string
 *         description: Filter by correspondent name
 *         example: "Acme Corp"
 *       - in: query
 *         name: order[0][column]
 *         schema:
 *           type: integer
 *         description: Index of column to sort by (0=document_id, 1=title, etc.)
 *         example: 1
 *       - in: query
 *         name: order[0][dir]
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort direction (ascending or descending)
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Document history returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 draw:
 *                   type: integer
 *                   description: Echo of the draw parameter
 *                   example: 1
 *                 recordsTotal:
 *                   type: integer
 *                   description: Total number of records in the database
 *                   example: 100
 *                 recordsFiltered:
 *                   type: integer
 *                   description: Number of records after filtering
 *                   example: 20
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       document_id:
 *                         type: integer
 *                         description: Document ID
 *                         example: 123
 *                       title:
 *                         type: string
 *                         description: Document title
 *                         example: "Invoice #12345"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         description: Date and time when the processing occurred
 *                         example: "2023-07-15T14:30:45Z"
 *                       tags:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 5
 *                             name:
 *                               type: string
 *                               example: "Invoice"
 *                             color:
 *                               type: string
 *                               example: "#FF5733"
 *                       correspondent:
 *                         type: string
 *                         description: Document correspondent name
 *                         example: "Acme Corp"
 *                       link:
 *                         type: string
 *                         description: Link to the document in Paperless-ngx
 *                         example: "http://paperless.example.com/documents/123/"
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
 *                   example: "Error loading history data"
 */
router.get('/api/history', async (req, res) => {
  try {
    const username = req.user.username;
    const draw = parseInt(req.query.draw);
    const start = parseInt(req.query.start) || 0;
    const length = parseInt(req.query.length) || 10;
    const search = req.query.search?.value || '';
    const tagFilter = req.query.tag || '';
    const correspondentFilter = req.query.correspondent || '';

    // Get all documents
    const allDocs = await documentModel.getAllHistory(username);
    const allTags = await paperlessService.getTags();
    const tagMap = new Map(allTags.map(tag => [tag.id, tag]));

    // Format and filter documents
    let filteredDocs = allDocs.map(doc => {
      const tagIds = doc.tags === '[]' ? [] : JSON.parse(doc.tags || '[]');
      const resolvedTags = tagIds.map(id => tagMap.get(parseInt(id))).filter(Boolean);
      const baseURL = process.env.PAPERLESS_API_URL.replace(/\/api$/, '');

      resolvedTags.sort((a, b) => a.name.localeCompare(b.name));

      return {
        document_id: doc.document_id,
        title: doc.title || 'Modified: Invalid Date',
        created_at: doc.created_at,
        tags: resolvedTags,
        correspondent: doc.correspondent || 'Not assigned',
        link: `${baseURL}/documents/${doc.document_id}/`
      };
    }).filter(doc => {
      const matchesSearch = !search ||
        doc.title.toLowerCase().includes(search.toLowerCase()) ||
        doc.correspondent.toLowerCase().includes(search.toLowerCase()) ||
        doc.tags.some(tag => tag.name.toLowerCase().includes(search.toLowerCase()));

      const matchesTag = !tagFilter || doc.tags.some(tag => tag.id === parseInt(tagFilter));
      const matchesCorrespondent = !correspondentFilter || doc.correspondent === correspondentFilter;

      return matchesSearch && matchesTag && matchesCorrespondent;
    });

    // Sort documents if requested
    if (req.query.order) {
      const order = req.query.order[0];
      const column = req.query.columns[order.column].data;
      const dir = order.dir === 'asc' ? 1 : -1;

      filteredDocs.sort((a, b) => {
        if (a[column] == null) return 1;
        if (b[column] == null) return -1;
        if (column === 'created_at') {
          return dir * (new Date(a[column]) - new Date(b[column]));
        }
        if (column === 'document_id') {
          return dir * (a[column] - b[column]);
        }
        if (column === 'tags') {
          let min_len = (a[column].length < b[column].length)? a[column].length : b[column].length;
          for(let i=0; i < min_len; i+=1) {
            let cmp = a[column][i].name.localeCompare(b[column][i].name)
            if(cmp !== 0) return dir * cmp;
          }
          return dir * (a[column].length - b[column].length);
        }
        return dir * a[column].localeCompare(b[column]);
      });
    }

    res.json({
      draw: draw,
      recordsTotal: allDocs.length,
      recordsFiltered: filteredDocs.length,
      data: filteredDocs.slice(start, start + length)
    });
  } catch (error) {
    console.error('[ERROR] loading history data:', error);
    res.status(500).json({ error: 'Error loading history data' });
  }
});

router.post('/api/history/reanalyze/:id', async (req, res) => {
  const documentModel = require('../services/documentModel.js');
  const paperlessService = require('../services/paperlessService.js');
  const logger = require('../services/logger');
  const config = require('../config/config.js');
  const { DocumentProcessor } = require('../services/integration/DocumentProcessor');
  const ollamaService = require('../services/ollamaService.js');
  const path = require('path');
  const { pdfRenderer } = require('../services/visual-rag-client/PDFRenderer');
  const axios = require('axios');

  // Document queue for legacy mode
  let documentQueue = [];
  let isProcessing = false;

  /**
   * Prepare a Paperless document for the Expert Pipeline by:
   * 1. Downloading the PDF from Paperless-ngx
   * 2. Rendering it to images using PDFRenderer
   * 3. Fetching OCR text content
   * 4. Creating a document object with image_data for vision models
   *
   * @param {Object} document - Paperless document object
   * @param {number} documentId - Document ID
   * @returns {Promise<Object>} Prepared document with image_data
   */
  async function prepareDocumentForExpertPipeline(document, documentId) {
    logger.info(`[Reanalyze] Preparing document ${documentId} for Expert Pipeline`);

    const archiveFileName = document.archive_file_name || document.archive_filename || null;
    const originalFileName = document.original_file_name || `doc-${documentId}.pdf`;
    const relativePdfPath = archiveFileName
      ? path.posix.join('documents', 'archive', archiveFileName)
      : path.posix.join('documents', 'originals', originalFileName);
    const mediaRoot = process.env.PAPERLESS_MEDIA_ROOT || '/usr/src/paperless/media';
    const absolutePdfPath = path.posix.join(mediaRoot, relativePdfPath);

    // Start with base document properties
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

    // Step 1: Try to get OCR text from Paperless-ngx
    try {
      const ocrText = await paperlessService.getDocumentContent(documentId);
      if (ocrText && typeof ocrText === 'string' && ocrText.length > 0) {
        preparedDoc.ocr_text = ocrText;
        preparedDoc.content = ocrText;
        logger.debug(`[Reanalyze] Fetched OCR text for doc ${documentId}: ${ocrText.length} chars`);
      }
    } catch (ocrError) {
      logger.warn(`[Reanalyze] Could not fetch OCR text for doc ${documentId}: ${ocrError.message}`);
    }

    // Step 2: Download PDF and render to images for vision models
    const isPdf = document.mime_type === 'application/pdf' ||
                  (document.original_file_name && document.original_file_name.toLowerCase().endsWith('.pdf'));

    if (isPdf && pdfRenderer.isAvailable()) {
      try {
        // Download PDF from Paperless-ngx
        const apiUrl = config.paperless?.apiUrl || process.env.PAPERLESS_API_URL;
        const apiToken = config.paperless?.apiToken || process.env.PAPERLESS_API_TOKEN;

        logger.debug(`[Reanalyze] Downloading PDF for doc ${documentId}`);
        const pdfResponse = await axios.get(
          `${apiUrl}/documents/${documentId}/download/`,
          {
            headers: { 'Authorization': `Token ${apiToken}` },
            responseType: 'arraybuffer',
            timeout: 60000 // 60 second timeout for large PDFs
          }
        );
        const pdfBuffer = Buffer.from(pdfResponse.data);

        const renderDpi = Number.isFinite(config.visualRag?.visionRenderDpi)
          ? config.visualRag.visionRenderDpi
          : 300;
        const maxPages = Number.isFinite(config.visualRag?.maxVisionPages)
          ? config.visualRag.maxVisionPages
          : 4;

        // Render PDF to images (first few pages at configured DPI)
        logger.debug(`[Reanalyze] Rendering PDF to images for doc ${documentId}`);
        const images = await pdfRenderer.renderBuffer(pdfBuffer, {
          dpi: renderDpi,
          maxPages: maxPages,
          docId: documentId
        });

        if (images && images.length > 0) {
          // Wrap base64 in data URL format (ImagePreparator expects this)
          const imageFormat = images[0].format || 'png';
          preparedDoc.image_data = `data:image/${imageFormat};base64,${images[0].base64}`;
          preparedDoc.base64Images = images.map(img => `data:image/${img.format || 'png'};base64,${img.base64}`);

          logger.info(`[Reanalyze] Rendered ${images.length} pages for doc ${documentId}, first page: ${images[0].size} bytes`);
        }
      } catch (pdfError) {
        logger.warn(`[Reanalyze] Could not render PDF for doc ${documentId}: ${pdfError.message}`);
        // Continue without image data - pipeline will fall back to text-only processing
      }
    } else if (!isPdf) {
      logger.debug(`[Reanalyze] Document ${documentId} is not a PDF, skipping image rendering`);
    } else {
      logger.warn(`[Reanalyze] PDFRenderer not available, skipping image rendering for doc ${documentId}`);
    }

    logger.info(`[Reanalyze] Document ${documentId} prepared: hasImage=${!!preparedDoc.image_data}, hasOcr=${!!preparedDoc.ocr_text}`);

    return preparedDoc;
  }

  async function applyPipelineTagGovernance(documentId, updateData, analysis, originalTags) {
    // This is a placeholder - implement actual tag governance logic
    return { updateData };
  }

  async function processQueue(customPrompt) {
    // This is a placeholder for legacy queue processing
    logger.info('[Reanalyze] Legacy queue processing not implemented in history module');
  }

  try {
    const documentId = parseInt(req.params.id, 10);
    if (!Number.isInteger(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // Remove from processed list so it can be reprocessed
    await documentModel.deleteDocumentsIdList([documentId]);

    const document = await paperlessService.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if Expert Pipeline is enabled - use full DocumentProcessor if so
    const useExpertPipeline = config.expertPipelineEnabled === true || config.expertPipelineEnabled === 'yes';

    if (useExpertPipeline) {
      // Use DocumentProcessor with Expert Pipeline + Visual RAG
      logger.info(`[Reanalyze] Using Expert Pipeline for document ${documentId}`);

      // Process asynchronously with full pipeline
      (async () => {
        try {
          // Step 1: Prepare document with image data for vision router
          const preparedDocument = await prepareDocumentForExpertPipeline(document, documentId);

          const processor = new DocumentProcessor(ollamaService, {
            mode: 'hybrid', // Uses expert pipeline with legacy fallback
            enableVisualRAG: true
          });

          const result = await processor.process(preparedDocument, {
            mode: 'expert_pipeline',
            triggerVisualIngestion: true
          });

            if (result.success && result.paperless) {
              // Apply the results to Paperless-ngx
              const governanceResult = await applyPipelineTagGovernance(
                documentId,
                result.paperless,
                result.result,
                document.tags
              );
            await paperlessService.updateDocument(documentId, governanceResult.updateData);
            await documentModel.setProcessingStatus(documentId, document.title, 'complete');
            logger.info(`[Reanalyze] Expert Pipeline completed for document ${documentId}`, {
              pipelineId: result.metadata?.pipelineId,
              confidence: result.metadata?.confidence
            });
          } else {
            logger.error(`[Reanalyze] Expert Pipeline failed for document ${documentId}:`, result.error);
            await documentModel.setProcessingStatus(documentId, document.title, 'error');
          }
        } catch (pipelineError) {
          logger.error(`[Reanalyze] Expert Pipeline error for document ${documentId}:`, pipelineError);
          await documentModel.setProcessingStatus(documentId, document.title, 'error');
        }
      })();

      return res.status(202).json({
        message: 'Document queued for re-analysis with Expert Pipeline + Visual RAG',
        documentId,
        pipeline: 'expert'
      });
    } else {
      // Fall back to legacy queue-based processing
      documentQueue.push(document);
      processQueue().catch((error) => {
        console.error('[ERROR] Re-analysis queue failed:', error);
      });

      return res.status(202).json({
        message: 'Document queued for re-analysis (legacy mode)',
        documentId,
        queuePosition: documentQueue.length,
        pipeline: 'legacy'
      });
    }
  } catch (error) {
    console.error('[ERROR] re-analysing document:', error);
    return res.status(500).json({ error: 'Failed to queue document' });
  }
});

module.exports = router;
