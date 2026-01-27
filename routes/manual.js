const express = require('express');
const router = express.Router();
const paperlessService = require('../services/paperlessService.js');
const configFile = require('../config/config.js');

// Visual RAG integration for overlay/field retrieval
let visualOverlayRepository = null;
try {
    const visualRagClient = require('../services/visual-rag-client');
    visualOverlayRepository = visualRagClient.visualOverlayRepository;
} catch (e) {
    console.warn('[Manual Route] Visual RAG client not available:', e.message);
}

const DOC_TYPE_CACHE_TTL_MS = 5 * 60 * 1000;
let docTypeCache = {
    fetchedAt: 0,
    byId: new Map(),
};

async function getDocumentTypeName(documentTypeId) {
    if (!documentTypeId) return '';

    const now = Date.now();
    const cacheFresh = now - docTypeCache.fetchedAt < DOC_TYPE_CACHE_TTL_MS;

    if (!cacheFresh) {
        try {
            const docTypes = await paperlessService.listDocumentTypesNames();
            const byId = new Map();
            docTypes.forEach((entry) => {
                if (entry && entry.id) {
                    byId.set(entry.id, entry.name || String(entry.id));
                }
            });
            docTypeCache = { fetchedAt: now, byId };
        } catch (error) {
            console.warn('Could not refresh document types:', error.message);
            docTypeCache.fetchedAt = now;
        }
    }

    return docTypeCache.byId.get(documentTypeId) || String(documentTypeId);
}

/**
 * @swagger
 * /manual/preview/{id}:
 *   get:
 *     summary: Document preview
 *     description: |
 *       Fetches and returns the content of a specific document from Paperless-ngx
 *       for preview in the manual document review interface.
 *
 *       This endpoint retrieves document details including content, title, ID, and tags,
 *       allowing users to view the document text before applying changes or processing
 *       it with AI tools. The document content is retrieved directly from Paperless-ngx
 *       using the system's configured API credentials.
 *     tags:
 *       - Documents
 *       - API
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The document ID from Paperless-ngx
 *         example: 123
 *     responses:
 *       200:
 *         description: Document content retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: string
 *                   description: The document content
 *                   example: "Invoice from ACME Corp. Amount: $1,234.56"
 *                 title:
 *                   type: string
 *                   description: The document title
 *                   example: "ACME Corp Invoice #12345"
 *                 id:
 *                   type: integer
 *                   description: The document ID
 *                   example: 123
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Array of tag names assigned to the document
 *                   example: ["Invoice", "ACME Corp", "2023"]
 *       401:
 *         description: Unauthorized - user not authenticated
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: "/login"
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error or Paperless connection error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/manual/preview/:id', async (req, res) => {
  try {
    const documentId = req.params.id;
    console.log('Fetching content for document:', documentId);

    const response = await fetch(
      `${process.env.PAPERLESS_API_URL}/documents/${documentId}/`,
      {
        headers: {
          'Authorization': `Token ${process.env.PAPERLESS_API_TOKEN}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch document content: ${response.status} ${response.statusText}`);
    }

    const document = await response.json();

    // Map tags to their names
    document.tags = await Promise.all(document.tags.map(async tag => {
      const tagName = await paperlessService.getTagTextFromId(tag);
      return tagName;
    }));

    // Get correspondent name if available
    let correspondentName = null;
    if (document.correspondent) {
      try {
        correspondentName = await paperlessService.getCorrespondentName(document.correspondent);
      } catch (e) {
        console.warn('Could not fetch correspondent name:', e.message);
      }
    }

    let documentTypeName = '';
    if (document.document_type) {
      try {
        documentTypeName = await getDocumentTypeName(document.document_type);
      } catch (e) {
        console.warn('Could not fetch document type name:', e.message);
        documentTypeName = String(document.document_type);
      }
    }

    // Fetch visual-rag overlays/fields if available
    let overlays = [];
    let fields = [];
    if (visualOverlayRepository) {
      try {
        overlays = await visualOverlayRepository.getByDocId(documentId);
        // Transform overlays to field format for ManualEditorIsland
        fields = overlays.map(o => {
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
        console.warn('Could not fetch visual overlays:', e.message);
      }
    }

    // Get custom fields from Paperless if available
    const customFields = document.custom_fields || [];

    console.log('Document Data:', { id: document.id, overlaysCount: overlays.length, fieldsCount: fields.length });

    const paperlessBaseUrl = process.env.PAPERLESS_API_URL
      ? process.env.PAPERLESS_API_URL.replace(/\/api$/, '')
      : '';
    const normalizedOriginalUrl = `/api/visual-rag/normalized/${document.id}`;

    res.json({
      content: document.content,
      title: document.title,
      id: document.id,
      tags: document.tags,
      correspondent: correspondentName,
      correspondentId: document.correspondent,
      documentType: documentTypeName,
      documentTypeId: document.document_type || null,
      pageCount: document.page_count || 1,
      mimeType: document.mime_type,
      customFields: customFields,
      visualFields: fields,
      overlayCount: overlays.length,
      normalized_original_url: normalizedOriginalUrl,
      original_url: paperlessBaseUrl
        ? `${paperlessBaseUrl}/documents/${document.id}/download/original/`
        : null,
    });
  } catch (error) {
    console.error('Content fetch error:', error);
    res.status(500).json({ error: `Error fetching document content: ${error.message}` });
  }
});

/**
 * @swagger
 * /manual:
 *   get:
 *     summary: Document review page
 *     description: |
 *       Renders the manual document review page that allows users to browse,
 *       view and manually process documents from Paperless-ngx.
 *
 *       This interface enables users to review documents, view their content, and
 *       manage tags, correspondents, and document metadata without AI assistance.
 *       Users can apply manual changes to documents based on their own judgment,
 *       which is particularly useful for correction or verification of AI-processed documents.
 *     tags:
 *       - Navigation
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Manual document review page rendered successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML content of the manual document review interface
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
router.get('/manual', async (req, res) => {
  const version = configFile.PAPERLESS_AI_VERSION || ' ';
  const vm = {
    version,
    config: {
      disableGithubFetch: process.env.DISABLE_GITHUB_FETCH || 'no',
    },
    manual: {
      documentId: null,
      metadata: {},
      content: '',
      fields: [],
      originalUrl: null,
      pageCount: null,
      tags: [],
    },
  };

  res.render('manual', { vm });
});

/**
 * @swagger
 * /manual/tags:
 *   get:
 *     summary: Get all tags
 *     description: |
 *       Retrieves all tags from Paperless-ngx for use in the manual document review interface.
 *
 *       This endpoint returns a complete list of all available tags that can be applied to documents,
 *       including their IDs, names, and colors. The tags are retrieved directly from Paperless-ngx
 *       and used for tag selection in the UI when manually updating document metadata.
 *     tags:
 *       - Documents
 *       - API
 *       - Metadata
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Tags retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tag'
 *       401:
 *         description: Unauthorized - user not authenticated
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: "/login"
 *       500:
 *         description: Server error or Paperless connection error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/manual/tags', async (req, res) => {
  const getTags = await paperlessService.getTags();
  res.json(getTags);
});

/**
 * @swagger
 * /manual/documents:
 *   get:
 *     summary: Get all documents
 *     description: |
 *       Retrieves all documents from Paperless-ngx for display in the manual document review interface.
 *
 *       This endpoint returns a list of all available documents that can be manually reviewed,
 *       including their basic metadata such as ID, title, and creation date. The documents are
 *       retrieved directly from Paperless-ngx and presented in the UI for selection and processing.
 *     tags:
 *       - Documents
 *       - API
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Document'
 *       401:
 *         description: Unauthorized - user not authenticated
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: "/login"
 *       500:
 *         description: Server error or Paperless connection error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/manual/documents', async (req, res) => {
  // Use unfiltered documents for UI dropdown - tag filtering is only for automatic processing
  const getDocuments = await paperlessService.getAllDocumentsUnfiltered();
  res.json(getDocuments);
});

module.exports = router;
