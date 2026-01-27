import { h, Fragment } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ChatWorkspaceContract } from '../ui/contracts/ChatWorkspace.contract';
import OverlayViewerIsland from './OverlayViewerIsland';

type ChatMessageRole = 'user' | 'assistant' | 'system' | 'status';

type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  meta?: Record<string, any>;
};

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

const safeMarkdown = (text: string) => {
  const marked = (window as any).marked;
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

const highlightBlocks = (container: HTMLElement | null) => {
  const hljs = (window as any).hljs;
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

  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    props.openDocumentId ?? null
  );
  const [selectedDocumentTitle, setSelectedDocumentTitle] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'document' | 'visual'>(
    'chat'
  );
  const [docPreview, setDocPreview] = useState({
    title: '',
    content: '',
    tags: [] as string[],
    originalUrl: null as string | null,
    pageCount: 1
  });
  const [modelOptions, setModelOptions] = useState<OllamaModelGroup[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(
    props.ollamaDefaultModel ?? null
  );
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);

  const [guidedStep, setGuidedStep] = useState('Select a document to begin.');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatHistoryRef = useRef<HTMLDivElement | null>(null);
  const streamMessageIdRef = useRef<string | null>(null);

  const aiProvider = props.aiProvider || 'ollama';

  useEffect(() => {
    if (props.openDocumentId && !selectedDocumentId) {
      setSelectedDocumentId(props.openDocumentId);
    }
  }, [props.openDocumentId]);

  useEffect(() => {
    if (aiProvider === 'ollama') {
      void loadOllamaModels();
    }
  }, [aiProvider]);

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
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
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

    if (activeTab === 'visual') {
      setGuidedStep('Inspect visual evidence and compare with the chat.');
      return;
    }

    setGuidedStep('Refine your request or capture a decision.');
  }, [selectedDocumentId, chatMessages.length, activeTab]);

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

      const installed = Array.isArray(data.models) ? data.models : [];
      const expertRaw = Array.isArray(data.expertModels)
        ? data.expertModels
        : [];
      const placeholders = Array.isArray(data.placeholderModels)
        ? data.placeholderModels
        : [];

      const installedSet = new Set(installed.filter(Boolean));
      const expertEntries = expertRaw.filter((entry: any) => entry?.model);
      const expertSet = new Set(
        expertEntries.map((entry: any) => entry.model)
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
          models: expertEntries.map((entry: any) => ({
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
      const defaultExists = Boolean(defaultModel) && groups.some((group) =>
        group.models.some((model) => model.model === defaultModel)
      );

      if (defaultExists) {
        setSelectedModel(defaultModel);
      } else if (groups.length && groups[0].models.length) {
        setSelectedModel(groups[0].models[0].model);
      }
    } catch (error: any) {
      setModelLoadError(error.message || String(error));
      setModelOptions([]);
      setSelectedModel(props.ollamaDefaultModel ?? null);
    } finally {
      setIsModelLoading(false);
    }
  };

  const loadDocumentPreview = useCallback(async (documentId: number) => {
    try {
      const response = await fetch(`/manual/preview/${documentId}`);
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

  const initializeChat = useCallback(async (documentId: number) => {
    try {
      setStreamError(null);
      setStatusMessage('Initializing chat...');
      const modelParam = selectedModel
        ? `?model=${encodeURIComponent(selectedModel)}`
        : '';
      const response = await fetch(`/chat/init/${documentId}${modelParam}`);
      if (!response.ok) throw new Error('Failed to initialize chat');
      const data = await response.json();
      setSelectedDocumentTitle(data.documentTitle || `Document ${documentId}`);
      setChatMessages([
        {
          id: makeId(),
          role: 'status',
          content: `Chat ready for ${data.documentTitle || `Document ${documentId}`}.`
        }
      ]);
      await loadDocumentPreview(documentId);
    } catch (error: any) {
      setStreamError(error.message || 'Failed to initialize chat');
    } finally {
      setStatusMessage(null);
    }
  }, [loadDocumentPreview, selectedModel]);

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

  const sendMessage = useCallback(async () => {
    if (!messageInput.trim() || !selectedDocumentId) return;

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

    setChatMessages((prev) => [
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
      const response = await fetch('/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          message: userMessage,
          model: selectedModel
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to send message');
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

          let parsed: any = null;
          try {
            parsed = JSON.parse(payload);
          } catch (err) {
            parsed = { content: payload };
          }

          if (parsed.error) {
            setStreamError(parsed.error);
            continue;
          }

          if (parsed.content) {
            setChatMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantEntryId
                  ? { ...msg, content: msg.content + parsed.content }
                  : msg
              )
            );
          }
        }
      }
    } catch (error: any) {
      setStreamError(error.message || 'Failed to stream response');
    } finally {
      setIsStreaming(false);
    }
  }, [messageInput, selectedDocumentId, selectedModel]);

  const tabs = useMemo(() => (
    [
      { id: 'chat', label: 'Chat' },
      { id: 'document', label: 'Document' },
      { id: 'visual', label: 'Visual' }
    ] as const
  ), []);

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
            <label className="sg-label" htmlFor="chat-document-select">
              Document
            </label>
            <select
              id="chat-document-select"
              data-testid="chat-document-select"
              className="sg-select"
              value={selectedDocumentId ?? ''}
              onChange={(e: any) => {
                const value = e.target.value;
                setSelectedDocumentId(value ? Number(value) : null);
              }}
            >
              <option value="">Choose a document...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title || doc.original_filename || `Document ${doc.id}`}
                </option>
              ))}
            </select>
          </div>

          {aiProvider === 'ollama' && (
            <div className="flex-1 min-w-[220px]">
              <label className="sg-label" htmlFor="chat-model-select">
                Ollama Model
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
                  <select
                    id="chat-model-select"
                    data-testid="chat-model-select"
                    className="sg-select"
                    value={selectedModel ?? ''}
                    onFocus={() => { if (!modelOptions.length) void loadOllamaModels(); }}
                    onChange={async (e: any) => {
                      const value = e.target.value || null;
                      setSelectedModel(value);

                      // Verify selected model availability asynchronously and log result
                      if (value) {
                        const result = await verifyModel(value);
                        if (!result.ok) {
                          console.warn('[Model Verify] verify failed:', result);
                        } else if (result.data) {
                          console.info('[Model Verify] verify result:', result.data);
                          if (!result.data.installed && !result.data.loaded) {
                            // Not installed or loaded, show a non-blocking info message
                            setModelLoadError(`Model ${value} not installed/loaded on Ollama.`);
                          } else {
                            setModelLoadError(null);
                          }
                        }
                      }
                    }}
                  >
                    {modelOptions.length === 0 && (
                      <option value="">No models returned</option>
                    )}
                    {modelOptions.map((group) => (
                      <optgroup label={group.label} key={group.label}>
                        {group.models.map((model) => (
                          <option value={model.model} key={model.model}>
                            {model.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="sg-helper">
                    Installed, expert, and configured placeholders are listed. Select to use.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="material-card sg-card sg-card--workspace">
        <div className="sg-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`chat-tab-${tab.id}`}
              className={`sg-tab ${activeTab === tab.id ? 'sg-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'chat' && (
          <div className="sg-tab-panel">
            {!selectedDocumentId && (
              <div className="sg-empty" data-testid="chat-empty-state">
                Select a document to start a conversation.
              </div>
            )}

            {selectedDocumentId && (
              <div className="sg-chat-panel">
                <div
                  ref={chatHistoryRef}
                  className="sg-chat-history"
                  data-testid="chat-history"
                >
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`sg-message sg-message--${msg.role}`}
                      data-testid={`chat-message-${msg.role}`}
                      ref={(el) => {
                        if (msg.role === 'assistant' && el) {
                          highlightBlocks(el);
                        }
                      }}
                      dangerouslySetInnerHTML={{
                        __html: msg.role === 'assistant'
                          ? safeMarkdown(msg.content)
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
                    placeholder="Ask about the document..."
                    value={messageInput}
                    onInput={(e: any) => setMessageInput(e.target.value)}
                    onKeyDown={(e: any) => {
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
        )}

        {activeTab === 'document' && (
          <div className="sg-tab-panel" data-testid="chat-document-panel">
            {!selectedDocumentId && (
              <div className="sg-empty">Select a document to preview.</div>
            )}
            {selectedDocumentId && (
              <div className="sg-document-preview">
                <div className="sg-document-header">
                  <div>
                    <h3 className="sg-display">
                      {docPreview.title || selectedDocumentTitle}
                    </h3>
                    <p className="sg-helper">
                      {docPreview.tags.length
                        ? `Tags: ${docPreview.tags.join(', ')}`
                        : 'No tags yet.'}
                    </p>
                  </div>
                  <a
                    data-testid="chat-open-history"
                    href={`/history/doc/${selectedDocumentId}`}
                    className="sg-link"
                  >
                    Open in history
                  </a>
                </div>
                <div className="sg-document-content">
                  {docPreview.content || 'No content available.'}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'visual' && (
          <div className="sg-tab-panel" data-testid="chat-visual-panel">
            {!selectedDocumentId && (
              <div className="sg-empty">
                Select a document to review visual overlays.
              </div>
            )}
            {selectedDocumentId && (
              <div className="sg-visual-panel">
                <OverlayViewerIsland
                  documentId={selectedDocumentId}
                  page={1}
                  originalUrl={docPreview.originalUrl || undefined}
                  pageCount={docPreview.pageCount}
                  overlayMode="document"
                  showLegend={true}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
