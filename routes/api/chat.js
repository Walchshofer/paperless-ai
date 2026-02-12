/**
 * @fileoverview Chat API routes for three chat modes (Text RAG, Visual RAG, Document).
 * Provides endpoints for:
 * - Text RAG: Semantic text search across all documents (384D embeddings)
 * - Visual RAG: Hybrid text + visual search using ColQwen3 (320D) and
 *   weighted score fusion
 * - Document: Context-aware chat about a specific loaded document
 * @module routes/api/chat
 */
const express = require('express');
const router = express.Router();
const { authenticateApi } = require('../../middleware/auth');
const configFile = require('../../config/config');

async function generateChatFallback(aiService, prompt, options) {
  if (typeof aiService?.generateCompletion === 'function') {
    return aiService.generateCompletion(prompt, options);
  }

  if (typeof aiService?.generateText === 'function') {
    return aiService.generateText(prompt);
  }

  if (typeof aiService?.generate === 'function') {
    return aiService.generate(prompt, options);
  }

  throw new Error('AI service does not support text generation');
}

function getUpstreamStatus(error) {
  return error?.response?.status || error?.status || error?.statusCode || null;
}

function getUpstreamErrorMessage(error) {
  if (typeof error?.response?.data?.error === 'string') {
    return error.response.data.error;
  }
  if (typeof error?.message === 'string') {
    return error.message;
  }
  return null;
}

function isModelNotFoundError(error) {
  const status = getUpstreamStatus(error);
  const message = (getUpstreamErrorMessage(error) || '').toLowerCase();
  return status === 404 && message.includes('model') &&
    message.includes('not found');
}

function getIndexedDocumentCount(status) {
  if (!status || typeof status !== 'object') {
    return 0;
  }

  const nestedCount = Number(
    status.indexing_status && status.indexing_status.documents_count
  );
  if (Number.isFinite(nestedCount) && nestedCount > 0) {
    return nestedCount;
  }

  const topLevelCount = Number(status.documents_count);
  if (Number.isFinite(topLevelCount) && topLevelCount > 0) {
    return topLevelCount;
  }

  return 0;
}

function isRagServiceAvailable(status) {
  if (!status || typeof status !== 'object') {
    return false;
  }

  if (status.disabled === true || status.server_up === false) {
    return false;
  }

  const indexedDocumentCount = getIndexedDocumentCount(status);

  return Boolean(
    status.server_up && (
      status.index_ready ||
      status.data_loaded ||
      status.qdrant_ready ||
      indexedDocumentCount > 0
    )
  );
}

function getResultDocumentId(result) {
  if (!result || typeof result !== 'object') return null;
  const metadata = result.metadata || {};
  const rawId = [
    result.documentId,
    result.document_id,
    result.doc_id,
    result.docId,
    metadata.documentId,
    metadata.document_id,
    metadata.doc_id,
    metadata.docId,
    result.id
  ].find((value) => value !== undefined && value !== null && value !== '');

  if (rawId === null || rawId === undefined) {
    return null;
  }

  const parsed = Number(rawId);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return null;
}

function getResultSnippet(result) {
  if (!result || typeof result !== 'object') return '';
  return result.snippet || result.content || result.excerpt || '';
}

function getResultTitle(result, documentId, titleMap = new Map()) {
  const metadata = result && typeof result === 'object'
    ? (result.metadata || {})
    : {};

  const rawTitle = [
    result?.title,
    result?.documentTitle,
    metadata.title,
    metadata.document_title,
    metadata.documentTitle
  ].find((value) => typeof value === 'string' && value.trim().length > 0);

  if (rawTitle) {
    return rawTitle.trim();
  }
  if (documentId && titleMap.has(documentId)) {
    return titleMap.get(documentId);
  }
  return documentId ? `Document #${documentId}` : 'Untitled';
}

async function resolveMissingDocumentTitles(searchResults) {
  const titleMap = new Map();
  if (!Array.isArray(searchResults) || searchResults.length === 0) {
    return titleMap;
  }

  const missingDocIds = new Set();
  searchResults.forEach((result) => {
    const docId = getResultDocumentId(result);
    if (!docId) return;
    const candidate = getResultTitle(result, docId);
    if (!candidate || candidate === `Document #${docId}`) {
      missingDocIds.add(docId);
    }
  });

  if (!missingDocIds.size) {
    return titleMap;
  }

  const paperlessService = require('../../services/paperlessService');
  await Promise.all(
    Array.from(missingDocIds).map(async (docId) => {
      try {
        const document = await paperlessService.getDocument(docId);
        const title = typeof document?.title === 'string'
          ? document.title.trim()
          : '';
        if (title) {
          titleMap.set(docId, title);
        }
      } catch (error) {
        // Missing titles should never fail chat response generation.
      }
    })
  );

  return titleMap;
}

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

    const ragAvailable = isRagServiceAvailable(ragStatus);

    // Graceful degradation: keep chat available even while text index warms up.
    let searchResults = [];
    let searchMode = 'rag';
    if (!ragAvailable) {
      console.warn('[RAG Chat] RAG service not available:', ragStatus);
      searchMode = 'text-fallback';
    } else {
      // Search for relevant documents
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
        searchMode = 'text-fallback';
      }
    }

    const titleMap = await resolveMissingDocumentTitles(searchResults);

    // Build context from search results
    const context = searchResults
      .map((result) => {
        const docId = getResultDocumentId(result);
        const title = getResultTitle(result, docId, titleMap);
        return `[Document: ${title} (ID: ${docId || 'unknown'})]\n` +
          `${getResultSnippet(result)}`;
      })
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
      if (isModelNotFoundError(chatError) ||
          getUpstreamStatus(chatError) === 503) {
        throw chatError;
      }
      console.warn('[RAG Chat] Chat API failed, trying generate:', chatError.message);
      // Fallback to generate API
      const prompt = `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`;
      const result = await generateChatFallback(aiService, prompt, {
        model,
        temperature: 0.7
      });
      response = result.response || result;
    }

    // Format sources for response
    const sources = searchResults.map((result) => {
      const docId = getResultDocumentId(result);
      return {
        documentId: docId,
        title: getResultTitle(result, docId, titleMap),
        page: result.page || result.pageNum || 1,
        confidence: result.score || result.confidence || 0.5
      };
    });

    res.json({
      response: typeof response === 'string' ? response : JSON.stringify(response),
      sources,
      mode: searchMode
    });

  } catch (error) {
    const upstreamStatus = getUpstreamStatus(error);
    if (isModelNotFoundError(error) || upstreamStatus === 503) {
      const selectedModel = req.body?.model || 'unknown';
      const details = getUpstreamErrorMessage(error) ||
        'Selected model is unavailable';
      console.warn('[RAG Chat] model_unavailable', {
        reasonCode: 'model_unavailable',
        model: selectedModel,
        upstreamStatus,
        details
      });
      return res.status(503).json({
        error: 'AI model unavailable',
        reasonCode: 'model_unavailable',
        model: selectedModel,
        details
      });
    }
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
 *       embeddings (320D ColQwen3) using weighted score fusion.
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
      // Hybrid search with default weighted fusion (visual 0.7, text 0.3)
      try {
        const hybridResults = await hybridSearch.search(message, {
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
        if (isRagServiceAvailable(ragStatus)) {
          const ragResults = await ragService.search(message, { max_results: 5 });
          searchResults = Array.isArray(ragResults) ? ragResults : (ragResults.results || []);
        }
        searchMode = 'text-fallback';
      }
    } else if (availability.text) {
      // Text-only fallback
      const ragService = require('../../services/ragService');
      const ragStatus = await ragService.checkStatus();
      if (isRagServiceAvailable(ragStatus)) {
        const ragResults = await ragService.search(message, { max_results: 5 });
        searchResults = Array.isArray(ragResults) ? ragResults : (ragResults.results || []);
      }
      searchMode = 'text-fallback';
    } else {
      console.warn('[Visual RAG Chat] No search sources available');
    }

    const titleMap = await resolveMissingDocumentTitles(searchResults);

    // Build context from search results
    const context = searchResults
      .map((result) => {
        const docId = getResultDocumentId(result);
        const title = getResultTitle(result, docId, titleMap);
        return `[Document: ${title} (ID: ${docId || 'unknown'})]\n` +
          `${getResultSnippet(result)}`;
      })
      .join('\n\n');

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
      if (isModelNotFoundError(chatError) ||
          getUpstreamStatus(chatError) === 503) {
        throw chatError;
      }
      console.warn('[Visual RAG Chat] Chat API failed, trying generate:', chatError.message);
      const prompt = `${systemPrompt}\\n\\nUser: ${message}\\n\\nAssistant:`;
      const result = await generateChatFallback(aiService, prompt, {
        model,
        temperature: 0.7
      });
      response = result.response || result;
    }

    // Format sources for response with visual scores and thumbnails
    const sources = searchResults.map((result) => {
      const docId = getResultDocumentId(result);
      return {
        documentId: docId,
        title: getResultTitle(result, docId, titleMap),
        page: result.page || result.pageNum || 1,
        confidence: result.score || result.confidence || 0.5,
        visualScore: result.visualScore,
        textScore: result.textScore,
        // Include thumbnail URL for visual results
        thumbnailUrl: docId ? `/documents/${docId}/thumbnail` : undefined
      };
    });

    res.json({
      response: typeof response === 'string' ? response : JSON.stringify(response),
      sources,
      mode: searchMode
    });

  } catch (error) {
    const upstreamStatus = getUpstreamStatus(error);
    if (isModelNotFoundError(error) || upstreamStatus === 503) {
      const selectedModel = req.body?.model || 'unknown';
      const details = getUpstreamErrorMessage(error) ||
        'Selected model is unavailable';
      console.warn('[Visual RAG Chat] model_unavailable', {
        reasonCode: 'model_unavailable',
        model: selectedModel,
        upstreamStatus,
        details
      });
      return res.status(503).json({
        error: 'AI model unavailable',
        reasonCode: 'model_unavailable',
        model: selectedModel,
        details
      });
    }
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
    const { message, model, documentId, documentContext, context: requestContext } = req.body;

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

    // Multimodal support: extract images from context
    const images = (requestContext || [])
      .filter(ctx => ctx.type === 'visual' && ctx.imageBase64)
      .map(ctx => ctx.imageBase64);

    const messages = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: message,
        ...(images.length > 0 ? { images } : {})
      }
    ];

    const selectedModel = model || configFile.ollama?.model || 'llama3.2';
    if (images.length > 0) {
      console.log('[Document Chat] multimodal_payload', {
        model: selectedModel,
        images: ['<redacted>'],
        imageCount: images.length
      });
    }

    let response;
    try {
      const result = await aiService.chat({
        model: selectedModel,
        messages,
        stream: false
      });
      response = result.content || result.message?.content || result;
    } catch (chatError) {
      if (isModelNotFoundError(chatError) ||
          getUpstreamStatus(chatError) === 503) {
        throw chatError;
      }
      console.warn('[Document Chat] Chat API failed, trying generate:', chatError.message);
      const prompt = `${systemPrompt}\n\nQuestion: ${message}\n\nAnswer:`;
      const result = await generateChatFallback(aiService, prompt, {
        model: selectedModel,
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
    const upstreamStatus = getUpstreamStatus(error);
    if (isModelNotFoundError(error) || upstreamStatus === 503) {
      const selectedModel = req.body?.model || configFile.ollama?.model ||
        'llama3.2';
      const details = getUpstreamErrorMessage(error) ||
        'Selected model is unavailable';
      console.warn('[Document Chat] model_unavailable', {
        reasonCode: 'model_unavailable',
        model: selectedModel,
        upstreamStatus,
        details
      });
      return res.status(503).json({
        error: 'AI model unavailable',
        reasonCode: 'model_unavailable',
        model: selectedModel,
        details
      });
    }
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
        available: isRagServiceAvailable(ragStatus),
        indexReady: ragStatus.index_ready,
        qdrantReady: Boolean(ragStatus.qdrant_ready),
        documentsCount: getIndexedDocumentCount(ragStatus),
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
