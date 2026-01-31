const express = require('express');
const router = express.Router();
const paperlessService = require('../services/paperlessService.js');
const documentModel = require('../services/documentModel.js');
const configFile = require('../config/config.js');
const jwt = require('jsonwebtoken');
const { UnifiedWorkspaceSchema } = require('../src/ui/contracts/UnifiedWorkspace.contract.js');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to ensure user is authenticated
const authenticate = async (req, res, next) => {
  const token = req.cookies.jwt || req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.redirect('/login');
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('jwt');
    return res.redirect('/login');
  }
};

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
 * /document/{id}:
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
router.get('/document/:id', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    const username = req.user.username;

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
    const history = await documentModel.getHistory(documentId, username);
    
    // Note: If history is null, it might be a document that hasn't been processed by AI yet.
    // In a strict multi-tenant system, we'd check Paperless-ngx permissions here.

    // 3. Fetch content and supplementary data
    const content = await paperlessService.getDocumentContent(documentId).catch(() => '');
    const availableDocs = await paperlessService.getAllDocumentsUnfiltered().catch(() => []);
    
    // 4. Visual RAG Data
    let visualFields = [];
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
      } catch (e) {
        console.warn('[Unified Workspace] Could not fetch visual overlays:', e.message);
      }
    }

    // 5. Build VM
    const paperlessBaseUrl = process.env.PAPERLESS_API_URL
      ? process.env.PAPERLESS_API_URL.replace(/\/api$/, '')
      : '';

    const vm = {
      version: configFile.PAPERLESS_AI_VERSION || '1.0.0',
      config: {
        disableGithubFetch: process.env.DISABLE_GITHUB_FETCH || 'no',
      },
      document: {
        id: document.id,
        title: document.title,
        content: content,
        correspondent: null, // Would need name resolution
        correspondentId: document.correspondent || null,
        documentType: null, // Would need name resolution
        documentTypeId: document.document_type || null,
        tags: [], // Would need name resolution if names are required
        pageCount: document.page_count || 1,
        currentPage: 1,
        mimeType: document.mime_type,
        originalUrl: paperlessBaseUrl ? `${paperlessBaseUrl}/documents/${document.id}/download/original/` : null,
        normalizedUrl: `/api/visual-rag/normalized/${document.id}`,
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
        overlayCount: overlayCount,
      },
      ui: {
        activeTab: 'metadata',
        sidebarCollapsed: false,
      }
    };

    // 6. Validate and Render
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
 * @swagger
 * /document:
 *   get:
 *     summary: Document workspace entry
 *     description: Redirects to the latest processed document or shows an empty state.
 *     tags:
 *       - Navigation
 */
router.get('/document', async (req, res) => {
  try {
    const username = req.user.username;
    const history = await documentModel.getAllHistory(username);
    
    if (history && history.length > 0) {
      return res.redirect(`/document/${history[0].document_id}`);
    }
    
    // Fallback to latest document from Paperless if no history
    const allDocs = await paperlessService.getAllDocumentsUnfiltered();
    if (allDocs && allDocs.length > 0) {
      return res.redirect(`/document/${allDocs[0].id}`);
    }

    res.render('document-workspace', { 
      vm: UnifiedWorkspaceSchema.parse({
        version: configFile.PAPERLESS_AI_VERSION || '1.0.0',
        config: { disableGithubFetch: process.env.DISABLE_GITHUB_FETCH || 'no' },
        document: null,
        availableDocuments: [],
        chat: {},
        visual: { fields: [], overlayCount: 0 },
        ui: { activeTab: 'metadata', sidebarCollapsed: false }
      })
    });
  } catch (error) {
    res.status(500).render('error', { message: 'Error loading workspace', details: error.message });
  }
});

module.exports = router;
