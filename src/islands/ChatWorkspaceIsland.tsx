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
    provider?: string;
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

const isVisionCapableModel = (modelName: string | null | undefined) => {
  const model = String(modelName || '').toLowerCase();
  if (!model) return false;
  return (
    model.includes('vl') ||
    model.includes('vision') ||
    model.includes('llava') ||
    model.includes('pixtral') ||
    model.includes('gpt-4o') ||
    model.includes('gemini')
  );
};

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
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(CHAT_MODE_STORAGE_KEY);
        if (
          stored === 'rag' ||
          stored === 'visual-rag' ||
          stored === 'document'
        ) {
          // Don't restore 'document' mode if no document is loaded
          if (stored === 'document' && !props.openDocumentId) {
            return 'rag';
          }
          return stored;
        }
      } catch (_error) {
        // Local storage may be unavailable in some test/browser contexts.
      }
    }
    return 'rag';
  };
  const [chatMode, setChatModeInternal] = useState(getInitialChatMode);
  
  // Wrapper to persist chat mode to localStorage
  const setChatMode = (mode: ChatMode) => {
    setChatModeInternal(mode);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(CHAT_MODE_STORAGE_KEY, mode);
      } catch (_error) {
        // ignore localStorage write failures
      }
    }
  };
  
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(Boolean(props.openDocumentId));
  const [visualRagAvailable, setVisualRagAvailable] = useState(false);
  const [visualRagStatus, setVisualRagStatus] = useState('checking' as 'checking' | 'available' | 'unavailable' | 'initializing');

  const [guidedStep, setGuidedStep] = useState('Select a document to begin.');
  const [statusMessage, setStatusMessage] = useState(null as string | null);
  const [textReingestBusy, setTextReingestBusy] = useState(false);
  const [_textReingestStatus, setTextReingestStatus] = useState(
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
  const activeProvider = (
    props.modelConfig?.currentProvider || aiProvider || 'ollama'
  ).toLowerCase();

  // Filter models by current provider and active chat mode.
  const filteredModelOptions = useMemo(() => {
    if (!modelOptions || modelOptions.length === 0) return [];

    const providerName = activeProvider;

    // 1) Filter model entries by provider.
    // Keep legacy group-label matching as a fallback for older payloads.
    const providerFiltered = modelOptions
      .map((group: OllamaModelGroup) => {
        const groupLabel = group.label.toLowerCase();
        const models = group.models.filter((entry) => {
          if (entry.provider) {
            const entryProvider = entry.provider.toLowerCase();
            return (
              entryProvider === providerName ||
              (entryProvider === 'expert' && providerName === 'ollama')
            );
          }
          return (
            groupLabel.includes(providerName) ||
            (groupLabel.includes('expert') && providerName === 'ollama') ||
            groupLabel.includes('installed') ||
            groupLabel.includes('configured')
          );
        });
        return { ...group, models };
      })
      .filter((group) => group.models.length > 0);

    // 2) Mode-specific availability:
    // Document mode supports multimodal context, so surface only vision-capable
    // models. Other modes keep provider-filtered options.
    if (chatMode !== 'document') {
      return providerFiltered;
    }

    return providerFiltered
      .map((group) => ({
        ...group,
        models: group.models.filter((entry) =>
          isVisionCapableModel(entry.model)
        )
      }))
      .filter((group) => group.models.length > 0);
  }, [
    modelOptions,
    props.modelConfig?.currentProvider,
    aiProvider,
    chatMode,
    activeProvider
  ]);

  const selectedModelIsValid = useMemo(() => {
    if (!selectedModel) return false;
    return filteredModelOptions.some((group: OllamaModelGroup) =>
      group.models.some((m: { model: string }) => m.model === selectedModel)
    );
  }, [filteredModelOptions, selectedModel]);

  // Update selected model when provider changes
  useEffect(() => {
    if (selectedModelIsValid) return;

    if (filteredModelOptions.length > 0) {
      // Auto-select first available model for new provider/mode.
      const firstModel = filteredModelOptions[0]?.models[0]?.model || null;
      if (firstModel) {
        setSelectedModel(firstModel);
        console.log(
          `[Chat] Provider changed to ${activeProvider}, auto-selected model: `
          + `${firstModel}`
        );
      }
      return;
    }

    // If no models are available for the active provider/mode, clear stale value.
    if (selectedModel !== null) {
      setSelectedModel(null);
    }
  }, [
    props.modelConfig?.currentProvider,
    aiProvider,
    filteredModelOptions,
    selectedModel,
    activeProvider,
    selectedModelIsValid
  ]);

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
      // Build groups by capability for better intuition (P3-T2)
      const providers = props.modelConfig.providers || {};
      const providerDefaults = props.modelConfig.defaultModels || {};
      const providerModels = Object.entries(providers).flatMap(
        ([providerName, entries]) => (entries || []).map((modelName) => ({
          provider: String(providerName).toLowerCase(),
          model: modelName,
        }))
      );
      const expertRaw = (props.modelConfig.expertModels || []) as Array<{ label?: string; model: string }>;
      
      const groups: OllamaModelGroup[] = [];

      // 1. Reasoning Models (High capability)
      const reasoningModels = providerModels.filter(entry => 
        entry.model.toLowerCase().includes('llama3.1') || 
        entry.model.toLowerCase().includes('qwen') || 
        entry.model.toLowerCase().includes('o1') ||
        entry.model.toLowerCase().includes('thought')
      );
      if (reasoningModels.length) {
        groups.push({
          label: 'Reasoning Models',
          models: reasoningModels.map(entry => ({
            label: entry.model,
            model: entry.model,
            provider: entry.provider,
          }))
        });
      }

      // 2. Vision / Multimodal Models
      const visionModels = providerModels.filter(entry => 
        entry.model.toLowerCase().includes('vl') || 
        entry.model.toLowerCase().includes('vision') || 
        entry.model.toLowerCase().includes('llava') ||
        entry.model.toLowerCase().includes('pixtral')
      );
      if (visionModels.length) {
        groups.push({
          label: 'Multimodal / Vision Models',
          models: visionModels.map(entry => ({
            label: entry.model,
            model: entry.model,
            provider: entry.provider,
          }))
        });
      }

      // 3. Expert Models
      if (expertRaw.length) {
        groups.push({
          label: 'Expert Specialized Models',
          models: expertRaw.map(entry => ({
            label: entry.label ? `${entry.label} (${entry.model})` : entry.model,
            model: entry.model,
            provider: 'expert',
          }))
        });
      }

      // 4. Other Models (Catch-all)
      const categorized = new Set([
        ...reasoningModels.map((entry) => `${entry.provider}:${entry.model}`),
        ...visionModels.map((entry) => `${entry.provider}:${entry.model}`),
      ]);
      const others = providerModels.filter((entry) => (
        !categorized.has(`${entry.provider}:${entry.model}`)
      ));
      if (others.length) {
        groups.push({
          label: 'General Purpose Models',
          models: others.map(entry => ({
            label: entry.model,
            model: entry.model,
            provider: entry.provider,
          }))
        });
      }

      setModelOptions(groups);

      // Default selection: prefer modelConfig.currentProvider default if present
      const providerKey = (
        props.modelConfig?.currentProvider || aiProvider || 'ollama'
      ).toLowerCase();
      const providerModelsForKey = Array.isArray(providers[providerKey])
        ? providers[providerKey]
        : [];
      const providerDefaultModel = providerDefaults[providerKey];
      const defaultModel = providerDefaultModel
        || providerModelsForKey[0]
        || (providerKey === 'ollama' ? props.ollamaDefaultModel : null);
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

      // Group models by capability for intuition (P3-T2)
      const groups: OllamaModelGroup[] = [];
      const allAvailable = Array.from(new Set([...Array.from(installedSet), ...placeholderEntries]));

      // 1. Reasoning Models
      const reasoning = allAvailable.filter(m => 
        m.toLowerCase().includes('llama3.1') || m.toLowerCase().includes('qwen') || m.toLowerCase().includes('o1') || m.toLowerCase().includes('thought')
      );
      if (reasoning.length) {
        groups.push({
          label: 'Reasoning Models',
          models: reasoning.map(m => ({
            label: m,
            model: m,
            placeholder: placeholderEntries.includes(m),
            provider: 'ollama',
          }))
        });
      }

      // 2. Vision Models
      const vision = allAvailable.filter(m => 
        m.toLowerCase().includes('vl') || m.toLowerCase().includes('vision') || m.toLowerCase().includes('llava')
      );
      if (vision.length) {
        groups.push({
          label: 'Multimodal / Vision Models',
          models: vision.map(m => ({
            label: m,
            model: m,
            placeholder: placeholderEntries.includes(m),
            provider: 'ollama',
          }))
        });
      }

      // 3. Expert Models (Explicitly registered)
      if (expertEntries.length) {
        groups.push({
          label: 'Expert Specialized Models',
          models: expertEntries.map((entry: ExpertModelEntry) => ({
            label: entry.label ? `${entry.label} (${entry.model})` : entry.model,
            model: entry.model,
            provider: 'expert',
          })),
        });
      }

      // 4. Others
      const categorized = new Set([...reasoning, ...vision, ...expertEntries.map(e => e.model)]);
      const others = allAvailable.filter(m => !categorized.has(m));
      if (others.length) {
        groups.push({
          label: 'General Purpose Models',
          models: others.map(m => ({ 
            label: m, 
            model: m, 
            placeholder: placeholderEntries.includes(m),
            provider: 'ollama',
          }))
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
    if (!selectedModel || !selectedModelIsValid) return;

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
      
      // Multimodal logic: Check if selected model is vision-capable (P3-T3)
      const isVisionCapable = isVisionCapableModel(selectedModel);
      
      let multimodalContext = [...chatContext];
      
      // In document mode with a vision model, auto-attach document image if not present
      if (chatMode === 'document' && isVisionCapable && selectedDocumentId) {
        const hasImage = multimodalContext.some(ctx => ctx.type === 'visual' && ctx.data?.imageBase64);
        if (!hasImage) {
          try {
            // Fetch document image context
            const imgResp = await fetch(`/api/documents/${selectedDocumentId}/content`);
            if (imgResp.ok) {
              const imgData = await imgResp.json();
              const firstPageB64 = imgData.document?.renderedPages?.[0]?.base64;
              if (firstPageB64) {
                multimodalContext.push({
                  type: 'visual',
                  documentId: selectedDocumentId,
                  data: { imageBase64: firstPageB64, page: 1 }
                });
              }
            }
          } catch (e) {
            console.warn('[Chat] Failed to auto-attach document image for vision model', e);
          }
        }
      }

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
          context: multimodalContext.length > 0 ? multimodalContext.map((c: ChatContextItem) => ({
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
  }, [
    messageInput,
    selectedDocumentId,
    selectedModel,
    selectedModelIsValid,
    chatMode,
    chatContext,
    chatMessages,
    docPreview
  ]);

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
    <div data-testid="chat-workspace-root" data-hydrated="true" className="flex flex-col gap-6 h-full">
      {/* ── GUIDED RAIL ── */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4" data-testid="chat-guided-rail">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-cyan-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Guided Rail</span>
        </div>
        <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight truncate">{guidedStep}</div>
        {statusMessage && (
          <div className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest animate-pulse">{statusMessage}</div>
        )}
      </div>

      {/* ── CONTROL PANEL ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm p-5 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Primary Document</label>
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl" data-testid="chat-document-title">
              <i className="fas fa-file-invoice text-cyan-600 dark:text-cyan-400"></i>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {selectedDocumentId 
                  ? (selectedDocumentTitle || documents.find(d => d.id === selectedDocumentId)?.title || `DOC_ID: ${selectedDocumentId}`)
                  : 'NO_DOCUMENT_LOADED'
                }
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest" htmlFor="chat-model-select">Neural Model</label>
              <div
                className="flex items-center gap-2 px-2 py-0.5 bg-indigo-500/10 rounded-md border border-indigo-500/20"
                data-testid="chat-provider-indicator"
              >
                <span className="text-[8px] font-black text-indigo-500 uppercase">Provider:</span>
                <span className="text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">
                  {activeProvider}
                </span>
              </div>
            </div>

            {isModelLoading ? (
              <div data-testid="chat-model-loading" className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl">
                <i className="fas fa-circle-notch fa-spin text-cyan-500"></i>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Weights...</div>
              </div>
            ) : modelLoadError ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <div className="text-[10px] font-bold text-rose-600 truncate uppercase" data-testid="chat-model-error">{modelLoadError}</div>
                <button
                  className="text-[9px] font-black uppercase text-rose-700 underline"
                  onClick={() => void loadOllamaModels()}
                  data-testid="chat-model-retry"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <select
                    id="chat-model-select"
                    data-testid="chat-model-select"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/20 appearance-none transition-all"
                    value={selectedModel ?? ''}
                    onFocus={() => { if (!modelOptions.length) void loadOllamaModels(); }}
                    onChange={async (e: Event) => {
                      const value = (e.target as HTMLSelectElement).value || null;
                      setSelectedModel(value);
                      const cfgProvider = (props.modelConfig && props.modelConfig.currentProvider) || aiProvider;
                      if (value && cfgProvider === 'ollama') {
                        const result = await verifyModel(value);
                        if (result.ok && result.data && !result.data.installed && !result.data.loaded) {
                          setModelLoadError(`Model ${value} not verified on Ollama cluster.`);
                        } else {
                          setModelLoadError(null);
                        }
                      }
                    }}
                  >
                    {filteredModelOptions.length === 0 && (
                      <option value="">
                        {`No models available for ${activeProvider} in ${chatMode} mode`}
                      </option>
                    )}
                    {filteredModelOptions.map((group: OllamaModelGroup) => (
                      <optgroup label={group.label.toUpperCase()} key={group.label} data-testid={`model-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`} className="text-[10px] font-black tracking-widest bg-slate-100 dark:bg-slate-900">
                        {group.models.map((model: { label: string; model: string; placeholder?: boolean }) => (
                          <option value={model.model} key={model.model} data-testid={`model-option-${model.model}`} className="text-sm font-bold">
                            {model.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <i className="fas fa-chevron-down text-xs"></i>
                  </div>
                </div>
                {/* Text RAG Status */}
                {((props.textRagStatus && props.textRagStatus.available === false) || (localTextRagStatus && localTextRagStatus.available === false)) && (
                  <div data-testid="chat-text-rag-status" className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                    <i className="fas fa-triangle-exclamation"></i>
                    Text Search Indexing Unavailable
                  </div>
                )}
                
                {/* Visual RAG Status (P3-T1) */}
                {visualRagStatus === 'unavailable' && (
                  <div data-testid="chat-visual-rag-status" className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                    <i className="fas fa-camera-slash"></i>
                    Visual Discovery Sidecar Offline
                  </div>
                )}
                {visualRagStatus === 'initializing' && (
                  <div data-testid="chat-visual-rag-status" className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                    <i className="fas fa-bolt-lightning"></i>
                    GPU Warming Up (~30s)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CHAT ENGINE ── */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm overflow-hidden">
        {/* Mode Toggles */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3" data-testid="chat-mode-toggle">
          <div className="flex gap-1.5 bg-slate-200/50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setChatMode('rag')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                chatMode === 'rag'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              data-testid="chat-mode-rag"
            >
              <i className="fas fa-file-lines mr-2"></i>
              Text Search
            </button>

            <button
              type="button"
              onClick={() => setChatMode('visual-rag')}
              disabled={!visualRagAvailable && visualRagStatus !== 'initializing'}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                chatMode === 'visual-rag'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              } disabled:opacity-50 disabled:grayscale`}
              data-testid="chat-mode-visual-rag"
            >
              <i className={`fas ${visualRagStatus === 'initializing' ? 'fa-circle-notch fa-spin' : 'fa-wand-sparkles'} mr-2`}></i>
              Visual RAG
            </button>
            
            <button
              type="button"
              onClick={() => setChatMode('document')}
              disabled={!isDocumentLoaded}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                chatMode === 'document'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              } disabled:opacity-50 disabled:grayscale`}
              data-testid="chat-mode-document"
            >
              <i className="fas fa-file-invoice mr-2"></i>
              Doc Context
            </button>
          </div>
          
          <div className="ml-auto hidden sm:block">
            {chatMode === 'document' && isDocumentLoaded && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest" data-testid="chat-mode-doc-indicator">
                Context: <strong className="text-cyan-600 dark:text-cyan-400">{selectedDocumentTitle || `DOC_${selectedDocumentId}`}</strong>
              </span>
            )}
            
            {chatMode === 'rag' && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest" data-testid="chat-mode-rag-indicator">
                Multimodal Vector Corpus Active
              </span>
            )}

            {chatMode === 'visual-rag' && (
              <span className="text-[10px] font-bold uppercase tracking-widest" data-testid="chat-mode-visual-indicator">
                {visualRagStatus === 'initializing' ? (
                  <span className="text-amber-500 animate-pulse flex items-center gap-2"><i className="fas fa-bolt-lightning"></i> GPU warming up (~30s)</span>
                ) : !visualRagAvailable ? (
                  <span className="text-rose-500 flex items-center gap-2"><i className="fas fa-triangle-exclamation"></i> Sidecar Unavailable</span>
                ) : (
                  <span className="text-emerald-500 flex items-center gap-2"><i className="fas fa-microchip"></i> ColQwen3-VLM Protocol</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* History Area */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6 custom-scrollbar" ref={chatHistoryRef} data-testid="chat-history">
          {chatMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800">
                <i className="fas fa-terminal text-2xl text-slate-300"></i>
              </div>
              <div className="max-w-xs">
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Neural Connection Established</p>
                <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-tight">Initiate query to begin document topology synthesis.</p>
              </div>
            </div>
          )}
          
          <div className="space-y-8">
            {chatMessages.map((msg: ChatMessage) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                data-testid={`chat-message-${msg.role}`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm ${msg.role === 'user' ? 'bg-indigo-500 text-white border-indigo-400' : msg.role === 'assistant' ? 'bg-cyan-500 text-white border-cyan-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                  <i className={`fas ${msg.role === 'user' ? 'fa-user' : msg.role === 'assistant' ? 'fa-robot' : 'fa-info'} text-xs`}></i>
                </div>
                
                <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'items-end text-right' : 'items-start text-left'}`}>
                  <div className={`text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1`}>{msg.role}</div>
                  <div 
                    className={`rounded-2xl p-4 text-sm leading-relaxed shadow-sm border ${msg.role === 'user' ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-indigo-50' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-cyan-50'}`}
                    ref={(el: HTMLDivElement | null) => { if (msg.role === 'assistant' && el) highlightBlocks(el); }}
                    dangerouslySetInnerHTML={{
                      __html: msg.role === 'assistant'
                        ? safeMarkdown(msg.content).replace(/\[visual:(\d+)\/(\d+)\/(.*?)\]/g, (_match: string, docId: string, pg: string, _bbox: string) => {
                            return `<a href="/workspace/doc/${docId}?tab=visual&page=${pg}" class="text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 font-bold" title="View Spatial Reference"><i class="fas fa-crosshairs"></i> REGION_REF(P${pg})</a>`;
                          })
                        : safeMarkdown(msg.content)
                    }}
                  />
                  
                  {/* Sources Display (P3-T4) */}
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 space-y-3" data-testid="chat-sources">
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Contextual Anchors</span>
                        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {msg.sources.map((source, sidx) => {
                          const workspaceUrl = `/workspace/doc/${source.documentId}?tab=${source.visualScore !== undefined ? 'visual' : 'metadata'}${source.page ? `&page=${source.page}` : ''}`;
                          return (
                            <div key={sidx} data-testid={`chat-source-${source.documentId}-${sidx}`} className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:border-cyan-500/30">
                              {source.thumbnailUrl ? (
                                <a href={workspaceUrl} data-testid={`chat-source-thumb-${source.documentId}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                  <img src={source.thumbnailUrl} alt="source" className="w-10 h-12 object-cover rounded border border-slate-200 dark:border-slate-700" loading="lazy" />
                                </a>
                              ) : (
                                <div className="w-10 h-12 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                  <i className="fas fa-file-invoice text-slate-400 text-xs"></i>
                                </div>
                              )}
                              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                                <a href={workspaceUrl} data-testid={`chat-source-title-${source.documentId}`} className="text-[10px] font-bold text-slate-900 dark:text-slate-100 hover:text-cyan-500 truncate" target="_blank" rel="noopener noreferrer">
                                  {source.title || `DOC_${source.documentId}`}
                                </a>
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] font-black text-slate-400 uppercase">{source.page ? `Page ${source.page}` : 'Metadata'}</span>
                                  {source.visualScore !== undefined && (
                                    <span className="text-[8px] font-black text-cyan-500 uppercase">VISUAL: {Math.round(source.visualScore * 100)}%</span>
                                  )}
                                  {source.textScore !== undefined && (
                                    <span className="text-[8px] font-black text-indigo-500 uppercase">TEXT: {Math.round(source.textScore * 100)}%</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {streamError && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[11px] font-bold uppercase tracking-widest" data-testid="chat-error">
                <i className="fas fa-circle-xmark"></i>
                STREAM_FAILURE: {streamError}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-4">
            <div className="relative group">
              <textarea
                data-testid="chat-input"
                className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all placeholder:text-slate-400 resize-none min-h-[100px]"
                placeholder={chatMode === 'rag' ? 'Execute global corpus search query...' : 'Initiate document context analysis...'}
                value={messageInput}
                onInput={(e: Event) => setMessageInput((e.target as HTMLTextAreaElement).value)}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isStreaming) void sendMessage();
                  }
                }}
              />
              <div className="absolute right-4 bottom-4 flex items-center gap-3">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity">
                  <i className="fas fa-keyboard mr-1"></i>
                  ENTER_TO_TRANSMIT
                </div>
                <button
                  data-testid="chat-send-button"
                  type="button"
                  className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-cyan-600/20 disabled:opacity-50 disabled:grayscale transition-all flex items-center gap-2"
                  disabled={
                    !messageInput.trim() ||
                    isStreaming ||
                    !selectedModelIsValid
                  }
                  onClick={() => void sendMessage()}
                >
                  {isStreaming ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane"></i>
                      Transmit
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {chatMode === 'rag' && (
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Global Hybrid Search Protocol Enabled</p>
                <button
                  type="button"
                  className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 hover:underline uppercase tracking-widest"
                  data-testid="chat-reingest-text-btn"
                  disabled={!selectedDocumentId || textReingestBusy}
                  onClick={() => void handleTextReingest()}
                >
                  <i className="fas fa-rotate-right mr-1"></i>
                  {textReingestBusy ? 'Reingesting...' : 'Re-index Context'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
