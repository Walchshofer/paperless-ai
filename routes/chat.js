const express = require('express');
const router = express.Router();
const paperlessService = require('../services/paperlessService.js');
const ChatService = require('../services/chatService.js');
const configFile = require('../config/config.js');

/**
 * @swagger
 * /chat:
 *   get:
 *     summary: Chat interface page
 *     description: |
 *       Renders the chat interface page where users can interact with document-specific AI assistants.
 *       This page displays a list of available documents and the chat interface for the selected document.
 *     tags:
 *       - Navigation
 *       - Chat
 *     parameters:
 *       - in: query
 *         name: open
 *         schema:
 *           type: string
 *         description: ID of document to open immediately in chat
 *         required: false
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Chat interface page rendered successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
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
router.get('/chat', async (req, res) => {
  try {
      const {open} = req.query;
      // Use unfiltered documents for UI dropdown - tag filtering is only for automatic processing
      const documents = await paperlessService.getAllDocumentsUnfiltered();
      const version = configFile.PAPERLESS_AI_VERSION || ' ';

      // Provide model discovery information to the UI so it can render provider-aware model lists
      const ModelResolutionService = require('../services/ModelResolutionService');
      const modelProviders = await ModelResolutionService.getAllModels();
      const expertModels = ModelResolutionService.getExpertModels();
      const modelConfig = {
        providers: modelProviders,
        expertModels,
        currentProvider: configFile.aiProvider || process.env.AI_PROVIDER || 'ollama'
      };

      // Text-RAG circuit breaker status from ChatService
      const chatService = require('../services/chatService.js');
      const textRagStatus = chatService.getTextRagStatus ? chatService.getTextRagStatus() : { available: false, circuitBreakerState: 'UNKNOWN' };

      const vm = {
        version,
        config: {
          disableGithubFetch: process.env.DISABLE_GITHUB_FETCH || 'no'
        },
        chat: {
          openDocumentId: open ? Number(open) : null,
          documents,
          aiProvider: configFile.aiProvider,
          ollamaDefaultModel: configFile.ollama?.model || null,
          modelConfig,
          textRagStatus
        }
      };
      res.render('chat', { vm });
  } catch (error) {
    console.error('[ERRO] loading documents:', error);
    res.status(500).send('Error loading documents');
  }
});

/**
 * @swagger
 * /chat/init:
 *   get:
 *     summary: Initialize chat for a document via query parameter
 *     description: |
 *       Initializes a chat session for a specific document identified by the query parameter.
 *       Loads document content and prepares it for the chat interface.
 *       This endpoint returns the document content, chat history if available, and initial context.
 *     tags:
 *       - API
 *       - Chat
 *     parameters:
 *       - in: query
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the document to initialize chat for
 *         example: "123"
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Chat session initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 documentId:
 *                   type: string
 *                   description: ID of the document
 *                   example: "123"
 *                 content:
 *                   type: string
 *                   description: Content of the document
 *                   example: "This is the document content"
 *                 title:
 *                   type: string
 *                   description: Title of the document
 *                   example: "Invoice #12345"
 *                 history:
 *                   type: array
 *                   description: Previous chat messages if any
 *                   items:
 *                     type: object
 *                     properties:
 *                       role:
 *                         type: string
 *                         example: "user"
 *                       content:
 *                         type: string
 *                         example: "What is this document about?"
 *       400:
 *         description: Missing document ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *       404:
 *         description: Document not found
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
router.get('/chat/init', async (req, res) => {
  const documentId = req.query.documentId;
  const model = req.query.model ? String(req.query.model).trim() : null;

  if (!documentId) {
    return res.status(400).json({ error: 'documentId query parameter is required' });
  }

  try {
    const provider = configFile.aiProvider || process.env.AI_PROVIDER || 'ollama';
    if (model) {
      const ModelResolutionService = require('../services/ModelResolutionService');
      const ok = await ModelResolutionService.validateModel(provider, model);
      if (!ok) {
        return res.status(400).json({ error: `Model \"${model}\" is not available for provider \"${provider}\"` });
      }
    }

    const result = await ChatService.initializeChat(documentId, { model });
    res.json(result);
  } catch (error) {
    console.error('[ERRO] initializing chat:', error);
    res.status(500).json({ error: 'Failed to initialize chat' });
  }
});

/**
 * @swagger
 * /chat/message:
 *   post:
 *     summary: Send message to document chat
 *     description: |
 *       Sends a user message to the document-specific chat AI assistant.
 *       The message is processed in the context of the specified document.
 *       Returns a streaming response with the AI's reply chunks.
 *     tags:
 *       - API
 *       - Chat
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
 *               - message
 *             properties:
 *               documentId:
 *                 type: string
 *                 description: ID of the document to chat with
 *                 example: "123"
 *               message:
 *                 type: string
 *                 description: User message to send to the chat
 *                 example: "What is this document about?"
 *     responses:
 *       200:
 *         description: |
 *           Response streaming started. Each event contains a message chunk.
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 data: {"chunk":"This document appears to be"}
 *
 *                 data: {"chunk":" an invoice from"}
 *
 *                 data: {"done":true}
 *       400:
 *         description: Missing document ID or message
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *       404:
 *         description: Document not found
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
router.post('/chat/message', async (req, res) => {
  try {
    const { documentId, message, model } = req.body;
    if (!documentId || !message) {
      return res.status(400).json({ error: 'Document ID and message are required' });
    }

    // Use the new streaming method
    await ChatService.sendMessageStream(documentId, message, res, { model });
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /chat/init/{documentId}:
 *   get:
 *     summary: Initialize chat for a document via path parameter
 *     description: |
 *       Initializes a chat session for a specific document identified by the path parameter.
 *       Loads document content and prepares it for the chat interface.
 *       This endpoint returns the document content, chat history if available, and initial context.
 *     tags:
 *       - API
 *       - Chat
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the document to initialize chat for
 *         example: "123"
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Chat session initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 documentId:
 *                   type: string
 *                   description: ID of the document
 *                   example: "123"
 *                 content:
 *                   type: string
 *                   description: Content of the document
 *                   example: "This is the document content"
 *                 title:
 *                   type: string
 *                   description: Title of the document
 *                   example: "Invoice #12345"
 *                 history:
 *                   type: array
 *                   description: Previous chat messages if any
 *                   items:
 *                     type: object
 *                     properties:
 *                       role:
 *                         type: string
 *                         example: "user"
 *                       content:
 *                         type: string
 *                         example: "What is this document about?"
 *       400:
 *         description: Missing document ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *       404:
 *         description: Document not found
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
router.get('/chat/init/:documentId', async (req, res) => {
  try {
      const { documentId } = req.params;
      if (!documentId) {
          return res.status(400).json({ error: 'Document ID is required' });
      }

      const model = req.query.model ? String(req.query.model).trim() : null;

      const provider = configFile.aiProvider || process.env.AI_PROVIDER || 'ollama';
      if (model) {
        const ModelResolutionService = require('../services/ModelResolutionService');
        const ok = await ModelResolutionService.validateModel(provider, model);
        if (!ok) {
          return res.status(400).json({ error: `Model \"${model}\" is not available for provider \"${provider}\"` });
        }
      }

      const result = await ChatService.initializeChat(documentId, { model });
      res.json(result);
  } catch (error) {
      console.error('[ERRO] initializing chat:', error);
      res.status(500).json({ error: 'Failed to initialize chat' });
  }
});

module.exports = router;
