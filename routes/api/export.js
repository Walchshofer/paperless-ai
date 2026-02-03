const express = require('express');
const router = express.Router();
const { authenticateApi } = require('../../middleware/auth');
const PDFDocument = require('pdfkit');

/**
 * @swagger
 * /api/export/region:
 *   post:
 *     summary: Export a visual region as PNG or PDF
 *     tags: [Export]
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
 *               - imageBase64
 *               - format
 *             properties:
 *               imageBase64:
 *                 type: string
 *                 description: Base64-encoded image data with data URI prefix
 *               format:
 *                 type: string
 *                 enum: [png, pdf]
 *               documentId:
 *                 type: number
 *               metadata:
 *                 type: object
 *                 properties:
 *                   pageNumber:
 *                     type: number
 *                   bbox:
 *                     type: object
 *     responses:
 *       200:
 *         description: Binary file download
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Export failed
 */
router.post('/region', authenticateApi, async (req, res) => {
  try {
    const { imageBase64, format, documentId, metadata } = req.body;

    // Validation
    if (!imageBase64 || !imageBase64.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid image data - must be base64 with data URI prefix' });
    }
    if (!['png', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format - must be png or pdf' });
    }

    // Extract base64 data
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Size check (10MB limit)
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large - maximum 10MB' });
    }

    const timestamp = Date.now();
    const docIdStr = documentId ? `doc${documentId}` : 'export';

    if (format === 'png') {
      // Direct PNG response
      const filename = `region-${docIdStr}-${timestamp}.png`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'image/png');
      return res.send(buffer);
    }

    if (format === 'pdf') {
      // Embed PNG in PDF
      const filename = `region-${docIdStr}-${timestamp}.pdf`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/pdf');

      const doc = new PDFDocument({ autoFirstPage: false });
      doc.pipe(res);

      try {
        // Get image dimensions from buffer
        const image = doc.openImage(buffer);
        doc.addPage({ size: [image.width, image.height] });
        doc.image(buffer, 0, 0);

        // Add metadata footer if provided
        if (metadata?.pageNumber) {
          doc.fontSize(8).fillColor('#666')
            .text(`Page ${metadata.pageNumber}`, 10, image.height - 20);
        }
      } catch (imageError) {
        console.error('[Export] PDF image processing failed:', imageError);
        return res.status(400).json({ error: 'Invalid image format for PDF conversion' });
      }

      doc.end();
    }
  } catch (error) {
    console.error('[Export] Region export failed:', error);
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

/**
 * @swagger
 * /api/export/text:
 *   post:
 *     summary: Export text content as TXT or PDF
 *     tags: [Export]
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
 *               - text
 *               - format
 *             properties:
 *               text:
 *                 type: string
 *               format:
 *                 type: string
 *                 enum: [txt, pdf]
 *               metadata:
 *                 type: object
 *                 properties:
 *                   documentId:
 *                     type: number
 *                   title:
 *                     type: string
 *                   source:
 *                     type: string
 *     responses:
 *       200:
 *         description: Binary file download
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/text', authenticateApi, async (req, res) => {
  try {
    const { text, format, metadata } = req.body;

    // Validation
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Invalid text content' });
    }
    if (text.length > 1024 * 1024) {
      return res.status(400).json({ error: 'Text too large - maximum 1MB' });
    }
    if (!['txt', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format - must be txt or pdf' });
    }

    const timestamp = Date.now();
    const filename = `text-export-${timestamp}.${format}`;

    if (format === 'txt') {
      // Plain text export with optional metadata header
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');

      let output = '';
      if (metadata) {
        output += '--- Document Export ---\n';
        if (metadata.title) output += `Title: ${metadata.title}\n`;
        if (metadata.documentId) output += `Document ID: ${metadata.documentId}\n`;
        if (metadata.source) output += `Source: ${metadata.source}\n`;
        output += `Exported: ${new Date().toISOString()}\n`;
        output += '---\n\n';
      }
      output += text;

      return res.send(output);
    }

    if (format === 'pdf') {
      // PDF text export with metadata
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/pdf');

      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res);

      // Add title if provided
      if (metadata?.title) {
        doc.fontSize(16).font('Helvetica-Bold').text(metadata.title, { align: 'center' });
        doc.moveDown();
      }

      // Add metadata
      if (metadata) {
        doc.fontSize(10).font('Helvetica').fillColor('#666');
        if (metadata.documentId) doc.text(`Document ID: ${metadata.documentId}`);
        if (metadata.source) doc.text(`Source: ${metadata.source}`);
        doc.text(`Exported: ${new Date().toISOString()}`);
        doc.moveDown(1.5);
      }

      // Add main text content
      doc.fontSize(12).font('Helvetica').fillColor('#000').text(text, {
        align: 'left',
        lineGap: 2
      });

      doc.end();
    }
  } catch (error) {
    console.error('[Export] Text export failed:', error);
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

/**
 * @swagger
 * /api/export/annotations:
 *   post:
 *     summary: Export document annotations as JSON
 *     tags: [Export]
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
 *               - annotations
 *               - documentId
 *             properties:
 *               annotations:
 *                 type: array
 *                 items:
 *                   type: object
 *               documentId:
 *                 type: number
 *               includeMetadata:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: JSON file download
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/annotations', authenticateApi, async (req, res) => {
  try {
    const { annotations, documentId, includeMetadata } = req.body;

    // Validation
    if (!Array.isArray(annotations)) {
      return res.status(400).json({ error: 'Invalid annotations - must be an array' });
    }
    if (!documentId) {
      return res.status(400).json({ error: 'Missing documentId' });
    }

    const timestamp = Date.now();
    const filename = `annotations-doc${documentId}-${timestamp}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');

    // Normalize and structure export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      documentId: documentId,
      annotationCount: annotations.length,
      format: 'paperless-ai-annotations-v1',
      annotations: annotations.map((ann, idx) => ({
        index: idx + 1,
        id: ann.id || null,
        label: ann.label || '',
        note: ann.note || '',
        bbox: {
          x: ann.bbox?.x || 0,
          y: ann.bbox?.y || 0,
          width: ann.bbox?.width || 0,
          height: ann.bbox?.height || 0
        },
        pageNumber: ann.pageNumber || 1,
        confirmed: ann.confirmed || false
      }))
    };

    if (includeMetadata && documentId) {
      // TODO: Optionally fetch document metadata from Paperless API
      // const paperlessService = require('../../services/paperlessService');
      // exportData.documentMetadata = await paperlessService.getDocument(documentId);
      exportData.documentMetadata = {
        note: 'Document metadata fetching not yet implemented'
      };
    }

    res.json(exportData);
  } catch (error) {
    console.error('[Export] Annotations export failed:', error);
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

module.exports = router;
