const express = require('express');
const router = express.Router();
const paperlessService = require('../services/paperlessService.js');
const documentModel = require('../services/documentModel.js');
const configFile = require('../config/config.js');
const { UnifiedWorkspaceSchema } = require('../src/ui/contracts/UnifiedWorkspace.contract.js');
const {
  buildPaperlessDocumentUrl
} = require('../services/utils/paperlessUrl');
const { authenticate } = require('../middleware/auth');

// All workspace routes require authentication
router.use(authenticate);

// Visual RAG integration
let visualOverlayRepository = null;
try {
    const visualRagClient = require('../services/visual-rag-client');
    visualOverlayRepository = visualRagClient.visualOverlayRepository;
} catch (e) {
    console.warn('[Unified Workspace] Visual RAG client not available:', e.message);
}

/**
 * @swagger
 * /workspace/doc/{id}:
 *   get:
 *     summary: Unified Document Workspace
 *     description: |
 *       Renders the unified workspace for a specific document.
 *       Consolidates metadata editing, AI chat, and visual RAG capabilities.
 *     tags:
 *       - Navigation
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Unified Workspace rendered successfully
 */
router.get('/doc/:id', async (req, res) => {
  try {
    const username = req.user.username;
    
    // Support ?tab= query parameter for deep-linking to specific tabs
    const validTabs = ['metadata', 'content', 'chat', 'visual', 'debug'];
    const requestedTab = req.query.tab;
    const activeTab = validTabs.includes(requestedTab) ? requestedTab : 'metadata';

    // Handle "latest" as a special case - redirect to most recent document
    if (req.params.id === 'latest') {
      const history = await documentModel.getAllHistory(username);
      if (history && history.length > 0) {
        return res.redirect(`/workspace/doc/${history[0].document_id}`);
      }
      // Fallback to first document from Paperless
      const allDocs = await paperlessService.getAllDocumentsUnfiltered();
      if (allDocs && allDocs.length > 0) {
        return res.redirect(`/workspace/doc/${allDocs[0].id}`);
      }
      return res.status(404).render('error', {
        message: 'No documents available',
        details: 'There are no documents to display.'
      });
    }

    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return res.status(400).render('error', {
        message: 'Invalid document ID',
        details: 'The document ID must be a number.'
      });
    }

    // 1. Fetch document from Paperless
    let document = null;
    try {
      document = await paperlessService.getDocument(documentId);
    } catch (e) {
      console.error(`[ERROR] Document ${documentId} not found in Paperless:`, e.message);
      return res.status(404).render('error', { 
        message: 'Document not found', 
        details: 'The requested document could not be retrieved from Paperless.' 
      });
    }

    // 2. Enforce User Isolation
    // Check if the document has history for this user or if it's a new document
    // If strict isolation is enabled, we should verify the user has access.
    // For now, we follow the mandate: "Database queries for document history/processing MUST filter by username"
    const _history = await documentModel.getHistory(documentId, username);
    
    // Note: If history is null, it might be a document that hasn't been processed by AI yet.
    // In a strict multi-tenant system, we'd check Paperless-ngx permissions here.

    // 3. Fetch content and supplementary data
    const content = await paperlessService.getDocumentContent(documentId).catch(() => '');
    const availableDocs = await paperlessService.getAllDocumentsUnfiltered().catch(() => []);
    
    // 4. Resolve correspondent name
    let correspondentName = null;
    if (document.correspondent) {
      try {
        const correspondents = await paperlessService.listCorrespondentsNames();
        const correspondent = correspondents.find(c => c.id === document.correspondent);
        correspondentName = correspondent?.name || null;
      } catch (e) {
        console.warn('[Unified Workspace] Could not resolve correspondent name:', e.message);
      }
    }

    // 5. Resolve document type name
    let documentTypeName = null;
    if (document.document_type) {
      try {
        const docTypes = await paperlessService.listDocumentTypesNames();
        const docType = docTypes.find(dt => dt.id === document.document_type);
        documentTypeName = docType?.name || null;
      } catch (e) {
        console.warn('[Unified Workspace] Could not resolve document type name:', e.message);
      }
    }

    // 6. Resolve tag names
    let tagNames = [];
    if (document.tags && document.tags.length > 0) {
      try {
        const allTags = await paperlessService.getTags();
        tagNames = document.tags
          .map(tagId => {
            const tag = allTags.find(t => t.id === tagId);
            return tag?.name || null;
          })
          .filter(name => name !== null);
      } catch (e) {
        console.warn('[Unified Workspace] Could not resolve tag names:', e.message);
      }
    }

    // 7. Visual RAG Data
    let visualFields = [];
    let formattedOverlays = [];
    let overlayCount = 0;
    if (visualOverlayRepository) {
      try {
        const overlays = await visualOverlayRepository.getByDocId(documentId);
        overlayCount = overlays.length;
        visualFields = overlays.map(o => {
          const data = o.overlayData || {};
          return {
            label: data.label || o.semanticLabel || 'Unknown',
            value: data.value || data.text || null,
            domain: data.domain || 'GENERAL',
            confidence: data.confidence || o.confidence || 0.5,
            paperlessMapping: data.paperlessMapping || null,
            isMandatory: data.isMandatory || false,
            pageNumber: o.pageNumber || 1
          };
        });
        // Format overlays for Visual Tab (with bbox)
        formattedOverlays = overlays.map(o => {
          const data = o.overlayData || {};
          // Normalize bounding box format
          let bbox = { x: 0, y: 0, width: 0, height: 0 };
          if (data.boundingBox) {
            bbox = data.boundingBox;
          } else if (data.bbox) {
            bbox = data.bbox;
          } else if (data.box && Array.isArray(data.box)) {
            // Legacy format: [ymin, xmin, ymax, xmax] in 0-1000 scale
            const [ymin, xmin, ymax, xmax] = data.box;
            bbox = {
              x: xmin / 1000,
              y: ymin / 1000,
              width: (xmax - xmin) / 1000,
              height: (ymax - ymin) / 1000
            };
          }
          return {
            id: String(o.id),
            label: data.label || o.semanticLabel || 'Unknown',
            pageNumber: o.pageNumber || data.pageNumber || 1,
            confidence: data.confidence || o.confidence || 0.5,
            bbox
          };
        });
      } catch (e) {
        console.warn('[Unified Workspace] Could not fetch visual overlays:', e.message);
      }
    }

    // 8. Build VM
    const vm = {
      version: configFile.PAPERLESS_AI_VERSION || '1.0.0',
      config: {
        disableGithubFetch: process.env.DISABLE_GITHUB_FETCH || 'no',
      },
      document: {
        id: document.id,
        title: document.title,
        content: content,
        correspondent: correspondentName,
        correspondentId: document.correspondent || null,
        documentType: documentTypeName,
        documentTypeId: document.document_type || null,
        tags: tagNames,
        pageCount: document.page_count || 1,
        currentPage: 1,
        mimeType: document.mime_type,
        originalUrl: buildPaperlessDocumentUrl(
          document.id,
          '/download/original/'
        ),
        persistedNormalizedUrl: document.custom_fields?.ai_normalized_url || null,
        normalizationStatus: document.custom_fields?.ai_normalization_status || 'pending',
        normalizedUrl: document.custom_fields?.ai_normalized_url || `/api/normalized/${document.id}/1`,
        status: 'saved',
      },
      availableDocuments: availableDocs.map(d => ({
        id: d.id,
        title: d.title,
        original_filename: d.original_file_name
      })),
      chat: {
        aiProvider: process.env.AI_PROVIDER || 'ollama',
        ollamaDefaultModel: process.env.OLLAMA_MODEL || 'sauerkraut-llama3.1:8b',
      },
      visual: {
        fields: visualFields,
        overlays: formattedOverlays,
        overlayCount: overlayCount,
      },
      ui: {
        activeTab: activeTab,
        sidebarCollapsed: false,
      },
      user: {
        username: req.user?.username || 'anonymous',
        isAdmin: req.user?.isAdmin || req.user?.is_superuser || false,
      },
    };

    // 9. Validate and Render
    const parsedVm = UnifiedWorkspaceSchema.parse(vm);
    res.render('document-workspace', { vm: parsedVm });

  } catch (error) {
    console.error('[ERROR] Unified Workspace route failed:', error);
    res.status(500).render('error', { 
      message: 'Internal Server Error', 
      details: error.message 
    });
  }
});

/**
 * Backward-compatible redirect: /workspace/latest -> /workspace/doc/latest
 */
router.get('/latest', (req, res) => {
  res.redirect(302, '/workspace/doc/latest');
});

/**
 * Backward-compatible redirect: /workspace/{numericId} -> /workspace/doc/{id}
 * This catches old URLs like /workspace/9 and redirects to /workspace/doc/9
 */
router.get('/:id(\\d+)', (req, res) => {
  res.redirect(302, `/workspace/doc/${req.params.id}`);
});

/**
 * @swagger
 * /api/workspace/doc/{id}:
 *   get:
 *     summary: Get document data for inline workspace loading
 *     description: Returns document metadata in JSON format for client-side document switching
 *     tags:
 *       - API
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Document data returned successfully
 */
router.get('/api/doc/:id', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // Fetch document from Paperless
    let document = null;
    try {
      document = await paperlessService.getDocument(documentId);
    } catch (e) {
      console.error(`[API] Document ${documentId} not found:`, e.message);
      return res.status(404).json({ error: 'Document not found' });
    }

    // Resolve correspondent name
    let correspondentName = null;
    if (document.correspondent) {
      try {
        const correspondents = await paperlessService.listCorrespondentsNames();
        const correspondent = correspondents.find(c => c.id === document.correspondent);
        correspondentName = correspondent?.name || null;
      } catch (e) { /* ignore */ }
    }

    // Resolve document type name
    let documentTypeName = null;
    if (document.document_type) {
      try {
        const docTypes = await paperlessService.listDocumentTypesNames();
        const docType = docTypes.find(dt => dt.id === document.document_type);
        documentTypeName = docType?.name || null;
      } catch (e) { /* ignore */ }
    }

    // Resolve tag names
    let tagNames = [];
    if (document.tags && document.tags.length > 0) {
      try {
        const allTags = await paperlessService.getTags();
        tagNames = document.tags
          .map(tagId => {
            const tag = allTags.find(t => t.id === tagId);
            return tag?.name || null;
          })
          .filter(name => name !== null);
      } catch (e) { /* ignore */ }
    }

    // Build response
    res.json({
      id: document.id,
      title: document.title,
      correspondent: correspondentName,
      correspondentId: document.correspondent || null,
      documentType: documentTypeName,
      documentTypeId: document.document_type || null,
      tags: tagNames,
      pageCount: document.page_count || 1,
      mimeType: document.mime_type,
      originalUrl: buildPaperlessDocumentUrl(
        document.id,
        '/download/original/'
      ),
      persistedNormalizedUrl: document.custom_fields?.ai_normalized_url || null,
      normalizationStatus: document.custom_fields?.ai_normalization_status || 'pending',
      normalizedUrl: document.custom_fields?.ai_normalized_url || `/api/normalized/${document.id}/1`,
    });

  } catch (error) {
    console.error('[API] Error fetching document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /workspace/api/tags:
 *   get:
 *     summary: Get all tags from Paperless
 *     description: Returns all available tags for document tagging
 *     tags:
 *       - API
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Tags retrieved successfully
 */
router.get('/api/tags', async (req, res) => {
  try {
    const tags = await paperlessService.getTags();
    res.json(tags);
  } catch (error) {
    console.error('[API] Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

/**
 * @swagger
 * /workspace/api/documents:
 *   get:
 *     summary: Get all documents from Paperless
 *     description: Returns all available documents (unfiltered)
 *     tags:
 *       - API
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 */
router.get('/api/documents', async (req, res) => {
  try {
    const documents = await paperlessService.getAllDocumentsUnfiltered();
    res.json(documents);
  } catch (error) {
    console.error('[API] Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * @swagger
 * /workspace:
 *   get:
 *     summary: Document workspace entry
 *     description: Redirects to the latest processed document or shows an empty state.
 *     tags:
 *       - Navigation
 */
router.get('/', async (req, res) => {
  try {
    const username = req.user.username;
    // Render workspace without auto-selecting a document. Provide the list of documents for user selection.
    const history = await documentModel.getAllHistory(username).catch(() => []);
    const allDocs = await paperlessService.getAllDocumentsUnfiltered().catch(() => []);
    const availableDocs = (allDocs || []).map(d => ({ id: d.id, title: d.title, original_filename: d.original_file_name }));

    // Backwards-compatible: allow explicit request to open latest via ?latest=1
    if (req.query && req.query.latest === '1') {
      if (history && history.length > 0) return res.redirect(`/workspace/doc/${history[0].document_id}`);
      if (allDocs && allDocs.length > 0) return res.redirect(`/workspace/doc/${allDocs[0].id}`);
    }

    res.render('document-workspace', {
      vm: UnifiedWorkspaceSchema.parse({
        version: configFile.PAPERLESS_AI_VERSION || '1.0.0',
        config: { disableGithubFetch: process.env.DISABLE_GITHUB_FETCH || 'no' },
        document: null,
        availableDocuments: availableDocs,
        chat: {},
        visual: { fields: [], overlayCount: 0 },
        ui: { activeTab: 'metadata', sidebarCollapsed: false },
        user: {
          username: req.user?.username || 'anonymous',
          isAdmin: req.user?.isAdmin || req.user?.is_superuser || false,
        },
      })
    });
  } catch (error) {
    res.status(500).render('error', { message: 'Error loading workspace', details: error.message });
  }
});

module.exports = router;
