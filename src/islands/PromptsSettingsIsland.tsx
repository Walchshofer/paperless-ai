import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { PromptsSettings, PromptEntry, PromptConfig } from '../ui/contracts/Settings.Prompts.contract';
import { PromptsSettingsSchema } from '../ui/contracts/Settings.Prompts.contract';
import { RangeNumberInput } from './components/RangeNumberInput';

/**
 * PromptsSettingsIsland - State-of-the-art Prompt template management
 *
 * Provides domain-grouped accordion of expert pipeline prompts
 * with advanced inline editors, self-guiding placeholder library,
 * and robust validation feedback.
 */

const DOMAIN_ORDER = ['System', 'Medical', 'Financial', 'Legal', 'General'] as const;

/** Extract base ID from versioned prompt (e.g. SYS_ROUTER_V1 -> SYS_ROUTER) */
const getBaseId = (id: string) => id.replace(/_V\d+$/i, '');

/** Inline tooltip helper */
function Tooltip({ text }: { text: string }) {
  return (
    <span className="ai-tooltip-wrapper ml-1">
      <span className="ai-tooltip-icon" tabIndex={0} aria-label={text}>?</span>
      <span className="ai-tooltip-content">{text}</span>
    </span>
  );
}

/** Extract {{variable}} names from text */
function extractVars(text: string): string[] {
  const matches = (text || '').match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2).trim()))];
}

/** Self-guiding placeholder pill with click-to-insert */
function PlaceholderPill({ 
  name, 
  description, 
  onInsert 
}: { 
  name: string; 
  description: string; 
  onInsert: (v: string) => void;
}) {
  return (
    <button
      onClick={() => onInsert(`{{${name}}}`)}
      className="template-var-pill template-var-pill--interactive group relative"
      title={`Click to insert {{${name}}}`}
      type="button"
    >
      <span className="font-mono">{`{{${name}}}`}</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center leading-tight">
        {description}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900" />
      </span>
    </button>
  );
}

interface PipelineStageResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'skipped';
  duration: number;
  error?: string;
}

interface PipelineError {
  message: string;
  stages: PipelineStageResult[];
}


interface PromptStreamEvent {
  text?: string;
  testResult?: string | Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

interface TestResult {
  success: boolean;
  error?: string;
  testResult?: string | Record<string, unknown>;
  model?: string;
  source?: string;
  duration?: number;
  tokenEstimate?: number;
  jsonValid?: boolean;
  renderedSystemPrompt?: string;
  renderedTemplate?: string;
  missingVariables?: string[];
  guidanceMetadata?: { source: string };
  [key: string]: unknown;
}

interface DocumentMetadata {
  id: number;
  title: string;
  filename: string;
  created: string;
}

interface SelectedDocumentData extends DocumentMetadata {
  content: string;
  status: string | null;
}

export default function PromptsSettingsIsland(props: Partial<PromptsSettings>) {
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Accordion state: which domains are expanded
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set(['System']));

  // Active editor: which prompt ID is being edited (single-expand)
  const [activePromptId, setActivePromptId] = useState<string | null>(null);

  // Editor state for the active prompt
  const [editSystemPrompt, setEditSystemPrompt] = useState('');
  const [editUserTemplate, setEditUserTemplate] = useState('');
  const [editConfig, setEditConfig] = useState<PromptConfig>({ temperature: 0.2, maxTokens: 2048, topK: 40, topP: 0.9 });
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Control sidebar tabs: 'library' or 'config'
  const [sidebarTab, setSidebarTab] = useState<'library' | 'config'>('library');

  // Focus tracking for insertion
  const lastFocusedArea = useRef<'system' | 'user' | null>(null);

  // Validation feedback state
  const [validationResult, setValidationResult] = useState<{
    errors?: string[];
    warnings?: string[];
    suggestions?: string[];
    quality_score?: number;
    syntax_valid?: boolean;
    detected_variables?: string[];
    unrecognized_variables?: string[];
  } | null>(null);

  // Test modal state

interface TestResult {
  success: boolean;
  rawResponse?: string;
  parsedResponse?: unknown;
  error?: string;
  latencyMs?: number;
  tokensUsed?: number;
  missingVariables?: string[];
  model?: string;
  source?: string;
  duration?: number;
  tokenEstimate?: number;
  renderedSystemPrompt?: string;
  renderedTemplate?: string;
  testResult?: unknown;
  jsonValid?: boolean;
  guidanceMetadata?: {
    source?: string;
  };
}
  const [showTestModal, setShowTestModal] = useState(false);
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [lockedVariables, setLockedVariables] = useState<Set<string>>(new Set());
  const [pipelineError, setPipelineError] = useState<PipelineError | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testStreamingResult, setTestStreamingResult] = useState<{
    fullText: string;
    thinking: string;
    metadata: Record<string, unknown> | null;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [pipelineExecuting, setPipelineExecuting] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState<DocumentMetadata[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocumentData, setSelectedDocumentData] = useState<SelectedDocumentData | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState<'validate' | 'execute'>('validate');
  const abortControllerRef = useRef<AbortController | null>(null);

  const closeTestModal = () => {
    setShowTestModal(false);
    setIsTesting(false);
    setPipelineExecuting(false);
    setIsLoadingDocs(false);
    setDocError(null);
    setPipelineError(null);
    setShowErrorDetails(false);
    setLockedVariables(new Set());
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const toggleVariableLock = (varName: string) => {
    setLockedVariables(prev => {
      const next = new Set(prev);
      if (next.has(varName)) next.delete(varName);
      else next.add(varName);
      return next;
    });
  };

  // Fetch prompts on mount
  useEffect(() => {
    fetchPrompts();
  }, []);

  // Sync with sidebar navigation via hash
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#prompts') {
        // Just the base tab, maybe ensure Overview is visible
      } else if (hash.startsWith('#prompts/')) {
        const id = hash.replace('#prompts/', '').toUpperCase();
        // Try to find the prompt
        const prompt = prompts.find(p => p.id === id || p.id.startsWith(id));
        if (prompt) {
          setExpandedDomains(prev => new Set(prev).add(prompt.domain));
          setActivePromptId(prompt.id);
          // Scroll to it
          setTimeout(() => {
            const el = document.getElementById(`prompt-row-${prompt.id.toLowerCase().replace(/_/g, '-')}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }
      }
    };

    window.addEventListener('hashchange', handleHash);
    // Initial check
    if (prompts.length > 0) handleHash();
    
    return () => window.removeEventListener('hashchange', handleHash);
  }, [prompts]);

  // Auto-clear save message
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  // Warn on unload if dirty
  useEffect(() => {
    if (!isEditorDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isEditorDirty]);

  const fetchPrompts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/prompts');
      if (response.ok) {
        const data = await response.json();
        setPrompts(data.prompts || []);
      } else {
        setError('Failed to load prompts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentDocuments = async () => {
    setIsLoadingDocs(true);
    setDocError(null);
    try {
      const response = await fetch('/api/documents/recent');
      if (response.ok) {
        const data = await response.json();
        setRecentDocuments(data.documents || []);
      } else {
        setDocError('Failed to fetch documents');
      }
    } catch (err) {
      setDocError('Connection error');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleDocumentSelect = async (docId: number) => {
    if (!activePromptId) return;
    
    // Cancel existing request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setSelectedDocumentId(String(docId));
    setPipelineExecuting(true);
    setDocError(null);
    setPipelineError(null);
    setShowErrorDetails(false);
    setTestVariables({});
    setLockedVariables(new Set());
    
    try {
      const [contextRes, statusRes] = await Promise.all([
        fetch('/api/prompts-runtime/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: docId, promptId: activePromptId }),
          signal: controller.signal
        }),
        fetch(`/api/documents/${docId}/status`, { signal: controller.signal })
          .catch(() => null)
      ]);

      let documentStatus: string | null = null;
      if (statusRes && statusRes.ok) {
        const statusData = await statusRes.json().catch(() => null);
        documentStatus = statusData?.status || null;
      }

      if (contextRes.status === 429) {
        const data = await contextRes.json();
        setDocError(data.error || 'You have an active test execution. Please wait.');
        return;
      }

      if (contextRes.ok || contextRes.status === 500) {
        const data = await contextRes.json();
        
        // Populate document metadata
        if (data.documentMetadata) {
          setSelectedDocumentData({
            id: data.documentMetadata.id, created: data.documentMetadata.created || '',
            title: data.documentMetadata.title,
            filename: data.documentMetadata.filename,
            content: data.variables?.ocr_text || data.variables?.content || '',
            status: documentStatus
          });
        }

        // Populate variables
        if (data.variables) {
          setTestVariables(data.variables);
          // Lock all populated variables by default
          setLockedVariables(
            new Set(
              Object.keys(data.variables).filter(
                (key) => !key.startsWith('__')
              )
            )
          );
        }

        // Handle pipeline errors
        if (!data.success) {
          const stages = Array.isArray(data.pipelineMetadata?.stages)
            ? data.pipelineMetadata.stages
            : [];
          if (stages.length > 0) {
            setPipelineError({
              message: data.error || 'Pipeline execution failed',
              stages
            });
            setShowErrorDetails(true);
          } else {
            setDocError(
              data.error || 'Pipeline execution failed with no stage details'
            );
          }
        } else if (data.warning) {
          setDocError(data.warning);
        }
      } else {
        let errorMessage = `Context fetch failed: ${contextRes.status}`;
        try {
          const contextError = await contextRes.json();
          if (contextError?.error) {
            errorMessage = contextError.error;
          }
        } catch (_err) {
          // Preserve status-based fallback message when response has no JSON.
        }
        setDocError(errorMessage);
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setDocError('Document context fetch error');
      console.error(err);
    } finally {
      setPipelineExecuting(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  const openEditor = (prompt: PromptEntry) => {
    if (activePromptId === prompt.id) {
      // Close if clicking the same prompt
      setActivePromptId(null);
      setIsEditorDirty(false);
      return;
    }
    setActivePromptId(prompt.id);
    setEditSystemPrompt(prompt.systemPrompt);
    setEditUserTemplate(prompt.userTemplate);
    setEditConfig({ ...prompt.config });
    setIsEditorDirty(false);
    setSaveMessage(null);
    setValidationResult(null);
    closeTestModal();
  };

  const handleSave = async () => {
    if (!activePromptId) return;
    setIsSaving(true);
    setSaveMessage(null);
    setValidationResult(null);
    try {
      const response = await fetch(`/api/prompts/${activePromptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: editSystemPrompt,
          userTemplate: editUserTemplate,
          config: editConfig,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        // Update local state
        setPrompts(prev =>
          prev.map(p => p.id === activePromptId ? { ...p, ...data.prompt } : p)
        );
        setIsEditorDirty(false);
        setSaveMessage('Saved successfully');
        // Show warnings from validation (non-blocking)
        if (data.validation) {
          setValidationResult(data.validation);
        }
        // Notify other islands
        if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
          document.dispatchEvent(new CustomEvent('settings:saved', { detail: { category: 'prompts', promptId: activePromptId } }));
          document.dispatchEvent(new CustomEvent('settings:restart-required', { detail: { reason: 'Prompt template modified' } }));
        }
      } else if (response.status === 422) {
        // Validation errors - save was blocked
        const errData = await response.json();
        setValidationResult(errData.validation || null);
        setSaveMessage('Save blocked: validation errors found');
      } else {
        const errData = await response.json();
        setSaveMessage(`Save failed: ${errData.error || 'Unknown error'}`);
      }
    } catch (err) {
      setSaveMessage(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!activePromptId) return;
    setIsResetting(true);
    setSaveMessage(null);
    try {
      const response = await fetch(`/api/prompts/${activePromptId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        const resetPrompt = data.prompt;
        // Update local state
        setPrompts(prev =>
          prev.map(p => p.id === activePromptId ? { ...p, ...resetPrompt } : p)
        );
        // Update editor
        setEditSystemPrompt(resetPrompt.systemPrompt);
        setEditUserTemplate(resetPrompt.userTemplate);
        setEditConfig({ ...resetPrompt.config });
        setIsEditorDirty(false);
        setSaveMessage('Reset to default');
        // Notify other islands
        if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
          document.dispatchEvent(new CustomEvent('settings:saved', { detail: { category: 'prompts', promptId: activePromptId, action: 'reset' } }));
          document.dispatchEvent(new CustomEvent('settings:restart-required', { detail: { reason: 'Prompt template reset to default' } }));
        }
      } else {
        const errData = await response.json();
        setSaveMessage(`Reset failed: ${errData.error || 'Unknown error'}`);
      }
    } catch (err) {
      setSaveMessage(`Reset failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  };

  const markEditorDirty = () => {
    setIsEditorDirty(true);
    setValidationResult(null);
  };

  const handleTest = async () => {
    if (!activePromptId) return;
    setIsTesting(true);
    setTestResult(null);
    setTestStreamingResult(null);

    // Validation mode uses standard fetch
    if (testMode === 'validate') {
      try {
        const response = await fetch(`/api/prompts/${activePromptId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variables: {
              ...testVariables,
            },
            systemPrompt: editSystemPrompt,
            userTemplate: editUserTemplate,
            mode: testMode,
          }),
        });
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: 'Test request failed' }));
          setTestResult({ success: false, error: errData.error || `HTTP ${response.status}` });
          return;
        }

        const data = await response.json();
        setTestResult(data);
      } catch (err) {
        setTestResult({ success: false, error: err instanceof Error ? err.message : 'Test failed' });
      } finally {
        setIsTesting(false);
      }
      return;
    }

    // Execution mode uses SSE streaming
    try {
      const response = await fetch(`/api/prompts/${activePromptId}/test/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variables: {
            ...testVariables,
          },
          systemPrompt: editSystemPrompt,
          userTemplate: editUserTemplate,
        }),
      });

      if (!response.ok) {
        const errData = await response
          .json()
          .catch(() => ({ error: `Stream failed: ${response.status}` }));
        setTestResult({
          success: false,
          error: errData.error || `Stream failed: ${response.status}`
        });
        setIsTesting(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No body reader');

      let currentText = '';
      let currentThinking = '';
      let metadata: Record<string, unknown> | null = null;
      const decoder = new TextDecoder();
      let buffer = '';
      let activeEvent = 'message';
      let terminalEventReceived = false;

      const updateStreamingState = () => {
        setTestStreamingResult({
          fullText: currentText,
          thinking: currentThinking,
          metadata
        });
      };

      const processEvent = (eventName: string, payload: string) => {
        let data: PromptStreamEvent | null = null;
        try {
          data = JSON.parse(payload) as PromptStreamEvent;
        } catch (_parseErr) {
          return;
        }

        if (eventName === 'metadata') {
          metadata = data;
          return;
        }

        if (eventName === 'token') {
          if (data) { currentText += typeof data.text === 'string' ? data.text : ''; }
          updateStreamingState();
          return;
        }

        if (eventName === 'thinking') {
          currentThinking += typeof data.text === 'string' ? data.text : '';
          updateStreamingState();
          return;
        }

        if (eventName === 'done') {
          if (!currentText && typeof data.testResult === 'string') {
            currentText = data.testResult;
          }
          updateStreamingState();
          setTestResult({
            success: true,
            ...(metadata || {}),
            ...data,
            testResult: currentText || data.testResult
          });
          terminalEventReceived = true;
          setIsTesting(false);
          return;
        }

        if (eventName === 'error') {
          setTestResult({
            success: false,
            error: data.error || 'Streaming failed'
          });
          terminalEventReceived = true;
          setIsTesting(false);
        }
      };

      const processBuffer = () => {
        let frameBoundary = buffer.indexOf('\n\n');
        while (frameBoundary !== -1) {
          const frame = buffer.slice(0, frameBoundary);
          buffer = buffer.slice(frameBoundary + 2);
          frameBoundary = buffer.indexOf('\n\n');

          if (!frame.trim()) {
            continue;
          }

          const lines = frame.split('\n');
          let eventName = activeEvent;
          const dataLines: string[] = [];

          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, '');
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim() || activeEvent;
              activeEvent = eventName;
              continue;
            }
            if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trimStart());
            }
          }

          if (dataLines.length > 0) {
            processEvent(eventName || 'message', dataLines.join('\n'));
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
          processBuffer();
        }

        if (done) {
          buffer += decoder.decode().replace(/\r\n/g, '\n');
          if (buffer.trim()) {
            buffer += '\n\n';
            processBuffer();
          }
          if (!terminalEventReceived) {
            setTestResult({
              success: false,
              error: 'Streaming ended before completion event'
            });
            setIsTesting(false);
          }
          break;
        }
      }
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : 'Streaming failed' });
      setIsTesting(false);
    }
  };

  const openTestModal = () => {
    // Reset test state
    setTestVariables({});
    setLockedVariables(new Set());
    setTestResult(null);
    setPipelineError(null);
    setShowErrorDetails(false);
    setSelectedDocumentId(null);
    setSelectedDocumentData(null);
    setShowTestModal(true);
  };

  const insertPlaceholder = (placeholder: string) => {
    if (!lastFocusedArea.current) {
      // Default to user template if none focused
      setEditUserTemplate(prev => prev + ' ' + placeholder);
    } else if (lastFocusedArea.current === 'system') {
      setEditSystemPrompt(prev => prev + ' ' + placeholder);
    } else {
      setEditUserTemplate(prev => prev + ' ' + placeholder);
    }
    markEditorDirty();
  };

  // Canonical library of available placeholders across domains
  const PLACEHOLDER_LIBRARY = [
    { name: 'source_system', description: 'Originating system (e.g., paperless-ngx)', domains: ['System', 'General'] },
    { name: 'filename', description: 'Original document filename', domains: ['System', 'General', 'Financial'] },
    { name: 'resolution', description: 'Image resolution in DPI', domains: ['System'] },
    { name: 'file_size', description: 'File size in bytes', domains: ['System'] },
    { name: 'page_number', description: 'Current processing page index', domains: ['System'] },
    { name: 'total_pages', description: 'Total pages in document', domains: ['System'] },
    { name: 'text_chunk', description: 'Extracted OCR text block', domains: ['General', 'Medical', 'Financial', 'Legal'] },
    { name: 'document_type', description: 'Initial classification guess', domains: ['Medical', 'Financial', 'Legal'] },
    { name: 'ocr_quality', description: 'Confidence score of OCR step', domains: ['General', 'Financial'] },
    { name: 'patient_context', description: 'Prior medical history/context', domains: ['Medical'] },
    { name: 'modality', description: 'Imaging type (X-Ray, CT, MRI)', domains: ['Medical'] },
    { name: 'body_region', description: 'Anatomical area imaged', domains: ['Medical'] },
    { name: 'vat_context', description: 'Internal VAT knowledge base snippets', domains: ['Financial'] },
    { name: 'legal_context', description: 'Internal legal knowledge base snippets', domains: ['Legal'] },
  ];

  // Group prompts by base ID (e.g. SYS_ROUTER_V1 -> SYS_ROUTER) handled by the helper function at top level or component scope
  
  // Group prompts by domain
  const groupedPrompts: Record<string, Record<string, PromptEntry[]>> = {};
  for (const domain of DOMAIN_ORDER) {
    const domainPrompts = prompts.filter(p => p.domain === domain);
    const byBaseId: Record<string, PromptEntry[]> = {};
    
    for (const p of domainPrompts) {
      const baseId = getBaseId(p.id);
      if (!byBaseId[baseId]) byBaseId[baseId] = [];
      byBaseId[baseId].push(p);
    }
    
    // Sort versions within each baseId
    for (const baseId in byBaseId) {
      byBaseId[baseId].sort((a, b) => b.id.localeCompare(a.id));
    }
    
    groupedPrompts[domain] = byBaseId;
  }

  // Compute template variables for current editor
  const editorVars = activePromptId
    ? [...new Set([...extractVars(editSystemPrompt), ...extractVars(editUserTemplate)])]
    : [];
  const visibleVariableEntries = Object.entries(testVariables).filter(
    ([key]) => !key.startsWith('__')
  );

  // Chevron SVG helper
  const Chevron = ({ open }: { open: boolean }) => (
    <svg
      className={`dev-section-chevron ${open ? 'dev-section-chevron--open' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <div className="prompts-settings space-y-6 p-6 max-w-6xl mx-auto" data-testid="prompts-settings-root">
      {/* Header - Cyber Lab Theme */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 mb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Prompt Engineering</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Precision control over expert pipeline reasoning and extraction logic.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-2">
            <i className="fas fa-shield-halved text-amber-500 text-xs"></i>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Admin Mode</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
          data-testid="prompts-error"
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }} data-testid="loading-prompts">
          <div className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mb-3" />
          <div className="text-sm">Loading prompts...</div>
        </div>
      ) : (
        /* Domain Accordion */
        <div className="space-y-4">
          {DOMAIN_ORDER.map(domain => {
            const domainGroups = groupedPrompts[domain] || {};
            const baseIds = Object.keys(domainGroups);
            if (baseIds.length === 0) return null;
            const isExpanded = expandedDomains.has(domain);

            return (
              <div key={domain} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm overflow-hidden transition-all duration-300" data-testid={`domain-group-${domain.toLowerCase()}`}>
                {/* Domain Header - Sticky */}
                <button
                  onClick={() => toggleDomain(domain)}
                  className={`domain-group-header w-full flex items-center justify-between p-4 sticky top-0 z-10 backdrop-blur-md transition-colors ${
                    isExpanded ? 'bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                  aria-expanded={isExpanded}
                  data-testid={`domain-header-${domain.toLowerCase()}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      domain === 'System' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                      domain === 'Medical' ? 'bg-rose-100 text-red-600 dark:bg-rose-900/30 dark:text-rose-400' :
                      domain === 'Financial' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {domain.charAt(0)}
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100">{domain}</h3>
                      <p className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5">{baseIds.length} expert templates</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="domain-count-badge bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-none">{Object.values(domainGroups).flat().length}</span>
                    <Chevron open={isExpanded} />
                  </div>
                </button>

                {/* Prompt Rows */}
                {isExpanded && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-900/20" role="region" aria-label={`${domain} prompts`}>
                    {baseIds.map((baseId, groupIndex) => {
                      const versions = domainGroups[baseId];
                      const activeInGroup = versions.find(v => v.id === activePromptId) || versions[0];
                      const hasMultipleVersions = versions.length > 1;
                      const isActive = activePromptId && versions.some(v => v.id === activePromptId);

                      return (
                        <div key={baseId} id={`prompt-row-${baseId.toLowerCase().replace(/_/g, '-')}`} className="group" data-testid={`prompt-row-${baseId.toLowerCase().replace(/_/g, '-')}`}>
                          {/* Row Header */}
                          <div
                            className={`flex items-center justify-between py-3 px-4 transition-all ${
                              isActive ? 'bg-cyan-50/50 dark:bg-cyan-900/10 ring-1 ring-inset ring-cyan-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                            }`}
                          >
                            <button
                              onClick={() => openEditor(activeInGroup)}
                              className="flex-1 text-left flex items-center gap-4"
                              data-testid={`prompt-row-btn-${baseId.toLowerCase().replace(/_/g, '-')}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-sm font-bold ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {baseId}
                                </span>
                                {versions.some(v => v.isModified) && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]" title="Modified from default" />
                                )}
                              </div>
                              <div className="hidden sm:flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-medium text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                                  {activeInGroup.model}
                                </span>
                                {!hasMultipleVersions && <span className="text-[10px] font-bold text-slate-400">v{activeInGroup.id.split('_').pop()}</span>}
                              </div>
                            </button>

                            {hasMultipleVersions && (
                              <div className="flex items-center gap-2">
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                  {versions.map(v => (
                                    <button
                                      key={v.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditor(v);
                                      }}
                                      className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-tighter uppercase transition-all ${
                                        activePromptId === v.id
                                          ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                      }`}
                                      data-testid={`version-btn-${v.id}`}
                                    >
                                      {v.id.split('_').pop()?.toUpperCase()}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* ── EXPANDED EDITOR: THE CYBER LAB ── */}
                          {isActive && (
                            <div 
                              className="prompt-editor-panel relative bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 overflow-hidden" 
                              id={`prompt-editor-panel-${activePromptId}`} 
                              role="region" 
                              aria-label={`Edit ${activePromptId}`} 
                              data-testid={`prompt-editor-${activePromptId.toLowerCase().replace(/_/g, '-')}`}
                            >
                              <div className="relative flex flex-col lg:flex-row">
                                {/* Left Pane: The Editors */}
                                <div className="flex-1 p-6 space-y-6 min-w-0 border-r border-slate-200 dark:border-slate-800">
                                  {/* Editor Header Card */}
                                  <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-4">
                                    <span className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 text-xs font-bold font-mono border border-cyan-100 dark:border-cyan-900/50 tracking-tight">
                                      {activePromptId}
                                    </span>
                                    <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                      v{versions.find(v => v.id === activePromptId)?.version || '1.0.0'}
                                    </span>
                                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block"></div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                      {versions.find(v => v.id === activePromptId)?.model}
                                    </span>
                                    {versions.find(v => v.id === activePromptId)?.category && (
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                        • {versions.find(v => v.id === activePromptId)?.category}
                                      </span>
                                    )}
                                  </div>

                                  {/* System Prompt Section */}
                                  <div className="space-y-2 group/editor relative">
                                    <div className="flex items-center justify-between px-1">
                                      <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                        <i className="fas fa-terminal text-cyan-500"></i>
                                        System Persona & Rules
                                        <Tooltip text="Defines the AI's persona, expertise, and strict constraints." />
                                      </label>
                                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-600 opacity-0 group-hover/editor:opacity-100 transition-opacity">
                                        {editSystemPrompt.length} chars
                                      </div>
                                    </div>
                                    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:border-cyan-500 transition-all shadow-inner">
                                      <textarea
                                        className="w-full h-64 p-4 bg-white dark:bg-slate-950 text-slate-900 dark:text-cyan-50 font-mono text-[13px] leading-relaxed resize-none focus:outline-none scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                                        value={editSystemPrompt}
                                        onFocus={() => lastFocusedArea.current = 'system'}
                                        onInput={(e: Event) => {
                                          setEditSystemPrompt((e.target as HTMLTextAreaElement).value);
                                          markEditorDirty();
                                        }}
                                        spellcheck={false}
                                        data-testid={`prompt-system-textarea-${activePromptId.toLowerCase().replace(/_/g, '-')}`}
                                      />
                                      {/* Editor Corner Decor */}
                                      <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none overflow-hidden opacity-10">
                                        <div className="absolute bottom-[-15px] right-[-15px] w-10 h-10 border-4 border-cyan-500 rounded-full"></div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* User Template Section */}
                                  <div className="space-y-2 group/editor relative">
                                    <div className="flex items-center justify-between px-1">
                                      <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                        <i className="fas fa-comment-dots text-indigo-500"></i>
                                        User Template
                                        <Tooltip text="The dynamic part of the prompt containing document variables like {{text_chunk}}." />
                                      </label>
                                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-600 opacity-0 group-hover/editor:opacity-100 transition-opacity">
                                        {editUserTemplate.length} chars
                                      </div>
                                    </div>
                                    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all shadow-inner">
                                      <textarea
                                        className="w-full h-48 p-4 bg-white dark:bg-slate-950 text-slate-900 dark:text-indigo-50 font-mono text-[13px] leading-relaxed resize-none focus:outline-none scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                                        value={editUserTemplate}
                                        onFocus={() => lastFocusedArea.current = 'user'}
                                        onInput={(e: Event) => {
                                          setEditUserTemplate((e.target as HTMLTextAreaElement).value);
                                          markEditorDirty();
                                        }}
                                        spellcheck={false}
                                        data-testid={`prompt-user-textarea-${activePromptId.toLowerCase().replace(/_/g, '-')}`}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Right Pane: Tooling & Action Rail */}
                                <div className="w-full lg:w-80 flex flex-col bg-slate-100 dark:bg-slate-900/80">
                                  {/* Sidebar Navigation */}
                                  <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 p-1 mx-4 mt-6 rounded-xl border">
                                    <button
                                      onClick={() => setSidebarTab('library')}
                                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                                        sidebarTab === 'library' 
                                          ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                      }`}
                                    >
                                      Library
                                    </button>
                                    <button
                                      onClick={() => setSidebarTab('config')}
                                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                                        sidebarTab === 'config' 
                                          ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                      }`}
                                    >
                                      Knobs
                                    </button>
                                  </div>

                                  <div className="flex-1 p-6 overflow-y-auto max-h-[600px] lg:max-h-none scrollbar-none sticky top-0">
                                    {sidebarTab === 'library' ? (
                                      <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
                                        <div>
                                          <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <i className="fas fa-tags text-[8px]"></i>
                                            In Active Use
                                          </h4>
                                          {editorVars.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                              {editorVars.map(v => (
                                                <PlaceholderPill
                                                  key={v}
                                                  name={v}
                                                  description={PLACEHOLDER_LIBRARY.find(l => l.name === v)?.description || 'Custom defined variable'}
                                                  onInsert={insertPlaceholder}
                                                />
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="text-[10px] text-slate-400 italic">No variables detected in template.</div>
                                          )}
                                        </div>

                                        <div>
                                          <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <i className="fas fa-plus-circle text-[8px]"></i>
                                            Available for {versions[0].domain}
                                          </h4>
                                          <div className="space-y-1.5">
                                            {PLACEHOLDER_LIBRARY
                                              .filter(l => l.domains.includes(versions[0].domain) || l.domains.includes('System'))
                                              .filter(l => !editorVars.includes(l.name))
                                              .map(l => (
                                                <PlaceholderPill
                                                  key={l.name}
                                                  name={l.name}
                                                  description={l.description}
                                                  onInsert={insertPlaceholder}
                                                />
                                              ))
                                            }
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
                                        <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                                          <RangeNumberInput
                                            id={`prompt-temp-${activePromptId}`}
                                            label="Temperature"
                                            description="Creative randomness factor"
                                            value={editConfig.temperature}
                                            min={0}
                                            max={2}
                                            step={0.05}
                                            onChange={(v: number) => { setEditConfig(prev => ({ ...prev, temperature: v })); markEditorDirty(); }}
                                            testId={`prompt-temperature-${activePromptId.toLowerCase().replace(/_/g, '-')}`}
                                          />
                                          <RangeNumberInput
                                            id={`prompt-tokens-${activePromptId}`}
                                            label="Max Response"
                                            description="Upper token limit"
                                            value={editConfig.maxTokens}
                                            min={128}
                                            max={8192}
                                            step={128}
                                            unit="tokens"
                                            onChange={(v: number) => { setEditConfig(prev => ({ ...prev, maxTokens: v })); markEditorDirty(); }}
                                            testId={`prompt-max-tokens-${activePromptId.toLowerCase().replace(/_/g, '-')}`}
                                          />
                                          <RangeNumberInput
                                            id={`prompt-topk-${activePromptId}`}
                                            label="Top K"
                                            description="Probability filtering"
                                            value={editConfig.topK}
                                            min={1}
                                            max={100}
                                            step={1}
                                            onChange={(v: number) => { setEditConfig(prev => ({ ...prev, topK: v })); markEditorDirty(); }}
                                            testId={`prompt-top-k-${activePromptId.toLowerCase().replace(/_/g, '-')}`}
                                          />
                                          <RangeNumberInput
                                            id={`prompt-topp-${activePromptId}`}
                                            label="Top P"
                                            description="Nucleus sampling threshold"
                                            value={editConfig.topP}
                                            min={0}
                                            max={1}
                                            step={0.05}
                                            onChange={(v: number) => { setEditConfig(prev => ({ ...prev, topP: v })); markEditorDirty(); }}
                                            testId={`prompt-top-p-${activePromptId.toLowerCase().replace(/_/g, '-')}`}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Action Rail - Bottom Sticky on mobile, side rail on large */}
                                  <div className="p-6 mt-auto bg-slate-200 dark:bg-slate-950/50 border-t border-slate-300 dark:border-slate-800 flex flex-col gap-3">
                                    {/* Real-time Quality Score */}
                                    {validationResult?.quality_score !== undefined && (
                                      <div className="px-1 mb-2">
                                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                                          <span>Template Quality</span>
                                          <span className={validationResult.quality_score >= 0.7 ? 'text-emerald-500' : 'text-amber-500'}>
                                            {Math.round(validationResult.quality_score * 100)}%
                                          </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-300 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                          <div
                                            className={`h-full transition-all duration-1000 ${
                                              validationResult.quality_score >= 0.7 ? 'bg-emerald-500' : 
                                              validationResult.quality_score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                                            }`}
                                            style={{ width: `${Math.round(validationResult.quality_score * 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    <button
                                      onClick={handleSave}
                                      disabled={!isEditorDirty || isSaving}
                                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 text-white font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
                                      data-testid={`prompt-save-${activePromptId.toLowerCase().replace(/_/g, '-')}`}
                                    >
                                      {isSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                      ) : <i className="fas fa-save text-[10px]"></i>}
                                      {isSaving ? 'Deploying...' : 'Deploy Changes'}
                                    </button>

                                    <div className="flex gap-2">
                                      <button
                                        onClick={openTestModal}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-750 transition-all active:scale-[0.98]"
                                        data-testid={`prompt-test-${activePromptId.toLowerCase().replace(/_/g, '-')}`}
                                      >
                                        <i className="fas fa-vial text-[10px] text-indigo-500"></i>
                                        Test Lab
                                      </button>
                                      <button
                                        onClick={handleReset}
                                        disabled={isResetting}
                                        className="flex items-center justify-center py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/50 transition-all"
                                        title="Reset to Factory Defaults"
                                        data-testid={`prompt-reset-${activePromptId.toLowerCase().replace(/_/g, '-')}`}
                                      >
                                        <i className={`fas fa-rotate-left text-xs ${isResetting ? 'animate-spin' : ''}`}></i>
                                      </button>
                                    </div>

                                    {saveMessage && (
                                      <div
                                        className={`mt-2 p-2.5 rounded-lg text-[10px] font-bold text-center animate-in fade-in slide-in-from-bottom-2 ${
                                          saveMessage.includes('failed') || saveMessage.includes('blocked')
                                            ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50' 
                                            : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50'
                                        }`}
                                        data-testid="prompt-save-message"
                                      >
                                        {saveMessage}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Footer Validation Strip */}
                              {validationResult && (validationResult.errors?.length || validationResult.warnings?.length || validationResult.suggestions?.length) && (
                                <div className="bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-6 py-4" data-testid="prompt-validation-feedback">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Errors */}
                                    {validationResult.errors && validationResult.errors.length > 0 && (
                                      <div className="space-y-2" data-testid="prompt-validation-errors">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-red-500 uppercase tracking-[0.2em]">
                                          <i className="fas fa-times-circle"></i>
                                          Critical Errors
                                        </div>
                                        <ul className="space-y-1">
                                          {validationResult.errors.map((e, i) => (
                                            <li key={i} className="text-[11px] text-slate-600 dark:text-slate-400 pl-4 border-l border-red-500/30">{e}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {/* Warnings */}
                                    {validationResult.warnings && validationResult.warnings.length > 0 && (
                                      <div className="space-y-2" data-testid="prompt-validation-warnings">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em]">
                                          <i className="fas fa-exclamation-triangle"></i>
                                          Optimization Warnings
                                        </div>
                                        <ul className="space-y-1">
                                          {validationResult.warnings.map((w, i) => (
                                            <li key={i} className="text-[11px] text-slate-600 dark:text-slate-400 pl-4 border-l border-amber-500/30">{w}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {/* Suggestions */}
                                    {validationResult.suggestions && validationResult.suggestions.length > 0 && (
                                      <div className="space-y-2" data-testid="prompt-validation-suggestions">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em]">
                                          <i className="fas fa-lightbulb"></i>
                                          Lab Suggestions
                                        </div>
                                        <ul className="space-y-1">
                                          {validationResult.suggestions.map((s, i) => (
                                            <li key={i} className="text-[11px] text-slate-600 dark:text-slate-400 pl-4 border-l border-blue-500/30">{s}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TEST MODAL: VIRTUAL EXECUTION ENVIRONMENT ── */}
      {showTestModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[100] p-4 sm:p-6"
          style={{ background: 'rgba(15, 23, 42, 0.8)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeTestModal(); }}
          data-testid="prompt-test-modal"
        >
          <div
            className="rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <i className="fas fa-flask text-indigo-500 text-xs"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                    Virtual Execution Environment
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">Testing {activePromptId}</p>
                </div>
              </div>
              <button
                onClick={() => closeTestModal()}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-400"
                data-testid="prompt-test-close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              {/* Document Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <i className="fas fa-file-search text-[8px]"></i>
                    Select Test Subject
                  </h4>
                  <div className="flex items-center gap-3">
                    {docError && <span className="text-[10px] text-red-500 font-bold italic">{docError}</span>}
                    <button 
                      onClick={() => { if (recentDocuments.length === 0) fetchRecentDocuments(); }}
                      className={`text-[10px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-500 transition-all ${recentDocuments.length === 0 ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-200' : ''}`}
                      title="Load recent documents"
                      data-testid="test-lab-load-docs-btn"
                    >
                      {recentDocuments.length === 0 ? 'Load Documents' : <i className={`fas fa-sync-alt ${isLoadingDocs ? 'animate-spin' : ''}`}></i>}
                    </button>
                  </div>
                </div>

                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-500/20">
                      {isLoadingDocs && recentDocuments.length === 0 ? (
                        <div className="col-span-2 py-4 text-center text-[10px] text-slate-400 uppercase font-medium italic">
                          Scanning archives...
                        </div>
                      ) : recentDocuments.length === 0 ? (
                        <div className="col-span-2 py-4 text-center text-[10px] text-slate-400 uppercase font-medium italic">
                          Click "Load Documents" to start testing
                        </div>
                      ) : recentDocuments.map(doc => (
                        <button
                          key={doc.id}
                          disabled={pipelineExecuting}
                          onClick={() => handleDocumentSelect(doc.id)}
                          data-testid={`test-subject-doc-${doc.id}`}
                          className={`flex flex-col gap-0.5 p-2 rounded-lg border text-left transition-all ${
                            selectedDocumentId === String(doc.id)
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-400/50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <span className="text-[10px] font-bold truncate w-full">{doc.title}</span>
                          <span className={`text-[8px] font-mono opacity-60 ${selectedDocumentId === String(doc.id) ? 'text-indigo-100' : ''}`}>
                            ID: {doc.id} • {new Date(doc.created).toLocaleDateString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Data Preview */}
              {selectedDocumentData && (
                <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <i className="fas fa-eye text-[8px]"></i>
                      Extraction Subject Preview
                    </h4>
                    {selectedDocumentData.status === 'never_processed' && (
                      <button
                        onClick={() => handleDocumentSelect(Number(selectedDocumentId))}
                        disabled={pipelineExecuting}
                        className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all disabled:opacity-50"
                        data-testid="test-lab-process-btn"
                      >
                        {pipelineExecuting ? (
                          <i className="fas fa-circle-notch animate-spin mr-1"></i>
                        ) : (
                          <i className="fas fa-wand-magic-sparkles mr-1"></i>
                        )}
                        {pipelineExecuting ? 'Processing...' : 'Process Document'}
                      </button>
                    )}
                  </div>
                  <div className={`rounded-xl border transition-colors ${pipelineExecuting ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50'} p-3 space-y-2 relative`}>
                    {pipelineExecuting && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-[1px] z-10 rounded-xl">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Processing document...</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                      <span>Source: {selectedDocumentData.title}</span>
                      <span>{selectedDocumentData.content?.length || 0} characters</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 line-clamp-3 bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                      {selectedDocumentData.content || 'No text content available.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Pipeline Error Panel */}
              {pipelineError && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 overflow-hidden">
                    <button
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                      className="w-full flex items-center justify-between p-4 text-left"
                      data-testid="pipeline-error-toggle"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400">
                          <i className="fas fa-triangle-exclamation"></i>
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-red-800 dark:text-red-200 uppercase tracking-wider">
                            {pipelineError.message || 'Pipeline Completed with Errors'}
                          </h5>
                          <p className="text-[10px] text-red-600 dark:text-red-400/70 font-medium">
                            {pipelineError.stages.length > 0
                              ? `${pipelineError.stages.filter((s: PipelineStageResult) => s.status === 'error').length} of ${pipelineError.stages.length} stages failed`
                              : 'No stage diagnostics available'}
                          </p>
                        </div>
                      </div>
                      <i className={`fas fa-chevron-${showErrorDetails ? 'up' : 'down'} text-red-400`}></i>
                    </button>

                    {showErrorDetails && (
                      <div className="px-4 pb-4 space-y-2 border-t border-red-100 dark:border-red-900/30 pt-4" data-testid="pipeline-error-details">
                        {pipelineError.stages.map((stage: PipelineStageResult, idx: number) => (
                          <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-white/50 dark:bg-black/20 border border-red-100/50 dark:border-red-900/20" data-testid={`pipeline-stage-${stage.name}`}>
                            <div className={`mt-0.5 ${stage.status === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>
                              <i className={`fas ${stage.status === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-tight text-slate-700 dark:text-slate-300">
                                  {stage.name}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400">
                                  {stage.duration}ms
                                </span>
                              </div>
                              {stage.error && (
                                <p className="text-[10px] text-red-600 dark:text-red-400/80 mt-0.5 leading-tight italic">
                                  {stage.error}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Variable Inputs Grid */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <i className="fas fa-brackets-curly text-[8px]"></i>
                  Runtime Variables
                </h4>
                {visibleVariableEntries.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest flex flex-col items-center gap-3">
                      {pipelineExecuting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                          <span>Processing document...</span>
                        </>
                      ) : (
                        <span>{selectedDocumentId ? 'No runtime variables returned for this document.' : 'Select a document to populate runtime variables'}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleVariableEntries.map(([key, val]) => {
                      const isLocked = lockedVariables.has(key);
                      return (
                        <div key={key} className="flex flex-col gap-1.5 group/var">
                          <div className="flex items-center justify-between px-1">
                            <label className={`text-[10px] font-mono font-bold transition-colors ${
                              isLocked ? 'text-slate-400' : 'text-cyan-600 dark:text-cyan-400/70'
                            }`}>
                              {`{{${key}}}`}
                            </label>
                            <button
                              onClick={() => toggleVariableLock(key)}
                              disabled={pipelineExecuting}
                              className={`text-[10px] p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-all ${
                                isLocked ? 'text-slate-400' : 'text-cyan-500'
                              } disabled:opacity-30`}
                              title={isLocked ? 'Click to unlock' : 'Click to lock'}
                              type="button"
                              data-testid={`test-var-lock-${key}`}
                            >
                              <i className={`fas fa-lock${isLocked ? '' : '-open'} scale-90`}></i>
                            </button>
                          </div>
                          {String(val).length > 200 ? (
                            <textarea
                              value={val}
                              rows={4}
                              disabled={isLocked || pipelineExecuting}
                              className={`w-full border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono transition-all resize-none scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                                isLocked 
                                  ? 'bg-slate-100 dark:bg-slate-900/50 text-slate-500 cursor-not-allowed border-dashed' 
                                  : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200'
                              }`}
                              onInput={(e: Event) => {
                                const v = (e.target as HTMLTextAreaElement).value;
                                setTestVariables(prev => ({ ...prev, [key]: v }));
                              }}
                              data-testid={`test-var-${key}`}
                            />
                          ) : (
                            <input
                              type="text"
                              value={val}
                              disabled={isLocked || pipelineExecuting}
                              className={`w-full border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                                isLocked 
                                  ? 'bg-slate-100 dark:bg-slate-900/50 text-slate-500 cursor-not-allowed border-dashed' 
                                  : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200'
                              }`}
                              onInput={(e: Event) => {
                                const v = (e.target as HTMLInputElement).value;
                                setTestVariables(prev => ({ ...prev, [key]: v }));
                              }}
                              data-testid={`test-var-${key}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Execution Mode Selection */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <i className="fas fa-microchip text-[8px]"></i>
                  Execution Strategy
                </h4>
                <div className="flex p-0.5 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
                  <button
                    onClick={() => setTestMode('validate')}
                    data-testid="test-mode-validate"
                    className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-md transition-all ${
                      testMode === 'validate' 
                        ? 'bg-white dark:bg-slate-800 text-indigo-500 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Validate Template
                  </button>
                  <button
                    onClick={() => setTestMode('execute')}
                    data-testid="test-mode-execute"
                    className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-md transition-all ${
                      testMode === 'execute' 
                        ? 'bg-white dark:bg-slate-800 text-rose-500 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Execute Neural Simulation
                  </button>
                </div>
              </div>

              {/* Run Control */}
              <div className="flex items-center gap-4 py-4 border-y border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleTest}
                  disabled={isTesting || pipelineExecuting}
                  className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 text-white ${
                    testMode === 'execute' 
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20' 
                      : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                  } disabled:opacity-50`}
                  data-testid="prompt-test-run"
                >
                  {isTesting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <i className="fas fa-play text-[10px]"></i>}
                  {isTesting ? 'Simulating...' : 'Execute Test Run'}
                </button>
                <div className="flex-1 text-[10px] text-slate-400 font-medium">
                  {isTesting ? 'Synthesizing output using runtime context and active template logic...' : 'Ready for simulation. No changes will be persisted.'}
                </div>
              </div>

              {/* Test Results Display */}
              {(testResult || (isTesting && testStreamingResult)) && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="prompt-test-results">
                  {/* Critical Error Display */}
                  {testResult && !testResult.success && (
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center gap-3">
                      <i className="fas fa-exclamation-circle text-lg"></i>
                      <div className="flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-widest">Simulation Failed</div>
                        <div className="text-xs font-medium mt-0.5">{testResult.error || 'Test execution encountered an internal error.'}</div>
                      </div>
                    </div>
                  )}

                  {/* Result Metrics */}
                  <div className="flex flex-wrap gap-3">
                    <div className={`px-3 py-1.5 rounded-full border flex items-center gap-2 ${
                      !testResult ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500' :
                      testResult.success ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                    }`}>
                      <i className={`fas ${!testResult ? 'fa-circle-notch fa-spin' : testResult.success ? 'fa-check-circle' : 'fa-times-circle'} text-xs`}></i>
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {!testResult ? 'Executing...' : testResult.success ? 'Execution Successful' : 'Execution Failed'}
                      </span>
                    </div>

                    {/* Model Information */}
                    {(testResult?.model || (isTesting && testStreamingResult?.metadata?.model)) && (
                      <div className="px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center gap-2 shadow-sm">
                        <i className="fas fa-microchip text-xs"></i>
                        <span className="text-[10px] font-mono font-bold tracking-tighter">
                          {testResult?.model || (testStreamingResult?.metadata?.model as string | undefined)}
                        </span>
                      </div>
                    )}

                    {/* Guidance Status */}
                    {testResult && String(testResult.source).includes('guidance-service') && (
                      <div className="px-3 py-1.5 rounded-full border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 flex items-center gap-2 shadow-sm">
                        <i className="fas fa-shield-halved text-xs"></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">Guidance Active</span>
                        {testResult.guidanceMetadata?.source && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-cyan-500 text-white uppercase ml-1 shadow-[0_0_5px_rgba(6,182,212,0.5)]">
                            {testResult.guidanceMetadata.source}
                          </span>
                        )}
                      </div>
                    )}

                    {typeof testResult?.jsonValid === 'boolean' && (
                      <div className={`px-3 py-1.5 rounded-full border flex items-center gap-2 ${
                        testResult.jsonValid ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                      }`}>
                        <i className={`fas ${testResult.jsonValid ? 'fa-brackets-curly' : 'fa-bug'} text-xs`}></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">JSON {testResult.jsonValid ? 'Verified' : 'Corrupted'}</span>
                      </div>
                    )}
                    {testResult && testResult.duration !== undefined && (
                      <div className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <i className="fas fa-clock text-xs"></i>
                        <span className="text-[10px] font-bold tracking-wider">{testResult.duration}ms</span>
                      </div>
                    )}
                    {testResult && testResult.tokenEstimate && (
                      <div className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-2 shadow-sm">
                        <i className="fas fa-coins text-xs"></i>
                        <span className="text-[10px] font-bold tracking-wider">~{testResult.tokenEstimate} tokens</span>
                      </div>
                    )}
                  </div>

                  {/* Streaming & Thinking State */}
                  {isTesting && testStreamingResult && testStreamingResult.thinking && (
                    <div className="space-y-2 animate-pulse mb-6" data-testid="prompt-test-thinking-trace">
                      <h5 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <i className="fas fa-brain-circuit animate-bounce"></i>
                        Reasoning & Thought Trace
                      </h5>
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 font-mono text-[11px] leading-relaxed text-amber-700 dark:text-amber-400/80 max-h-32 overflow-y-auto whitespace-pre-wrap italic">
                        {testStreamingResult.thinking}
                      </div>
                    </div>
                  )}

                  {/* Rendered View */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reconstructed Prompt</h5>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 max-h-64 overflow-y-auto whitespace-pre-wrap">
                        {testResult?.renderedSystemPrompt || testStreamingResult?.metadata?.renderedSystemPrompt}
                        <div className="h-px w-full bg-slate-200 dark:bg-slate-800 my-4"></div>
                        {testResult?.renderedTemplate || testStreamingResult?.metadata?.renderedTemplate}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h5 className={`text-[10px] font-bold uppercase tracking-widest ml-1 ${testMode === 'execute' ? 'text-rose-500' : 'text-indigo-500'}`}>
                        {testMode === 'execute' ? 'Neural Simulation Output' : 'Validation Diagnostic'}
                      </h5>
                      <div data-testid="prompt-test-streaming-output" className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap shadow-inner ring-1 ring-inset ${testMode === 'execute' ? 'text-rose-900 dark:text-rose-50 ring-rose-500/5' : 'text-slate-900 dark:text-indigo-50 ring-indigo-500/5'}`}>
                        {isTesting && testStreamingResult
                          ? testStreamingResult.fullText
                          : testResult
                            ? (typeof testResult.testResult === 'string' ? testResult.testResult : JSON.stringify(testResult.testResult, null, 2))
                            : ''
                        }
                        {isTesting && <span data-testid="prompt-test-streaming-cursor" className="inline-block w-2 h-4 bg-rose-500 animate-pulse ml-1" />}
                      </div>
                    </div>
                  </div>

                  {/* Missing variables */}
                  {testResult && testResult.missingVariables && testResult.missingVariables.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 flex items-center gap-3">
                      <i className="fas fa-triangle-exclamation text-amber-500"></i>
                      <span className="text-[11px] text-amber-800 dark:text-amber-200 font-medium">
                        Unresolved Placeholders: {testResult.missingVariables.map((v: string) => `{{${v}}}`).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-950/50">
              <button
                onClick={() => closeTestModal()}
                className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Close Lab
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
