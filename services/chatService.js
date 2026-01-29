// services/chatService.js
const OpenAIService = require('./openaiService');
const PaperlessService = require('./paperlessService');
const config = require('../config/config');
const fs = require('fs');
const path = require('path');
const os = require('os');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);
const { OpenAI } = require('openai');

// Optional DB persistence for chat history
let chatRepository = null;
try {
  chatRepository = require('./repositories/chatRepository');
} catch (e) {
  console.warn('[ChatService] Chat repository not available:', e.message);
}

// Optional text-rag integration for semantic context retrieval
let textRagClient = null;
const TEXT_RAG_URL = process.env.TEXT_RAG_URL || 'http://text-rag:8004';
try {
  const axios = require('axios');
  textRagClient = axios.create({
    baseURL: TEXT_RAG_URL,
    timeout: 10000
  });
} catch (e) {
  console.warn('[ChatService] Text-RAG client not available:', e.message);
}

// Circuit breaker for text-rag calls - guardrail to avoid cascading failures
const TextRagCircuitBreaker = require('./textRagCircuitBreaker');
const _textRagBreaker = new TextRagCircuitBreaker({
  failureThreshold: (config && config.textRag && config.textRag.failureThreshold) || 3,
  resetTimeoutMs: (config && config.textRag && config.textRag.resetTimeoutMs) || 60000
});

class ChatService {
  constructor() {
    this.chats = new Map(); // Stores chat histories: documentId -> messages[]
    this.tempDir = path.join(os.tmpdir(), 'paperless-chat');
    
    // Create temporary directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Downloads the original file from Paperless
   * @param {string} documentId - The ID of the document
   * @returns {Promise<{filePath: string, filename: string, mimeType: string}>}
   */
  async downloadDocument(documentId) {
    try {
      const document = await PaperlessService.getDocument(documentId);
      const tempFilePath = path.join(this.tempDir, `${documentId}_${document.original_filename}`);
      
      // Create download stream
      const response = await PaperlessService.client.get(`/documents/${documentId}/download/`, {
        responseType: 'stream'
      });

      // Save file temporarily
      await pipeline(
        response.data,
        fs.createWriteStream(tempFilePath)
      );

      return {
        filePath: tempFilePath,
        filename: document.original_filename,
        mimeType: document.mime_type
      };
    } catch (error) {
      console.error(`Error downloading document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Fetches semantic context from text-rag service
   * @param {string} query - Search query
   * @param {number} topK - Number of results
   * @returns {Promise<Array>} Relevant context snippets
   */
  async getSemanticContext(query, topK = 5) {
    if (!textRagClient) return [];

    try {
      // Use circuit breaker to guard text-rag requests
      const response = await _textRagBreaker.execute(() => textRagClient.post('/search', {
        query,
        top_k: topK
      }));
      return response.data || [];
    } catch (error) {
      if (error && error.message && error.message.includes('Circuit')) {
        console.warn('[ChatService] Text-RAG circuit open, skipping search');
      } else {
        console.warn('[ChatService] Text-RAG search failed:', error.message);
      }
      return [];
    }
  }

  /**
   * Initializes a new chat for a document
   * @param {string} documentId - The ID of the document
   */
  async initializeChat(documentId, options = {}) {
    try {
      // Get document information
      const document = await PaperlessService.getDocument(documentId);
      let documentContent;

      try {
        documentContent = await PaperlessService.getDocumentContent(documentId);
      } catch (error) {
        console.warn('Could not get direct document content, trying file download...', error);
        const { filePath } = await this.downloadDocument(documentId);
        documentContent = await fs.promises.readFile(filePath, 'utf8');
      }

      // Optionally fetch additional semantic context from text-rag
      let semanticContext = '';
      if (options.useTextRag !== false && textRagClient) {
        try {
          const ragResults = await this.getSemanticContext(document.title, 3);
          if (ragResults.length > 0) {
            semanticContext = '\n\nRelated context from document archive:\n' +
              ragResults
                .filter(r => r.doc_id !== parseInt(documentId)) // Exclude current doc
                .slice(0, 2)
                .map(r => `- ${r.title}: ${r.snippet}`)
                .join('\n');
          }
        } catch (e) {
          console.warn('[ChatService] Could not fetch semantic context:', e.message);
        }
      }

      // Create initial system prompt with document content and optional RAG context
      const messages = [
        {
          role: "system",
          content: `You are a helpful assistant for the document "${document.title}".
                   Use the following document content as context for your responses.
                   If you don't know something or it's not in the document, please say so honestly.

                   Document content:
                   ${documentContent}${semanticContext}`
        }
      ];

      const requestedModel = typeof options.model === 'string' && options.model.trim()
        ? options.model.trim()
        : null;

      this.chats.set(documentId, {
        messages,
        documentTitle: document.title,
        model: requestedModel,
        useTextRag: options.useTextRag !== false,
        sessionId: null
      });

      // If persistence enabled (option override > global config), create or fetch a session id
      const persistenceEnabled = (options && options.chatPersistence === 'yes') || (config.chatPersistence === 'yes');
      if (persistenceEnabled && chatRepository) {
        try {
          const sid = await this.getOrCreateSession(parseInt(documentId));
          const chatData = this.chats.get(documentId);

          // Attempt to hydrate persisted messages for this session
          try {
            const persisted = await this.getMessages(sid, 1000, 0);
            if (persisted && persisted.length > 0) {
              // Map persisted rows to the in-memory message shape
              chatData.messages = persisted.map(m => ({ role: m.role, content: m.content, metadata: m.metadata, message_index: m.message_index, created_at: m.created_at }));
            } else {
              // No persisted history; persist the initial system message
              const sysMsg = messages.find(m => m.role === 'system');
              if (sysMsg) {
                await this.appendMessage(sid, 'system', sysMsg.content, { documentTitle: document.title });
              }
            }
          } catch (e) {
            console.warn('[ChatService] Could not fetch persisted messages:', e.message);
            // If we could not read persisted messages (e.g., table missing), persist the initial system message
            try {
              const sysMsg = messages.find(m => m.role === 'system');
              if (sysMsg) {
                await this.appendMessage(sid, 'system', sysMsg.content, { documentTitle: document.title });
              }
            } catch (err) {
              console.warn('[ChatService] Failed to persist initial system message after fetch error:', err.message);
            }
          }

          chatData.sessionId = sid;
          this.chats.set(documentId, chatData);
        } catch (e) {
          console.warn('[ChatService] Could not persist initial chat session:', e.message);
        }
      }

      const chatDataOut = this.chats.get(documentId);
      return {
        documentTitle: document.title,
        initialized: true,
        model: requestedModel,
        hasRagContext: semanticContext.length > 0,
        history: chatDataOut ? chatDataOut.messages : [],
        textRagStatus: this.getTextRagStatus()
      };
    } catch (error) {
      console.error(`Error initializing chat for document ${documentId}:`, error);
      throw error;
    }
  }

  async sendMessageStream(documentId, userMessage, res, options = {}) {
    try {
      if (!this.chats.has(documentId)) {
        await this.initializeChat(documentId, options);
      }

      const chatData = this.chats.get(documentId);
      const requestedModel = typeof options.model === 'string' && options.model.trim()
        ? options.model.trim()
        : null;
      if (requestedModel) {
        chatData.model = requestedModel;
      }

      let finalMessage = userMessage;
      if (options.context && Array.isArray(options.context)) {
        const contextStr = options.context.map(c => {
          if (c.type === 'visual') {
             // For visual context, we might want to use a multimodal model feature if available,
             // but for now we'll just indicate it in text or maybe pass the base64 if the model supports it.
             // The ticket assumes text-based analysis of the context or that the LLM can "see" it if we pass it right.
             // If the model is text-only, we can't really pass the image unless we use an OCR/Vision service first.
             // However, the "context" might just be metadata. 
             // "Analyze this visual region" implies we should pass the image.
             // Paperless-AI seems to have vision models.
             // If we are using Ollama Vision, we can pass `images` array in the message.
             return `[Visual Context: Region on page ${c.page}]`; 
          }
          if (c.type === 'text') {
            return `[Context: ${c.excerpt}]`;
          }
          return '';
        }).join('\n');
        
        if (contextStr) {
           finalMessage = `${contextStr}\n\n${userMessage}`;
        }
      }

      chatData.messages.push({
        role: "user",
        content: finalMessage,
        ...(options.context && options.context.some(c => c.type === 'visual' && c.imageBase64) ? {
           images: options.context.filter(c => c.type === 'visual' && c.imageBase64).map(c => c.imageBase64)
        } : {})
      });

      // Persist user message if enabled (option override > global config)
      const persistMessages = (options && options.chatPersistence === 'yes') || (config.chatPersistence === 'yes');
      if (persistMessages && chatRepository && chatData.sessionId) {
        try {
          await this.appendMessage(chatData.sessionId, 'user', userMessage, { model: chatData.model });
        } catch (e) {
          console.warn('[ChatService] Failed to persist user message:', e.message);
        }
      }

      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullResponse = '';
      const aiProvider = process.env.AI_PROVIDER;

      if (aiProvider === 'openai') {
        // Make sure OpenAIService is initialized
        OpenAIService.initialize();
        
        // Always create a new client instance for this request to ensure it works
        const openai = new OpenAI({
          apiKey: process.env.PAPERLESS_OPENAI_API_KEY
        });
        
        const stream = await openai.chat.completions.create({
          model: process.env.PAPERLESS_OPENAI_MODEL || 'gpt-4',
          messages: chatData.messages,
          stream: true,
        });
        
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else if (aiProvider === 'custom') {
        // Use OpenAI SDK with custom base URL
        const customOpenAI = new OpenAI({
          baseURL: process.env.CUSTOM_BASE_URL,
          apiKey: process.env.CUSTOM_API_KEY,
        });

        const stream = await customOpenAI.chat.completions.create({
          model: process.env.CUSTOM_MODEL,
          messages: chatData.messages,
          stream: true,
        });
        
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else if (aiProvider === 'azure') {
        // Use OpenAI SDK with Azure configuration
        const azureOpenAI = new OpenAI({
          apiKey: process.env.AZURE_API_KEY,
          baseURL: `${process.env.AZURE_ENDPOINT}/openai/deployments/${process.env.AZURE_DEPLOYMENT_NAME}`,
          defaultQuery: { 'api-version': process.env.AZURE_API_VERSION },
        });

        const stream = await azureOpenAI.chat.completions.create({
          model: process.env.AZURE_DEPLOYMENT_NAME,
          messages: chatData.messages,
          stream: true,
        });
        
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else if (aiProvider === 'ollama') {
        const model = chatData.model || process.env.OLLAMA_MODEL;
        // Use OpenAI SDK for Ollama with OpenAI API compatibility
        const ollamaOpenAI = new OpenAI({
          baseURL: `${process.env.OLLAMA_API_URL}/v1`,
          apiKey: 'ollama', // Ollama doesn't require a real API key but the SDK requires some value
        });

        const stream = await ollamaOpenAI.chat.completions.create({
          model: model,
          messages: chatData.messages,
          stream: true,
        });
        
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else {
        throw new Error('AI Provider not configured');
      }

      // Add the complete response to chat history
      chatData.messages.push({
        role: "assistant",
        content: fullResponse
      });
      this.chats.set(documentId, chatData);

      // Persist assistant message if enabled (option override > global config)
      const persistAssistant = (options && options.chatPersistence === 'yes') || (config.chatPersistence === 'yes');
      if (persistAssistant && chatRepository && chatData.sessionId) {
        try {
          await this.appendMessage(chatData.sessionId, 'assistant', fullResponse, { model: chatData.model });
        } catch (e) {
          console.warn('[ChatService] Failed to persist assistant message:', e.message);
        }
      }

      // End the stream
      res.write('data: [DONE]\n\n');
      res.end();

    } catch (error) {
      console.error(`Error in sendMessageStream:`, error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }

  getChatHistory(documentId) {
    const chatData = this.chats.get(documentId);
    return chatData ? chatData.messages : [];
  }

  chatExists(documentId) {
    return this.chats.has(documentId);
  }

  // Persistence helper methods (delegate to chatRepository when available)
  async getOrCreateSession(documentId) {
    if (!chatRepository) throw new Error('Chat repository not available');
    return chatRepository.getOrCreateSession(documentId);
  }

  async appendMessage(sessionId, role, content, metadata = {}) {
    if (!chatRepository) throw new Error('Chat repository not available');
    return chatRepository.appendMessage(sessionId, role, content, metadata);
  }

  async getMessages(sessionId, limit = 100, offset = 0) {
    if (!chatRepository) return [];
    return chatRepository.getMessages(sessionId, limit, offset);
  }

  // Expose text-rag availability status for UI/monitoring
  getTextRagStatus() {
    return {
      available: !!textRagClient && _textRagBreaker.getState() !== 'OPEN',
      circuitBreakerState: _textRagBreaker.getState()
    };
  }

  async cleanup() {
    try {
      for (const documentId of this.chats.keys()) {
        await this.deleteChat(documentId);
      }
      if (fs.existsSync(this.tempDir)) {
        await fs.promises.rmdir(this.tempDir, { recursive: true });
      }
    } catch (error) {
      console.error('Error cleaning up ChatService:', error);
    }
  }
}

const chatServiceInstance = new ChatService();
module.exports = chatServiceInstance;

// Test helper: allow injecting a fake repository
module.exports.setChatRepository = (repo) => {
  chatRepository = repo;
};
module.exports._getChatRepository = () => chatRepository;

// Persistence helper exports (call underlying repository directly to avoid circular references)
module.exports.getOrCreateSession = async (documentId) => {
  if (!chatRepository) throw new Error('Chat repository not available');
  return chatRepository.getOrCreateSession(documentId);
};
module.exports.appendMessage = async (sessionId, role, content, metadata = {}) => {
  if (!chatRepository) throw new Error('Chat repository not available');
  return chatRepository.appendMessage(sessionId, role, content, metadata);
};
module.exports.getMessages = async (sessionId, limit = 100, offset = 0) => {
  if (!chatRepository) return [];
  return chatRepository.getMessages(sessionId, limit, offset);
};

// Expose text-rag status
module.exports.getTextRagStatus = () => {
  return {
    available: !!textRagClient && _textRagBreaker.getState() !== 'OPEN',
    circuitBreakerState: _textRagBreaker.getState()
  };
};
