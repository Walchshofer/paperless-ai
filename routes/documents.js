const express = require('express');
const router = express.Router();
const paperlessService = require('../services/paperlessService.js');
const { pdfRenderer } = require('../services/visual-rag-client/PDFRenderer');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../services/logger');
const { authenticateApi, requireViewer, requireUser } = require('../middleware/auth');

// All document routes require authentication
router.use(authenticateApi);

/**
 * @swagger
 * /sampleData/{id}:
 *   get:
 *     summary: Get sample data for a document
 *     description: |
 *       Retrieves sample data extracted from a document, including processed text content
 *       and any metadata that has been extracted or processed by the AI.
 *
 *       This endpoint is commonly used for previewing document data in the UI before
 *       completing document processing or updating metadata.
 *     tags:
 *       - Documents
 *       - API
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID to retrieve sample data for
 *         example: 123
 *     responses:
 *       200:
 *         description: Document sample data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: string
 *                   description: Extracted text content from the document
 *                   example: "Invoice from Acme Corp. Total amount: $125.00, Due date: 2023-08-15"
 *                 metadata:
 *                   type: object
 *                   description: Any metadata that has been extracted from the document
 *                   properties:
 *                     title:
 *                       type: string
 *                       example: "Acme Corp Invoice - August 2023"
 *                     tags:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Invoice", "Finance"]
 *                     correspondent:
 *                       type: string
 *                       example: "Acme Corp"
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Document not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/sampleData/:id', requireViewer, async (req, res) => {
  try {
    //get all correspondents from one document by id
    const document = await paperlessService.getDocument(req.params.id);
    const correspondents = await paperlessService.getCorrespondentsFromDocument(document.id);

    res.json({
      document,
      correspondents
    });

  } catch (error) {
    console.error('[ERRO] loading sample data:', error);
    res.status(500).json({ error: 'Error loading sample data' });
  }
});

/**
 * @swagger
 * /thumb/{documentId}:
 *   get:
 *     summary: Get document thumbnail
 *     description: |
 *       Retrieves the thumbnail image for a specific document from the Paperless-ngx system.
 *       This endpoint proxies the request to the Paperless-ngx API and returns the thumbnail
 *       image for display in the UI.
 *
 *       The thumbnail is returned as an image file in the format provided by Paperless-ngx,
 *       typically JPEG or PNG.
 *     tags:
 *       - Documents
 *       - API
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the document to retrieve thumbnail for
 *         example: 123
 *     responses:
 *       200:
 *         description: Thumbnail retrieved successfully
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Document or thumbnail not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Thumbnail not found"
 *       500:
 *         description: Server error or Paperless-ngx connection failure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/thumb/:documentId', requireViewer, async (req, res) => {
  const cachePath = path.join('./public/images', `${req.params.documentId}.png`);

  try {
    // Prüfe ob das Bild bereits im Cache existiert
    try {
      await fs.access(cachePath);
      console.log('Serving cached thumbnail');

      // Wenn ja, sende direkt das gecachte Bild
      res.setHeader('Content-Type', 'image/png');
      return res.sendFile(path.resolve(cachePath));

    } catch {
      // File existiert nicht im Cache, hole es von Paperless
      console.log('Thumbnail not cached, fetching from Paperless');

      const thumbnailData = await paperlessService.getThumbnailImage(req.params.documentId);

      if (!thumbnailData) {
        return res.status(404).send('Thumbnail nicht gefunden');
      }

      // Speichere im Cache
      await fs.mkdir(path.dirname(cachePath), { recursive: true }); // Erstelle Verzeichnis falls nicht existiert
      await fs.writeFile(cachePath, thumbnailData);

      // Sende das Bild
      res.setHeader('Content-Type', 'image/png');
      res.send(thumbnailData);
    }

  } catch (error) {
    console.error('Fehler beim Abrufen des Thumbnails:', error);
    res.status(500).send('Fehler beim Laden des Thumbnails');
  }
});

/**
 * @swagger
 * /api/document/{docId}/render:
 *   get:
 *     summary: Render document page at high resolution
 *     description: Downloads PDF from Paperless-ngx and renders a specific page at the requested DPI (default 300)
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The document ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number to render (1-indexed)
 *       - in: query
 *         name: dpi
 *         schema:
 *           type: integer
 *           default: 300
 *         description: DPI resolution for rendering
 *     responses:
 *       200:
 *         description: Rendered page image
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 image:
 *                   type: string
 *                   description: Base64-encoded PNG image
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 width:
 *                   type: integer
 *                 height:
 *                   type: integer
 *                 dpi:
 *                   type: integer
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.get('/api/document/:docId/render', requireUser, async (req, res) => {
  const docId = parseInt(req.params.docId, 10);
  const page = parseInt(req.query.page || '1', 10);
  const dpi = parseInt(req.query.dpi || '300', 10);

  try {
    // Download PDF from Paperless-ngx
    const pdfBuffer = await paperlessService.downloadDocument(docId);
    if (!pdfBuffer) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Render the specific page
    const images = await pdfRenderer.renderBuffer(pdfBuffer, {
      dpi,
      docId,
      maxPages: page // Render up to the requested page
    });

    if (!images || images.length < page) {
      return res.status(404).json({ success: false, error: `Page ${page} not found` });
    }

    const pageImage = images[page - 1];

    res.json({
      success: true,
      image: pageImage.base64,
      page,
      totalPages: images.length,
      width: pageImage.width || 0,
      height: pageImage.height || 0,
      dpi
    });

  } catch (error) {
    logger.error('Error rendering document %s page %s: %s', docId, page, error.message);
    res.status(500).json({ success: false, error: 'Failed to render document' });
  }
});

/**
 * @swagger
 * /api/document/{docId}/page-count:
 *   get:
 *     summary: Get document page count
 *     description: Returns the number of pages in a PDF document without full rendering
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The document ID
 *     responses:
 *       200:
 *         description: Page count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 docId:
 *                   type: integer
 *                 pageCount:
 *                   type: integer
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.get('/api/document/:docId/page-count', requireUser, async (req, res) => {
  const docId = parseInt(req.params.docId, 10);

  try {
    // Download PDF from Paperless-ngx
    const pdfBuffer = await paperlessService.downloadDocument(docId);
    if (!pdfBuffer) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Use pdf-lib to get page count without full rendering
    const { PDFDocument } = require('pdf-lib');
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    res.json({
      docId,
      pageCount
    });

  } catch (error) {
    logger.error('Error getting page count for document %s: %s', docId, error.message);
    res.status(500).json({ success: false, error: 'Failed to get page count' });
  }
});

module.exports = router;
