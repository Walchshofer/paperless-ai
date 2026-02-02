/**
 * @fileoverview Chat API routes for three chat modes (Text RAG, Visual RAG, Document).
 * Provides endpoints for:
 * - Text RAG: Semantic text search across all documents (384D embeddings)
 * - Visual RAG: Hybrid text + visual search using ColQwen3 (320D) and RRF fusion
 * - Document: Context-aware chat about a specific loaded document
 * @module routes/api/chat
 */
const express = require('express');
const router = express.Router();
const { authenticateApi } = require('../../middleware/auth');
const configFile = require('../../config/config');

/**
 * @swagger
 * /api/chat/rag:
 *   post:
 *     summary: RAG Chat - Search across all indexed documents
 *     description: |
 *       Performs semantic search across all indexed documents and generates
 *       an AI response based on the most relevant results.
 *       This endpoint is always available, regardless of document selection.
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
 *               - message
 *               - model
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's question or search query
 *                 example: "Find all invoices over $1000"
 *               model:
 *                 type: string
 *                 description: LLM model to use for response generation
 *                 example: "llama3.2"
 *               history:
 *                 type: array
 *                 description: Previous conversation messages for context
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant, system]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: RAG search response with sources
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                   description: AI-generated answer
 *                 sources:
 *                   type: array
 *                   description: Documents used to generate the response
 *                   items:
 *                     type: object
 *                     properties:
 *                       documentId:
 *                         type: number
 *                       title:
 *                         type: string
 *                       page:
 *                         type: number
 *                       confidence:
 *                         type: number
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Server error
 */
router.post('/rag', authenticateApi, async (req, res) => {
  try {
    const { message, model, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!model) {
      return res.status(400).json({ error: 'Model is required' });
    }

    // Check if RAG service is available
    const ragService = require('../../services/ragService');
    const ragStatus = await ragService.checkStatus();

    if (!ragStatus.server_up || !ragStatus.index_ready) {
      console.warn('[RAG Chat] RAG service not available:', ragStatus);
      return res.status(503).json({
        error: 'RAG service is not available',
        details: ragStatus.error || 'Service not ready'
      });
    }

    // Search for relevant documents
    let searchResults = [];
    try {
      const searchResponse = await ragService.search(message, {
        max_results: 5
      });
      searchResults = Array.isArray(searchResponse)
        ? searchResponse
        : (searchResponse.results || []);
    } catch (searchError) {
      console.error('[RAG Chat] Search error:', searchError.message);
      // Continue with empty results rather than failing
    }

    // Build context from search results
    const context = searchResults
      .map(r => `[Document: ${r.title || 'Untitled'} (ID: ${r.doc_id || r.documentId})]\n${r.snippet || r.content || ''}`)
      .join('\n\n');

    // Build conversation messages
    const conversationHistory = Array.isArray(history)
      ? history.slice(-10).map(m => ({ role: m.role, content: m.content }))
      : [];

    // Generate response using AI service
    const AIServiceFactory = require('../../services/aiServiceFactory');
    const aiService = AIServiceFactory.getService();

    const systemPrompt = `You are a helpful assistant that answers questions based on document archives.
Answer the user's question using the provided document context. If the context doesn't contain
relevant information, say so clearly. Always cite which documents you used.

Document Context:
${context || 'No relevant documents found.'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    let response;
    try {
      // Try chat API first
      const result = await aiService.chat({
        model,
        messages,
        stream: false
      });
      response = result.content || result.message?.content || result;
    } catch (chatError) {
      console.warn('[RAG Chat] Chat API failed, trying generate:', chatError.message);
      // Fallback to generate API
      const prompt = `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`;
      const result = await aiService.generateCompletion(prompt, {
        model,
        temperature: 0.7
      });
      response = result.response || result;
    }

    // Format sources for response
    const sources = searchResults.map(r => ({
      documentId: r.doc_id || r.documentId,
      title: r.title || `Document #${r.doc_id || r.documentId}`,
      page: r.page || 1,
      confidence: r.score || r.confidence || 0.5
    }));

    res.json({
      response: typeof response === 'string' ? response : JSON.stringify(response),
      sources,
      mode: 'rag'
    });

  } catch (error) {
    console.error('[RAG Chat] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process RAG chat request'
    });
  }
});

/**
 * @swagger
 * /api/chat/visual-rag:
 *   post:
 *     summary: Visual RAG Chat - Hybrid text + visual search
 *     description: |
 *       Performs hybrid search combining text embeddings (384D) and visual
 *       embeddings (320D ColQwen3) using Reciprocal Rank Fusion (RRF).
 *       Falls back to text-only search if Visual-RAG sidecar is unavailable.
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
 *               - message
 *               - model
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's visual search query
 *                 example: "Find documents with tables"
 *               model:
 *                 type: string
 *                 description: LLM model to use
 *               history:
 *                 type: array
 *                 description: Previous conversation messages
 *     responses:
 *       200:
 *         description: Visual RAG response with sources
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                 sources:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       documentId:
 *                         type: number
 *                       title:
 *                         type: string
 *                       page:
 *                         type: number
 *                       visualScore:
 *                         type: number
 *                       textScore:
 *                         type: number
 *                 mode:
 *                   type: string
 *                   enum: [hybrid, text-fallback]
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Server error
 */
router.post('/visual-rag', authenticateApi, async (req, res) => {
  try {
    const { message, model, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!model) {
      return res.status(400).json({ error: 'Model is required' });
    }

    // Use HybridSearchService for combined text + visual search
    const { getHybridSearchService } = require('../../services/visual-rag-client/HybridSearchService');
    const hybridSearch = getHybridSearchService();

    // Check availability
    const availability = await hybridSearch.isAvailable();
    let searchResults = [];
    let searchMode = 'hybrid';

    if (availability.hybrid) {
      // Hybrid search with alpha=0.5 (equal blend)
      try {
        const hybridResults = await hybridSearch.search(message, {
          alpha: 0.5,
          k: 10,
          maxResults: 5
        });
        searchResults = hybridResults.results || [];
        searchMode = availability.visual ? 'hybrid' : 'text-fallback';
      } catch (searchError) {
        console.warn('[Visual RAG Chat] Hybrid search failed:', searchError.message);
        // Fallback to text-only
        const ragService = require('../../services/ragService');
        const ragStatus = await ragService.checkStatus();
        if (ragStatus.server_up && ragStatus.index_ready) {
          const ragResults = await ragService.search(message, { max_results: 5 });
          searchResults = Array.isArray(ragResults) ? ragResults : (ragResults.results || []);
        }
        searchMode = 'text-fallback';
      }
    } else if (availability.text) {
      // Text-only fallback
      const ragService = require('../../services/ragService');
      const ragStatus = await ragService.checkStatus();
      if (ragStatus.server_up && ragStatus.index_ready) {
        const ragResults = await ragService.search(message, { max_results: 5 });
        searchResults = Array.isArray(ragResults) ? ragResults : (ragResults.results || []);
      }
      searchMode = 'text-fallback';
    } else {
      console.warn('[Visual RAG Chat] No search sources available');
    }

    // Build context from search results
    const context = searchResults
      .map(r => `[Document: ${r.title || 'Untitled'} (ID: ${r.doc_id || r.documentId})]\\n${r.snippet || r.content || ''}`)
      .join('\\n\\n');

    // Build conversation messages
    const conversationHistory = Array.isArray(history)
      ? history.slice(-10).map(m => ({ role: m.role, content: m.content }))
      : [];

    // Generate response using AI service
    const AIServiceFactory = require('../../services/aiServiceFactory');
    const aiService = AIServiceFactory.getService();

    const systemPrompt = `You are a helpful assistant that answers questions based on document archives.
You specialize in finding visual content like tables, charts, graphs, and images.
Answer the user's question using the provided document context. If the context doesn't contain
relevant information, say so clearly. Always cite which documents you used.

Document Context:
${context || 'No relevant documents found.'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    let response;
    try {
      const result = await aiService.chat({
        model,
        messages,
        stream: false
      });
      response = result.content || result.message?.content || result;
    } catch (chatError) {
      console.warn('[Visual RAG Chat] Chat API failed, trying generate:', chatError.message);
      const prompt = `${systemPrompt}\\n\\nUser: ${message}\\n\\nAssistant:`;
      const result = await aiService.generateCompletion(prompt, {
        model,
        temperature: 0.7
      });
      response = result.response || result;
    }

    // Format sources for response with visual scores
    const sources = searchResults.map(r => ({
      documentId: r.doc_id || r.documentId,
      title: r.title || `Document #${r.doc_id || r.documentId}`,
      page: r.page || 1,
      confidence: r.score || r.confidence || 0.5,
      visualScore: r.visualScore,
      textScore: r.textScore
    }));

    res.json({
      response: typeof response === 'string' ? response : JSON.stringify(response),
      sources,
      mode: searchMode
    });

  } catch (error) {
    console.error('[Visual RAG Chat] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process visual RAG chat request'
    });
  }
});

/**
 * @swagger
 * /api/chat/document:
 *   post:
 *     summary: Document Chat - Context-aware conversation about a specific document
 *     description: |
 *       Enables chat about a specific document with full document context.
 *       Only available when a document is loaded.
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
 *               - message
 *               - model
 *               - documentId
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's question about the document
 *                 example: "What is the due date on this invoice?"
 *               model:
 *                 type: string
 *                 description: LLM model to use
 *               documentId:
 *                 type: number
 *                 description: ID of the document to chat about
 *               documentContext:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   content:
 *                     type: string
 *                   page:
 *                     type: number
 *     responses:
 *       200:
 *         description: Document chat response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                 confidence:
 *                   type: number
 *       400:
 *         description: Missing document ID or message
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Server error
 */
router.post('/document', authenticateApi, async (req, res) => {
  try {
    const { message, model, documentId, documentContext } = req.body;

    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required for document chat' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get document content if not provided
    let docContent = documentContext?.content;
    let docTitle = documentContext?.title;

    if (!docContent) {
      try {
        const paperlessService = require('../../services/paperlessService');
        const document = await paperlessService.getDocument(documentId);
        docTitle = document.title || `Document ${documentId}`;
        docContent = await paperlessService.getDocumentContent(documentId);
      } catch (fetchError) {
        console.warn('[Document Chat] Could not fetch document content:', fetchError.message);
        docContent = 'Document content unavailable.';
      }
    }

    // Build context from document
    const context = `Document: ${docTitle || `Document ${documentId}`}\n\n${docContent}`;

    // Generate response using AI service
    const AIServiceFactory = require('../../services/aiServiceFactory');
    const aiService = AIServiceFactory.getService();

    const systemPrompt = `You are a helpful assistant. Answer questions about the provided document accurately and concisely.
If the information requested is not in the document, say so clearly.

${context}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    let response;
    try {
      const result = await aiService.chat({
        model: model || configFile.ollama?.model || 'llama3.2',
        messages,
        stream: false
      });
      response = result.content || result.message?.content || result;
    } catch (chatError) {
      console.warn('[Document Chat] Chat API failed, trying generate:', chatError.message);
      const prompt = `${systemPrompt}\n\nQuestion: ${message}\n\nAnswer:`;
      const result = await aiService.generateCompletion(prompt, {
        model: model || configFile.ollama?.model || 'llama3.2',
        temperature: 0.7
      });
      response = result.response || result;
    }

    res.json({
      response: typeof response === 'string' ? response : JSON.stringify(response),
      confidence: 0.9,
      mode: 'document',
      documentId
    });

  } catch (error) {
    console.error('[Document Chat] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process document chat request'
    });
  }
});

/**
 * @swagger
 * /api/chat/status:
 *   get:
 *     summary: Get chat service status
 *     description: Returns the availability status of all three chat modes.
 *     tags:
 *       - API
 *       - Chat
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Chat service status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rag:
 *                   type: object
 *                   properties:
 *                     available:
 *                       type: boolean
 *                     indexReady:
 *                       type: boolean
 *                 visualRag:
 *                   type: object
 *                   properties:
 *                     available:
 *                       type: boolean
 *                       description: True if hybrid search is available
 *                     visualSidecar:
 *                       type: boolean
 *                       description: True if Visual-RAG sidecar is healthy
 *                     textFallback:
 *                       type: boolean
 *                       description: True if text-only fallback is available
 *                 document:
 *                   type: object
 *                   properties:
 *                     available:
 *                       type: boolean
 */
router.get('/status', authenticateApi, async (req, res) => {
  try {
    const ragService = require('../../services/ragService');
    const ragStatus = await ragService.checkStatus();

    // Check Visual RAG availability via HybridSearchService
    let visualRagStatus = { available: false, visual: false, text: false };
    try {
      const { getHybridSearchService } = require('../../services/visual-rag-client/HybridSearchService');
      const hybridSearch = getHybridSearchService();
      const availability = await hybridSearch.isAvailable();
      visualRagStatus = {
        available: availability.hybrid,
        visual: availability.visual,
        text: availability.text
      };
    } catch (visualError) {
      console.warn('[Chat Status] Visual RAG check failed:', visualError.message);
    }

    res.json({
      rag: {
        available: ragStatus.server_up && ragStatus.index_ready,
        indexReady: ragStatus.index_ready,
        serverUp: ragStatus.server_up,
        error: ragStatus.error
      },
      visualRag: {
        available: visualRagStatus.available,
        visualSidecar: visualRagStatus.visual,
        textFallback: visualRagStatus.text
      },
      document: {
        available: true // Document chat is always available if AI service works
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Chat Status] Error:', error);
    res.status(500).json({
      error: error.message,
      rag: { available: false },
      visualRag: { available: false },
      document: { available: false }
    });
  }
});

module.exports = router;
