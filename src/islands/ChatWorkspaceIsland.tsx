import { h, Fragment } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ChatWorkspaceContract } from '../ui/contracts/ChatWorkspace.contract';

type ChatMode = 'rag' | 'visual-rag' | 'document';
type ChatMessageRole = 'user' | 'assistant' | 'system' | 'status';

type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  meta?: Record<string, unknown>;
  images?: string[];
  sources?: Array<{
    documentId: number;
    title?: string;
    page?: number;
    confidence?: number;
    visualScore?: number;
    textScore?: number;
    thumbnailUrl?: string;
  }>;
  isError?: boolean;
  searchMode?: 'rag' | 'hybrid' | 'text-fallback';
};

// LocalStorage key for persisting chat mode
const CHAT_MODE_STORAGE_KEY = 'paperless-ai-chat-mode';
const REINGEST_TIMEOUT_MS = 10000;

type ChatDoc = {
  id: number;
  title?: string;
  original_filename?: string;
};

type OllamaModelGroup = {
  label: string;
  models: Array<{
    label: string;
    model: string;
    placeholder?: boolean;
  }>;
};

interface MarkedLib {
  parse: (text: string) => string;
}

// WindowWithMarked interface used inline in safeMarkdown

const safeMarkdown = (text: string) => {
  const marked = (window as Window & { marked?: MarkedLib }).marked;
  if (marked && typeof marked.parse === 'function') {
    return marked.parse(text);
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br/>');
};

interface HljsLib {
  highlightBlock: (block: HTMLElement) => void;
}

// WindowWithHljs interface used inline in highlightBlocks

const highlightBlocks = (container: HTMLElement | null) => {
  const hljs = (window as Window & { hljs?: HljsLib }).hljs;
  if (!container || !hljs) return;
  const blocks = container.querySelectorAll('pre code');
  blocks.forEach((block) => {
    try {
      hljs.highlightBlock(block as HTMLElement);
    } catch (err) {
      // ignore highlighting failures
    }
  });
};

const makeId = () => `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function ChatWorkspaceIsland(
  props: Partial<ChatWorkspaceContract>
) {
  const documents: ChatDoc[] = Array.isArray(props.documents)
    ? props.documents
    : [];

  const [selectedDocumentId, setSelectedDocumentId] = useState(
    props.openDocumentId ?? null as number | null
  );
  const [selectedDocumentTitle, setSelectedDocumentTitle] = useState('');
  const [chatMessages, setChatMessages] = useState([] as ChatMessage[]);
  const [messageInput, setMessageInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState(null as string | null);
  const [docPreview, setDocPreview] = useState({
    title: '',
    content: '',
    tags: [] as string[],
    originalUrl: null as string | null,
    pageCount: 1
  });
  const [modelOptions, setModelOptions] = useState([] as OllamaModelGroup[]);
  const [selectedModel, setSelectedModel] = useState(
    props.ollamaDefaultModel ?? null as string | null
  );
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadError, setModelLoadError] = useState(null as string | null);

  // Three Chat Mode state - initialize from localStorage if available
  const getInitialChatMode = (): ChatMode => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(CHAT_MODE_STORAGE_KEY);
      if (stored === 'rag' || stored === 'visual-rag' || stored === 'document') {
        // Don't restore 'document' mode if no document is loaded
        if (stored === 'document' && !props.openDocumentId) {
          return 'rag';
        }
        return stored;
      }
    }
    return 'rag';
  };
  const [chatMode, setChatModeInternal] = useState(getInitialChatMode);
  
  // Wrapper to persist chat mode to localStorage
  const setChatMode = (mode: ChatMode) => {
    setChatModeInternal(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CHAT_MODE_STORAGE_KEY, mode);
    }
  };
  
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(Boolean(props.openDocumentId));
  const [visualRagAvailable, setVisualRagAvailable] = useState(false);
  const [visualRagStatus, setVisualRagStatus] = useState('checking' as 'checking' | 'available' | 'unavailable' | 'initializing');

  const [guidedStep, setGuidedStep] = useState('Select a document to begin.');
  const [statusMessage, setStatusMessage] = useState(null as string | null);
  const [textReingestBusy, setTextReingestBusy] = useState(false);
  const [textReingestStatus, setTextReingestStatus] = useState(
    null as string | null
  );

  type ChatContextItem = {
    type: string;
    documentId?: number;
    data?: {
      page?: number;
      text?: string;
      imageBase64?: string;
    };
  };

  const [chatContext, setChatContext] = useState([] as ChatContextItem[]);
  const chatEndRef = useRef(null as HTMLDivElement | null);
  const chatHistoryRef = useRef(null as HTMLDivElement | null);
  const streamMessageIdRef = useRef(null as string | null);

  const aiProvider = props.aiProvider || 'ollama';

  // Filter models by current provider
  const filteredModelOptions = useMemo(() => {
    const currentProvider = props.modelConfig?.currentProvider || aiProvider || 'ollama';

    if (!modelOptions || modelOptions.length === 0) return [];

    // Filter groups that match the current provider
    return modelOptions.filter((group: OllamaModelGroup) => {
      const groupLabel = group.label.toLowerCase();
      const providerName = currentProvider.toLowerCase();

      // Match provider name in group label
      // e.g., "Ollama models" matches "ollama"
      // "Expert models" is provider-agnostic, always show
      // "Installed models" show for all providers
      return (
        groupLabel.includes(providerName) ||
        groupLabel.includes('expert') ||
        groupLabel.includes('installed') ||
        groupLabel.includes('configured')
      );
    });
  }, [modelOptions, props.modelConfig?.currentProvider, aiProvider]);

  // Update selected model when provider changes
  useEffect(() => {
    const currentProvider = props.modelConfig?.currentProvider || aiProvider;

    // Check if current selected model is valid for new provider
    const isModelValid = filteredModelOptions.some((group: OllamaModelGroup) =>
      group.models.some((m: { model: string }) => m.model === selectedModel)
    );

    if (!isModelValid && filteredModelOptions.length > 0) {
      // Auto-select first available model for new provider
      const firstModel = filteredModelOptions[0]?.models[0]?.model;
      if (firstModel) {
        setSelectedModel(firstModel);
        console.log(`[Chat] Provider changed to ${currentProvider}, auto-selected model: ${firstModel}`);
      }
    }
  }, [props.modelConfig?.currentProvider, aiProvider, filteredModelOptions, selectedModel]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ctxParam = params.get('context');
      if (ctxParam) {
        try {
          const parsed = JSON.parse(decodeURIComponent(ctxParam));
          const ctxArray: ChatContextItem[] = Array.isArray(parsed) ? parsed : [parsed];
          setChatContext(ctxArray);

          if (ctxArray.some((c: ChatContextItem) => c.type === 'visual')) {
             setMessageInput('Analyze this visual region.');
          } else if (ctxArray.some((c: ChatContextItem) => c.type === 'text')) {
             setMessageInput('Analyze this text.');
          }
          
          // Select document if passed in context
          if (ctxArray[0] && ctxArray[0].documentId) {
            setSelectedDocumentId(Number(ctxArray[0].documentId));
          }

          // Clean URL
          const newUrl = window.location.pathname + window.location.search.replace(/([&?]context=[^&]*)/, '');
          window.history.replaceState({}, '', newUrl);
        } catch (e) {
          console.error('Failed to parse context', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (props.openDocumentId && !selectedDocumentId) {
      setSelectedDocumentId(props.openDocumentId);
    }
  }, [props.openDocumentId]);

  // Update isDocumentLoaded when document selection changes
  useEffect(() => {
    const hasDoc = Boolean(selectedDocumentId);
    setIsDocumentLoaded(hasDoc);
    
    // If document unloaded, switch to RAG mode
    if (!hasDoc && chatMode === 'document') {
      setChatMode('rag');
    }
  }, [selectedDocumentId, chatMode]);

  // Check Visual RAG sidecar availability
  useEffect(() => {
    const checkVisualRag = async () => {
      try {
        setVisualRagStatus('checking');
        const response = await fetch('/api/visual-rag/health');
        
        if (response.ok) {
          const data = await response.json();
          // Check if the sidecar is ready (model loaded)
          if (data.status === 'ok' || data.model_loaded) {
            setVisualRagAvailable(true);
            setVisualRagStatus('available');
          } else if (data.initializing || data.status === 'initializing') {
            setVisualRagAvailable(false);
            setVisualRagStatus('initializing');
          } else {
            setVisualRagAvailable(false);
            setVisualRagStatus('unavailable');
          }
        } else if (response.status === 503) {
          // Sidecar is initializing (GPU warmup)
          setVisualRagAvailable(false);
          setVisualRagStatus('initializing');
        } else {
          setVisualRagAvailable(false);
          setVisualRagStatus('unavailable');
        }
      } catch (error) {
        console.warn('[Chat] Visual-RAG sidecar unavailable:', error);
        setVisualRagAvailable(false);
        setVisualRagStatus('unavailable');
      }
    };

    // Initial check
    checkVisualRag();

    // Re-check every 30 seconds
    const interval = setInterval(checkVisualRag, 30000);

    return () => clearInterval(interval);
  }, []);

  // If Visual RAG becomes unavailable while in visual-rag mode, fall back to rag mode
  useEffect(() => {
    if (chatMode === 'visual-rag' && !visualRagAvailable && visualRagStatus !== 'checking') {
      setChatMode('rag');
    }
  }, [visualRagAvailable, visualRagStatus, chatMode]);

  // Listen for document changes from the main workspace document dropdown
  useEffect(() => {
    const handleDocumentSwitched = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const { documentId, document } = detail;
      
      if (documentId != null) {
        setSelectedDocumentId(Number(documentId));
        setSelectedDocumentTitle(document?.title || '');
        console.log(`[Chat] Document switched to ${documentId}: ${document?.title || 'Untitled'}`);
      }
    };

    window.addEventListener('workspace:document-switched', handleDocumentSwitched as EventListener);
    return () => window.removeEventListener('workspace:document-switched', handleDocumentSwitched as EventListener);
  }, []);

  // Prefer server-provided modelConfig when available; otherwise fall back to Ollama-only discovery
  useEffect(() => {
    if (props.modelConfig && props.modelConfig.providers) {
      // Build groups from providers
      const providers = props.modelConfig.providers || {};
      const groups: OllamaModelGroup[] = Object.keys(providers).flatMap((provider) => {
        const models = Array.isArray(providers[provider]) ? (providers[provider] as string[]) : [];
        if (!models.length) return [];
        return [{
          label: `${provider} models`,
          models: models.map((m: string) => ({ label: m, model: m }))
        }];
      });

      // Expert models (if provided as array of entries)
      type ExpertModelEntry = { label?: string; model: string };
      const expertRaw = props.modelConfig.expertModels;
      if (Array.isArray(expertRaw) && expertRaw.length) {
        groups.push({
          label: 'Expert models',
          models: (expertRaw as ExpertModelEntry[]).map((entry: ExpertModelEntry) => ({ label: entry.label ? `${entry.label} (${entry.model})` : entry.model, model: entry.model }))
        });
      }

      setModelOptions(groups);

      // Default selection: prefer modelConfig.currentProvider default if present
      const defaultModel = props.ollamaDefaultModel || (props.modelConfig && props.modelConfig.currentProvider && (providers[props.modelConfig.currentProvider] || [])[0]);
      if (defaultModel) {
        setSelectedModel(defaultModel);
      } else if (groups.length && groups[0].models.length) {
        setSelectedModel(groups[0].models[0].model);
      }
    } else {
      if (aiProvider === 'ollama') {
        void loadOllamaModels();
      }
    }
  }, [aiProvider, props.modelConfig, props.ollamaDefaultModel]);

  // Verify a single model via backend (returns installed/loaded info)
  const verifyModel = async (model: string) => {
    try {
      const resp = await fetch(`/api/ollama/verify?model=${encodeURIComponent(model)}`);
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return { ok: false, text };
      }
      const data = await resp.json();
      return { ok: true, data };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  };


  useEffect(() => {
    if (!selectedDocumentId) {
      setGuidedStep('Select a document to begin.');
      return;
    }

    if (chatMessages.length === 0) {
      setGuidedStep('Ask your first question to start the analysis.');
      return;
    }

    setGuidedStep('Refine your request or capture a decision.');
  }, [selectedDocumentId, chatMessages.length]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chatMessages, isStreaming]);

  const loadOllamaModels = async () => {
    setIsModelLoading(true);
    setModelLoadError(null);
    try {
      const response = await fetch('/api/ollama/models');
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Failed to load models: ${response.status} ${text}`);
      }
      const data = await response.json();

      type ExpertModelEntry = { label?: string; model: string };
      const installed = Array.isArray(data.models) ? (data.models as string[]) : [];
      const expertRaw = Array.isArray(data.expertModels)
        ? (data.expertModels as ExpertModelEntry[])
        : [];
      const placeholders = Array.isArray(data.placeholderModels)
        ? (data.placeholderModels as string[])
        : [];

      const installedSet = new Set(installed.filter(Boolean));
      const expertEntries = expertRaw.filter((entry: ExpertModelEntry) => entry?.model);
      const expertSet = new Set(
        expertEntries.map((entry: ExpertModelEntry) => entry.model)
      );

      const placeholderEntries = placeholders.filter((model: string) => {
        return model && !installedSet.has(model) && !expertSet.has(model);
      });

      const groups: OllamaModelGroup[] = [];
      if (installedSet.size) {
        groups.push({
          label: 'Installed models',
          models: Array.from(installedSet).map((model: string) => ({
            label: model,
            model,
          })),
        });
      }

      if (expertEntries.length) {
        groups.push({
          label: 'Expert models',
          models: expertEntries.map((entry: ExpertModelEntry) => ({
            label: entry.label
              ? `${entry.label} (${entry.model})`
              : entry.model,
            model: entry.model,
          })),
        });
      }

      if (placeholderEntries.length) {
        const placeholderLabel = data.providerMismatch
          ? 'Configured models (lazy load)'
          : 'Configured models (not verified)';
        groups.push({
          label: placeholderLabel,
          models: placeholderEntries.map((model: string) => ({
            label: `${model} (lazy load)`,
            model,
            placeholder: true,
          })),
        });
      }

      setModelOptions(groups);

      const defaultModel = data.defaultModel || props.ollamaDefaultModel;
      const defaultExists = Boolean(defaultModel) && groups.some((group: OllamaModelGroup) =>
        group.models.some((model: { label: string; model: string; placeholder?: boolean }) => model.model === defaultModel)
      );

      if (defaultExists) {
        setSelectedModel(defaultModel);
      } else if (groups.length && groups[0].models.length) {
        setSelectedModel(groups[0].models[0].model);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setModelLoadError(message);
      setModelOptions([]);
      setSelectedModel(props.ollamaDefaultModel ?? null);
    } finally {
      setIsModelLoading(false);
    }
  };

  const loadDocumentPreview = useCallback(async (documentId: number) => {
    try {
      const response = await fetch(`/workspace/api/doc/${documentId}`);
      if (!response.ok) throw new Error('Preview unavailable');
      const data = await response.json();
      setDocPreview({
        title: data.title || `Document ${documentId}`,
        content: data.content || 'No content available',
        tags: Array.isArray(data.tags) ? data.tags : [],
        originalUrl: data.normalized_original_url || data.original_url || null,
        pageCount: data.pageCount || 1,
      });
    } catch (error) {
      setDocPreview({
        title: `Document ${documentId}`,
        content: 'Preview unavailable.',
        tags: [],
        originalUrl: null,
        pageCount: 1
      });
    }
  }, []);

  type TextRagStatus = { available: boolean };
  const [localTextRagStatus, setLocalTextRagStatus] = useState(null as TextRagStatus | null);

  const initializeChat = useCallback(async (documentId: number) => {
    try {
      setStreamError(null);
      setStatusMessage('Initializing chat...');
      const fallbackTitle =
        documents.find((d: ChatDoc) => d.id === documentId)?.title ||
        `Document ${documentId}`;
      setSelectedDocumentTitle(fallbackTitle);
      setChatMessages([
        {
          id: makeId(),
          role: 'status',
          content: `Chat ready for ${fallbackTitle}.`
        }
      ]);

      try {
        const statusResponse = await fetch('/api/chat/status');
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData && statusData.rag) {
            setLocalTextRagStatus({
              available: Boolean(statusData.rag.available)
            });
          }
        }
      } catch (statusError) {
        console.warn('[Chat] Status check failed:', statusError);
      }

      await loadDocumentPreview(documentId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStreamError(message || 'Failed to initialize chat');
    } finally {
      setStatusMessage(null);
    }
  }, [documents, loadDocumentPreview]);

  useEffect(() => {
    if (selectedDocumentId) {
      void initializeChat(selectedDocumentId);
    } else {
      setChatMessages([]);
      setDocPreview({
        title: '',
        content: '',
        tags: [],
        originalUrl: null,
        pageCount: 1
      });
      setSelectedDocumentTitle('');
    }
  }, [selectedDocumentId]);

  useEffect(() => {
    setTextReingestStatus(null);
  }, [selectedDocumentId, chatMode]);

  const sendMessage = useCallback(async () => {
    // In RAG/Visual-RAG mode, we don't need a document; in Document mode, we do
    if (!messageInput.trim()) return;
    if (chatMode === 'document' && !selectedDocumentId) return;
    if (!selectedModel) return;

    const userMessage = messageInput.trim();
    setMessageInput('');
    setStreamError(null);

    const userEntry: ChatMessage = {
      id: makeId(),
      role: 'user',
      content: userMessage
    };
    const assistantEntryId = makeId();
    streamMessageIdRef.current = assistantEntryId;

    setChatMessages((prev: ChatMessage[]) => [
      ...prev,
      userEntry,
      {
        id: assistantEntryId,
        role: 'assistant',
        content: ''
      }
    ]);

    setIsStreaming(true);

    try {
      // Determine endpoint based on mode
      const endpoint = chatMode === 'rag'
        ? '/api/chat/rag'
        : chatMode === 'visual-rag'
        ? '/api/chat/visual-rag'
        : '/api/chat/document';
      
      // Build request payload based on mode
      let payload;
      if (chatMode === 'rag' || chatMode === 'visual-rag') {
        payload = {
          message: userMessage,
          model: selectedModel,
          history: chatMessages.slice(-10).map((m: ChatMessage) => ({ role: m.role, content: m.content }))
        };
      } else {
        // Document mode
        payload = {
          documentId: selectedDocumentId,
          message: userMessage,
          model: selectedModel,
          documentContext: {
            title: docPreview.title,
            content: docPreview.content,
            page: docPreview.pageCount
          },
          context: chatContext.length > 0 ? chatContext.map((c: ChatContextItem) => ({
            type: c.type,
            page: c.data?.page,
            excerpt: c.data?.text,
            imageBase64: c.data?.imageBase64
          })) : undefined
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (chatContext.length > 0) setChatContext([]); // Clear context after sending

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Chat request failed: ${response.status} - ${errorText}`);
      }

      // Handle RAG and Visual-RAG modes (non-streaming JSON response)
      if (chatMode === 'rag' || chatMode === 'visual-rag') {
        const data = await response.json();
        setChatMessages((prev: ChatMessage[]) =>
          prev.map((msg: ChatMessage) =>
            msg.id === assistantEntryId
              ? { 
                  ...msg, 
                  content: data.response || data.answer || 'No response received',
                  sources: data.sources || [],
                  searchMode: data.mode // 'hybrid' or 'text-fallback'
                }
              : msg
          )
        );
        return;
      }

      // Handle Document mode (JSON or streaming SSE response)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const data = await response.json().catch(() => ({}));
        setChatMessages((prev: ChatMessage[]) =>
          prev.map((msg: ChatMessage) =>
            msg.id === assistantEntryId
              ? {
                  ...msg,
                  content: data.response || data.answer || 'No response received'
                }
              : msg
          )
        );
        return;
      }
      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;

          interface StreamPayload {
            content?: string;
            error?: string;
          }
          let parsed: StreamPayload = { content: undefined };
          try {
            parsed = JSON.parse(payload) as StreamPayload;
          } catch (err) {
            parsed = { content: payload };
          }

          if (parsed.error) {
            setStreamError(parsed.error);
            continue;
          }

          if (parsed.content) {
            setChatMessages((prev: ChatMessage[]) =>
              prev.map((msg: ChatMessage) =>
                msg.id === assistantEntryId
                  ? { ...msg, content: msg.content + parsed.content }
                  : msg
              )
            );
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStreamError(message || 'Failed to stream response');
    } finally {
      setIsStreaming(false);
    }
  }, [messageInput, selectedDocumentId, selectedModel, chatMode, chatContext, chatMessages, docPreview]);

  const handleTextReingest = useCallback(async () => {
    if (!selectedDocumentId || textReingestBusy) return;
    const confirmed = window.confirm(
      'This will re-index the document text. Continue?'
    );
    if (!confirmed) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REINGEST_TIMEOUT_MS
    );

    setTextReingestBusy(true);
    setTextReingestStatus(
      `Reingesting text index for document #${selectedDocumentId}...`
    );

    try {
      const response = await fetch(`/api/rag/reingest/${selectedDocumentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({} as {
        error?: string;
        message?: string;
      }));
      if (!response.ok) {
        throw new Error(
          payload.error || `Request failed (${response.status})`
        );
      }

      setTextReingestStatus(
        payload.message ||
          `Text reingest started for document #${selectedDocumentId}.`
      );
    } catch (reingestError: unknown) {
      const message = reingestError instanceof Error
        ? reingestError.message
        : String(reingestError);
      setTextReingestStatus(`Text reingest failed: ${message}`);
    } finally {
      window.clearTimeout(timeoutId);
      setTextReingestBusy(false);
    }
  }, [selectedDocumentId, textReingestBusy]);



  return (
    <div data-testid="chat-workspace-root" data-hydrated="true" className="sg-shell">
      <div className="guided-rail" data-testid="chat-guided-rail">
        <div className="guided-rail__label">Guided Rail</div>
        <div className="guided-rail__text">{guidedStep}</div>
        {statusMessage && (
          <div className="guided-rail__status">{statusMessage}</div>
        )}
      </div>

      <div className="material-card sg-card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="sg-label">
              Document
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#fdfaf6] border border-[#e5e0d8] rounded-lg" data-testid="chat-document-title">
              <i className="fas fa-file-alt text-[#b87333]"></i>
              <span className="font-['Space_Grotesk'] font-medium text-[#2c2c2c]">
                {selectedDocumentId 
                  ? (selectedDocumentTitle || documents.find(d => d.id === selectedDocumentId)?.title || `Document #${selectedDocumentId}`)
                  : 'No document selected'
                }
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-[220px]">
            {/* Provider Indicator */}
            <div className="mb-2 flex items-center gap-2 text-xs text-[#666]" data-testid="chat-provider-indicator">
              <span className="font-medium">Provider:</span>
              <span className="px-2 py-1 bg-[#f5f0e8] rounded-md font-mono">
                {props.modelConfig?.currentProvider || aiProvider || 'ollama'}
              </span>
            </div>

            <label className="sg-label" htmlFor="chat-model-select">
              Model
            </label>

            {isModelLoading ? (
              <div data-testid="chat-model-loading" className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <div className="text-sm text-gray-600">Loading models...</div>
              </div>
            ) : modelLoadError ? (
              <div className="text-sm text-red-600">
                <div data-testid="chat-model-error">{modelLoadError}</div>
                <button
                  className="mt-2 sg-link"
                  onClick={() => void loadOllamaModels()}
                  data-testid="chat-model-retry"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <select
                    id="chat-model-select"
                    data-testid="chat-model-select"
                    className="sg-select"
                    value={selectedModel ?? ''}
                    onFocus={() => { if (!modelOptions.length) void loadOllamaModels(); }}
                    onChange={async (e: Event) => {
                      const value = (e.target as HTMLSelectElement).value || null;
                      setSelectedModel(value);

                      // For Ollama we still have a verification endpoint; for other providers we skip verification
                      const cfgProvider = (props.modelConfig && props.modelConfig.currentProvider) || aiProvider;
                      if (value && cfgProvider === 'ollama') {
                        const result = await verifyModel(value);
                        if (!result.ok) {
                          console.warn('[Model Verify] verify failed:', result);
                        } else if (result.data) {
                          console.info('[Model Verify] verify result:', result.data);
                          if (!result.data.installed && !result.data.loaded) {
                            setModelLoadError(`Model ${value} not installed/loaded on Ollama.`);
                          } else {
                            setModelLoadError(null);
                          }
                        }
                      }
                    }}
                  >
                    {filteredModelOptions.length === 0 && (
                      <option value="">No models available for {props.modelConfig?.currentProvider || aiProvider}</option>
                    )}
                    {filteredModelOptions.map((group: OllamaModelGroup) => (
                      <optgroup label={group.label} key={group.label}>
                        {group.models.map((model: { label: string; model: string; placeholder?: boolean }) => (
                          <option value={model.model} key={model.model}>
                            {model.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* Text-RAG status indicator */}
                  {((props.textRagStatus && props.textRagStatus.available === false) || (localTextRagStatus && localTextRagStatus.available === false)) && (
                    <div data-testid="chat-text-rag-status" className="text-sm text-red-600">Text-RAG unavailable</div>
                  )}
                </div>

                <p className="sg-helper">
                  Installed, expert, and configured placeholders are listed. Select to use.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="material-card sg-card sg-card--workspace">
        <div className="sg-tab-panel">
            {/* Chat Mode Toggle */}
            <div className="mb-4 flex flex-wrap items-center gap-3 p-3 bg-[#f5f0e8] rounded-lg border border-[#e5e0d8]" data-testid="chat-mode-toggle">
              <span className="text-sm font-medium text-[#555]">Chat Mode:</span>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setChatMode('rag')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    chatMode === 'rag'
                      ? 'bg-[#b87333] text-white'
                      : 'bg-white text-[#555] border border-[#e5e0d8] hover:bg-[#fdfaf6]'
                  }`}
                  data-testid="chat-mode-rag"
                  title="Text-only semantic search across all documents"
                >
                  📝 Text Search
                </button>

                <button
                  type="button"
                  onClick={() => setChatMode('visual-rag')}
                  disabled={!visualRagAvailable && visualRagStatus !== 'initializing'}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    chatMode === 'visual-rag'
                      ? 'bg-[#b87333] text-white'
                      : 'bg-white text-[#555] border border-[#e5e0d8] hover:bg-[#fdfaf6]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  data-testid="chat-mode-visual-rag"
                  title={
                    visualRagStatus === 'initializing'
                      ? 'Visual-RAG sidecar initializing (GPU warmup)'
                      : !visualRagAvailable
                      ? 'Visual-RAG sidecar unavailable'
                      : 'Hybrid text + visual search (tables, charts, images)'
                  }
                >
                  🎨 Visual Search
                  {visualRagStatus === 'initializing' && (
                    <span className="ml-1 animate-pulse">⏳</span>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => setChatMode('document')}
                  disabled={!isDocumentLoaded}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    chatMode === 'document'
                      ? 'bg-[#b87333] text-white'
                      : 'bg-white text-[#555] border border-[#e5e0d8] hover:bg-[#fdfaf6]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  data-testid="chat-mode-document"
                  title={!isDocumentLoaded ? 'Load a document to use Document Chat' : 'Chat about the selected document'}
                >
                  📄 Document Chat
                </button>
              </div>
              
              {chatMode === 'document' && isDocumentLoaded && (
                <span className="ml-auto text-xs text-[#888]" data-testid="chat-mode-doc-indicator">
                  Chatting about: <strong>{selectedDocumentTitle || `Doc #${selectedDocumentId}`}</strong>
                </span>
              )}
              
              {chatMode === 'rag' && (
                <span className="ml-auto text-xs text-[#888]" data-testid="chat-mode-rag-indicator">
                  Searching documents by text content
                </span>
              )}

              {chatMode === 'visual-rag' && (
                <span className="ml-auto text-xs text-[#888]" data-testid="chat-mode-visual-indicator">
                  {visualRagStatus === 'initializing' ? (
                    <span className="text-orange-600">⏳ GPU warming up (~30s)...</span>
                  ) : !visualRagAvailable ? (
                    <span className="text-orange-600">⚠️ Visual-RAG unavailable - using text fallback</span>
                  ) : (
                    'Searching by visual content (tables, charts, images)'
                  )}
                </span>
              )}
            </div>

            {/* RAG mode: always available */}
            {chatMode === 'rag' && (
              <div className="sg-chat-panel">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-[#777]">Text Search</span>
                  <button
                    type="button"
                    className="rounded-md border border-[#e5e0d8] px-2 py-1 text-xs text-[#666] hover:bg-[#f5f0e8] disabled:opacity-60 disabled:cursor-not-allowed"
                    data-testid="chat-reingest-text-btn"
                    disabled={!selectedDocumentId || textReingestBusy}
                    onClick={() => void handleTextReingest()}
                    title={
                      !selectedDocumentId
                        ? 'Select a document first'
                        : 'Re-index text embeddings for this document'
                    }
                  >
                    {textReingestBusy ? 'Reingesting...' : 'Reingest Text'}
                  </button>
                </div>
                {textReingestStatus && (
                  <div
                    className="mb-2 text-xs text-[#8a5a2f]"
                    data-testid="chat-reingest-text-status"
                  >
                    {textReingestStatus}
                  </div>
                )}
                <div
                  ref={chatHistoryRef}
                  className="sg-chat-history"
                  data-testid="chat-history"
                >
                  {chatMessages.length === 0 && (
                    <div className="sg-empty" data-testid="chat-rag-empty">
                      Ask a question to search across all your documents.
                    </div>
                  )}
                  {chatMessages.map((msg: ChatMessage) => (
                    <div
                      key={msg.id}
                      className={`sg-message sg-message--${msg.role} ${msg.isError ? 'sg-message--error' : ''}`}
                      data-testid={`chat-message-${msg.role}`}
                      ref={(el: HTMLDivElement | null) => {
                        if (msg.role === 'assistant' && el) {
                          highlightBlocks(el);
                        }
                      }}
                    >
                      <div dangerouslySetInnerHTML={{ __html: safeMarkdown(msg.content) }} />
                      
                      {/* Show sources for RAG responses */}
                      {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#e5e0d8]" data-testid="chat-sources">
                          <div className="text-xs font-medium text-[#888] mb-2">Sources:</div>
                          <div className="space-y-1">
                            {msg.sources.map((source, sidx) => (
                              <a
                                key={sidx}
                                href={`/workspace/doc/${source.documentId}`}
                                className="block text-xs text-[#b87333] hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`chat-source-${sidx}`}
                              >
                                📄 {source.title || `Document #${source.documentId}`}
                                {source.page ? ` (Page ${source.page})` : ''}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {streamError && (
                    <div className="sg-message sg-message--error" data-testid="chat-error">
                      {streamError}
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="sg-chat-input">
                  <textarea
                    data-testid="chat-input"
                    className="sg-textarea"
                    placeholder='Ask questions across all documents... (e.g., "Find invoices over $1000")'
                    value={messageInput}
                    onInput={(e: Event) => setMessageInput((e.target as HTMLTextAreaElement).value)}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isStreaming) void sendMessage();
                      }
                    }}
                    rows={2}
                  />
                  <button
                    data-testid="chat-send-button"
                    type="button"
                    className="sg-primary"
                    disabled={!messageInput.trim() || isStreaming || !selectedModel}
                    onClick={() => void sendMessage()}
                  >
                    {isStreaming ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>
            )}

            {/* Visual RAG mode: hybrid text + visual search */}
            {chatMode === 'visual-rag' && (
              <div className="sg-chat-panel">
                <div
                  ref={chatHistoryRef}
                  className="sg-chat-history"
                  data-testid="chat-history-visual"
                >
                  {chatMessages.length === 0 && (
                    <div className="sg-empty" data-testid="chat-visual-empty">
                      Search for visual content like tables, charts, and images across your documents.
                    </div>
                  )}
                  {chatMessages.map((msg: ChatMessage) => (
                    <div
                      key={msg.id}
                      className={`sg-message sg-message--${msg.role} ${msg.isError ? 'sg-message--error' : ''}`}
                      data-testid={`chat-message-${msg.role}`}
                      ref={(el: HTMLDivElement | null) => {
                        if (msg.role === 'assistant' && el) {
                          highlightBlocks(el);
                        }
                      }}
                    >
                      <div dangerouslySetInnerHTML={{ __html: safeMarkdown(msg.content) }} />
                      
                      {/* Show search mode indicator */}
                      {msg.role === 'assistant' && msg.searchMode && (
                        <div className="mt-2 text-xs text-[#888]">
                          {msg.searchMode === 'hybrid' ? '🎨 Hybrid search' : '📝 Text fallback'}
                        </div>
                      )}
                      
                      {/* Show sources for Visual RAG responses */}
                      {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#e5e0d8]" data-testid="chat-sources-visual">
                          <div className="text-xs font-medium text-[#888] mb-2">Sources:</div>
                          <div className="space-y-2">
                            {msg.sources.map((source, sidx) => (
                              <div key={sidx} className="flex items-start gap-3">
                                {/* Thumbnail if available */}
                                {source.thumbnailUrl && (
                                  <a
                                    href={`/workspace/doc/${source.documentId}${source.page ? `?page=${source.page}` : ''}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0"
                                    data-testid={`chat-source-thumbnail-${sidx}`}
                                  >
                                    <img
                                      src={source.thumbnailUrl}
                                      alt={`Page ${source.page || 1} thumbnail`}
                                      className="w-12 h-16 object-cover rounded border border-[#e5e0d8] hover:border-[#b87333] transition-colors"
                                      loading="lazy"
                                    />
                                  </a>
                                )}
                                <div className="flex flex-col gap-1">
                                  <a
                                    href={`/workspace/doc/${source.documentId}`}
                                    className="text-xs text-[#b87333] hover:underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    data-testid={`chat-source-visual-${sidx}`}
                                  >
                                    📄 {source.title || `Document #${source.documentId}`}
                                    {source.page ? ` (p${source.page})` : ''}
                                  </a>
                                  {/* Show visual and text scores if available */}
                                  {(source.visualScore !== undefined || source.textScore !== undefined) && (
                                    <span className="text-xs text-[#999]">
                                      {source.visualScore !== undefined && (
                                        <span className="mr-2">Visual: {Math.round(source.visualScore * 100)}%</span>
                                      )}
                                      {source.textScore !== undefined && (
                                        <span>Text: {Math.round(source.textScore * 100)}%</span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {streamError && (
                    <div className="sg-message sg-message--error" data-testid="chat-error-visual">
                      {streamError}
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="sg-chat-input">
                  <textarea
                    data-testid="chat-input-visual"
                    className="sg-textarea"
                    placeholder='Search by visual content... (e.g., "Find documents with tables" or "Show invoices with charts")'
                    value={messageInput}
                    onInput={(e: Event) => setMessageInput((e.target as HTMLTextAreaElement).value)}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isStreaming) void sendMessage();
                      }
                    }}
                    rows={2}
                  />
                  <button
                    data-testid="chat-send-button-visual"
                    type="button"
                    className="sg-primary"
                    disabled={!messageInput.trim() || isStreaming || !selectedModel}
                    onClick={() => void sendMessage()}
                  >
                    {isStreaming ? 'Searching...' : 'Visual Search'}
                  </button>
                </div>
              </div>
            )}

            {/* Document mode: requires selected document */}
            {chatMode === 'document' && !selectedDocumentId && (
              <div className="sg-empty" data-testid="chat-empty-state">
                Select a document above to start a conversation.
              </div>
            )}

            {chatMode === 'document' && selectedDocumentId && (
              <div className="sg-chat-panel">
                <div
                  ref={chatHistoryRef}
                  className="sg-chat-history"
                  data-testid="chat-history"
                >
                  {chatMessages.map((msg: ChatMessage) => (
                    <div
                      key={msg.id}
                      className={`sg-message sg-message--${msg.role}`}
                      data-testid={`chat-message-${msg.role}`}
                      ref={(el: HTMLDivElement | null) => {
                        if (msg.role === 'assistant' && el) {
                          highlightBlocks(el);
                        }
                      }}
                      dangerouslySetInnerHTML={{
                        __html: msg.role === 'assistant'
                          ? safeMarkdown(msg.content).replace(/\[visual:(\d+)\/(\d+)\/(.*?)\]/g, (match: string, docId: string, pg: string, bbox: string) => {
                              return `<a href="/workspace/doc/${docId}?tab=visual&page=${pg}" class="text-blue-600 hover:underline inline-flex items-center gap-1" title="View in Workspace"><i class="fas fa-search"></i> Visual Reference (Page ${pg})</a>`;
                            })
                          : msg.content
                      }}
                    />
                  ))}
                  {streamError && (
                    <div className="sg-message sg-message--error">
                      {streamError}
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="sg-chat-input">
                  <textarea
                    data-testid="chat-input"
                    className="sg-textarea"
                    placeholder='Ask questions about this document... (e.g., "What is the due date?")'
                    value={messageInput}
                    onInput={(e: Event) => setMessageInput((e.target as HTMLTextAreaElement).value)}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isStreaming) void sendMessage();
                      }
                    }}
                    rows={2}
                  />
                  <button
                    data-testid="chat-send-button"
                    type="button"
                    className="sg-primary"
                    disabled={!messageInput.trim() || isStreaming}
                    onClick={() => void sendMessage()}
                  >
                    {isStreaming ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
