const express = require('express');
const router = express.Router();
const paperlessService = require('../services/paperlessService.js');
const configFile = require('../config/config.js');

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
    //map the tags to their names
    document.tags = await Promise.all(document.tags.map(async tag => {
      const tagName = await paperlessService.getTagTextFromId(tag);
      return tagName;
    }
    ));
    console.log('Document Data:', document);
    res.json({ content: document.content, title: document.title, id: document.id, tags: document.tags });
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
  res.render('manual', {
    title: 'Document Review',
    error: null,
    success: null,
    version,
    paperlessUrl: process.env.PAPERLESS_API_URL,
    paperlessToken: process.env.PAPERLESS_API_TOKEN,
    config: {}
  });
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
