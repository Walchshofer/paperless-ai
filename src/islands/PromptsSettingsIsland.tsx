import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { PromptsSettings, PromptEntry, PromptConfig } from '../ui/contracts/Settings.Prompts.contract';
import { PromptsSettingsSchema } from '../ui/contracts/Settings.Prompts.contract';
import { RangeNumberInput } from './components/RangeNumberInput';

/**
 * PromptsSettingsIsland - Prompt template management
 *
 * Provides domain-grouped accordion of expert pipeline prompts
 * with inline editors for systemPrompt, userTemplate, and config knobs.
 */

const DOMAIN_ORDER = ['System', 'Medical', 'Financial', 'Legal', 'General'];

/** Extract {{variable}} names from text */
function extractVars(text: string): string[] {
  const matches = (text || '').match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2).trim()))];
}

export default function PromptsSettingsIsland(props: Partial<PromptsSettings>) {
  const validated = PromptsSettingsSchema.parse(props);

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
  const [showTestModal, setShowTestModal] = useState(false);
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Fetch prompts on mount
  useEffect(() => {
    fetchPrompts();
  }, []);

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
    setShowTestModal(false);
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
    try {
      const response = await fetch(`/api/prompts/${activePromptId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variables: testVariables,
          systemPrompt: editSystemPrompt,
          userTemplate: editUserTemplate,
        }),
      });
      const data = await response.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const openTestModal = () => {
    // Pre-populate test variables with placeholder values
    const vars = extractVars(editSystemPrompt + ' ' + editUserTemplate);
    const initial: Record<string, string> = {};
    for (const v of vars) {
      initial[v] = testVariables[v] || `sample_${v}`;
    }
    setTestVariables(initial);
    setTestResult(null);
    setShowTestModal(true);
  };

  // Group prompts by domain
  const groupedPrompts: Record<string, PromptEntry[]> = {};
  for (const domain of DOMAIN_ORDER) {
    groupedPrompts[domain] = prompts.filter(p => p.domain === domain);
  }

  // Compute template variables for current editor
  const editorVars = activePromptId
    ? [...new Set([...extractVars(editSystemPrompt), ...extractVars(editUserTemplate)])]
    : [];

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
    <div className="prompts-settings space-y-6 p-6 max-w-4xl" data-testid="prompts-settings-root">
      {/* Header */}
      <div className="space-y-2 mb-2">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Prompt Templates</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Manage expert pipeline prompt templates for local Ollama models
        </p>
        <div
          role="note"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Changes to prompts affect AI document processing. Only modify if you understand the template syntax.
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
        <div className="space-y-2">
          {DOMAIN_ORDER.map(domain => {
            const domainPrompts = groupedPrompts[domain] || [];
            if (domainPrompts.length === 0) return null;
            const isExpanded = expandedDomains.has(domain);

            return (
              <div key={domain} className="dev-section-panel" data-testid={`domain-group-${domain.toLowerCase()}`}>
                {/* Domain Header */}
                <button
                  onClick={() => toggleDomain(domain)}
                  className="domain-group-header w-full"
                  aria-expanded={isExpanded}
                  aria-controls={`domain-content-${domain.toLowerCase()}`}
                  data-testid={`domain-header-${domain.toLowerCase()}`}
                >
                  <div className="flex items-center gap-3">
                    <h3>{domain}</h3>
                    <span className="domain-count-badge">{domainPrompts.length}</span>
                  </div>
                  <Chevron open={isExpanded} />
                </button>

                {/* Prompt Rows */}
                {isExpanded && <div id={`domain-content-${domain.toLowerCase()}`} role="region" aria-label={`${domain} prompts`}>
                {domainPrompts.map((prompt, i) => (
                  <div key={prompt.id}>
                    {/* Row */}
                    <button
                      onClick={() => openEditor(prompt)}
                      className="prompt-row w-full"
                      data-active={String(activePromptId === prompt.id)}
                      aria-expanded={activePromptId === prompt.id}
                      aria-controls={`prompt-editor-panel-${prompt.id}`}
                      style={{ animationDelay: `${i * 40}ms` }}
                      data-testid={`prompt-row-${prompt.id.toLowerCase().replace(/_/g, '-')}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="prompt-id-label">{prompt.id}</span>
                        {prompt.isModified && (
                          <span className="prompt-modified-dot" title="Modified from default" data-testid={`prompt-modified-dot-${prompt.id.toLowerCase().replace(/_/g, '-')}`} />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="prompt-badge prompt-badge--model">{prompt.model}</span>
                        <span className="prompt-badge">{prompt.modelType}</span>
                      </div>
                    </button>

                    {/* Inline Editor */}
                    {activePromptId === prompt.id && (
                      <div className="prompt-editor-panel" id={`prompt-editor-panel-${prompt.id}`} role="region" aria-label={`Edit ${prompt.id}`} data-testid={`prompt-editor-${prompt.id.toLowerCase().replace(/_/g, '-')}`}>
                        {/* Metadata Badges */}
                        <div className="prompt-metadata-row">
                          <span className="prompt-badge">{prompt.id}</span>
                          <span className="prompt-badge">v{prompt.version || '1.0.0'}</span>
                          <span className="prompt-badge prompt-badge--domain">{prompt.domain}</span>
                          <span className="prompt-badge prompt-badge--model">{prompt.model}</span>
                          <span className="prompt-badge">{prompt.modelType}</span>
                          {prompt.category && <span className="prompt-badge">{prompt.category}</span>}
                        </div>

                        {/* Template Variables */}
                        {editorVars.length > 0 && (
                          <div className="mb-4">
                            <div className="flag-group-label" style={{ marginBottom: '0.5rem' }}>Template Variables</div>
                            <div className="flex flex-wrap gap-1.5">
                              {editorVars.map(v => (
                                <span key={v} className="template-var-pill">{`{{${v}}}`}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* System Prompt */}
                        <div className="space-y-2 mb-4">
                          <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            System Prompt
                          </label>
                          <textarea
                            className="mono-textarea"
                            value={editSystemPrompt}
                            onInput={(e: Event) => {
                              setEditSystemPrompt((e.target as HTMLTextAreaElement).value);
                              markEditorDirty();
                            }}
                            data-testid={`prompt-system-textarea-${prompt.id.toLowerCase().replace(/_/g, '-')}`}
                          />
                        </div>

                        {/* User Template */}
                        <div className="space-y-2 mb-4">
                          <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            User Template
                          </label>
                          <textarea
                            className="mono-textarea"
                            value={editUserTemplate}
                            onInput={(e: Event) => {
                              setEditUserTemplate((e.target as HTMLTextAreaElement).value);
                              markEditorDirty();
                            }}
                            data-testid={`prompt-user-textarea-${prompt.id.toLowerCase().replace(/_/g, '-')}`}
                          />
                        </div>

                        {/* Configuration Knobs */}
                        <div className="mb-4">
                          <div className="flag-group-label" style={{ marginBottom: '0.75rem' }}>Configuration</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <RangeNumberInput
                              id={`prompt-temp-${prompt.id}`}
                              label="Temperature"
                              description="Randomness of generation (0 = deterministic, 2 = max)"
                              value={editConfig.temperature}
                              min={0}
                              max={2}
                              step={0.05}
                              onChange={(v) => { setEditConfig(prev => ({ ...prev, temperature: v })); markEditorDirty(); }}
                              testId={`prompt-temperature-${prompt.id.toLowerCase().replace(/_/g, '-')}`}
                            />
                            <RangeNumberInput
                              id={`prompt-tokens-${prompt.id}`}
                              label="Max Tokens"
                              description="Maximum response tokens"
                              value={editConfig.maxTokens}
                              min={128}
                              max={8192}
                              step={128}
                              unit="tokens"
                              onChange={(v) => { setEditConfig(prev => ({ ...prev, maxTokens: v })); markEditorDirty(); }}
                              testId={`prompt-max-tokens-${prompt.id.toLowerCase().replace(/_/g, '-')}`}
                            />
                            <RangeNumberInput
                              id={`prompt-topk-${prompt.id}`}
                              label="Top K"
                              description="Number of top tokens to consider"
                              value={editConfig.topK}
                              min={1}
                              max={100}
                              step={1}
                              onChange={(v) => { setEditConfig(prev => ({ ...prev, topK: v })); markEditorDirty(); }}
                              testId={`prompt-top-k-${prompt.id.toLowerCase().replace(/_/g, '-')}`}
                            />
                            <RangeNumberInput
                              id={`prompt-topp-${prompt.id}`}
                              label="Top P"
                              description="Cumulative probability threshold"
                              value={editConfig.topP}
                              min={0}
                              max={1}
                              step={0.05}
                              onChange={(v) => { setEditConfig(prev => ({ ...prev, topP: v })); markEditorDirty(); }}
                              testId={`prompt-top-p-${prompt.id.toLowerCase().replace(/_/g, '-')}`}
                            />
                          </div>
                        </div>

                        {/* Validation Feedback */}
                        {validationResult && (
                          <div className="mb-4 space-y-2" data-testid="prompt-validation-feedback">
                            {/* Errors */}
                            {validationResult.errors && validationResult.errors.length > 0 && (
                              <div
                                className="p-3 rounded-lg text-sm"
                                style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                                data-testid="prompt-validation-errors"
                              >
                                <div className="font-medium mb-1">Validation Errors</div>
                                <ul className="list-disc list-inside space-y-0.5">
                                  {validationResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                              </div>
                            )}
                            {/* Warnings */}
                            {validationResult.warnings && validationResult.warnings.length > 0 && (
                              <div
                                className="p-3 rounded-lg text-sm"
                                style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
                                data-testid="prompt-validation-warnings"
                              >
                                <div className="font-medium mb-1">Warnings</div>
                                <ul className="list-disc list-inside space-y-0.5">
                                  {validationResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                              </div>
                            )}
                            {/* Suggestions */}
                            {validationResult.suggestions && validationResult.suggestions.length > 0 && (
                              <div
                                className="p-3 rounded-lg text-sm"
                                style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}
                                data-testid="prompt-validation-suggestions"
                              >
                                <div className="font-medium mb-1">Suggestions</div>
                                <ul className="list-disc list-inside space-y-0.5">
                                  {validationResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                              </div>
                            )}
                            {/* Quality Score */}
                            {validationResult.quality_score !== undefined && (
                              <div className="flex items-center gap-2" data-testid="prompt-quality-score">
                                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Quality:</span>
                                <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', maxWidth: '120px' }}>
                                  <div
                                    className="h-2 rounded-full transition-all"
                                    style={{
                                      width: `${Math.round(validationResult.quality_score * 100)}%`,
                                      background: validationResult.quality_score >= 0.7 ? '#22c55e' : validationResult.quality_score >= 0.5 ? '#f59e0b' : '#ef4444',
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                                  {Math.round(validationResult.quality_score * 100)}%
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions Bar */}
                        <div className="prompt-actions-bar">
                          <button
                            onClick={handleSave}
                            disabled={!isEditorDirty || isSaving}
                            className="save-bar-btn"
                            data-testid={`prompt-save-${prompt.id.toLowerCase().replace(/_/g, '-')}`}
                          >
                            {isSaving ? (
                              <>
                                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                              </>
                            ) : 'Save Changes'}
                          </button>

                          <button
                            onClick={handleReset}
                            disabled={isResetting}
                            className="prompt-reset-btn"
                            data-testid={`prompt-reset-${prompt.id.toLowerCase().replace(/_/g, '-')}`}
                          >
                            {isResetting ? 'Resetting...' : 'Reset to Default'}
                          </button>

                          <button
                            onClick={openTestModal}
                            className="prompt-reset-btn"
                            data-testid={`prompt-test-${prompt.id.toLowerCase().replace(/_/g, '-')}`}
                          >
                            Test
                          </button>

                          {saveMessage && (
                            <span
                              className="text-sm font-medium"
                              style={{ color: saveMessage.includes('failed') ? '#ef4444' : '#22c55e' }}
                              data-testid="prompt-save-message"
                            >
                              {saveMessage}
                            </span>
                          )}

                          {isEditorDirty && (
                            <span className="text-xs" style={{ color: '#f59e0b', marginLeft: 'auto' }}>
                              Unsaved changes
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                </div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowTestModal(false); }}
          data-testid="prompt-test-modal"
        >
          <div
            className="rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 space-y-4"
            style={{ background: 'var(--bg-primary, #1a1a2e)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Test Prompt: {activePromptId}
              </h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-sm px-2 py-1 rounded"
                style={{ color: 'var(--text-muted)' }}
              >
                Close
              </button>
            </div>

            {/* Variable Inputs */}
            {Object.keys(testVariables).length > 0 && (
              <div>
                <div className="flag-group-label" style={{ marginBottom: '0.5rem' }}>Template Variables</div>
                <div className="space-y-2">
                  {Object.entries(testVariables).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="template-var-pill text-xs" style={{ minWidth: '120px' }}>{`{{${key}}}`}</span>
                      <input
                        type="text"
                        value={val}
                        className="mono-textarea"
                        style={{ height: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onInput={(e: Event) => {
                          const v = (e.target as HTMLInputElement).value;
                          setTestVariables(prev => ({ ...prev, [key]: v }));
                        }}
                        data-testid={`test-var-${key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Run Test */}
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="save-bar-btn"
              data-testid="prompt-test-run"
            >
              {isTesting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Running...
                </>
              ) : 'Run Test'}
            </button>

            {/* Test Results */}
            {testResult && (
              <div className="space-y-3" data-testid="prompt-test-results">
                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="prompt-badge" style={{ background: testResult.success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: testResult.success ? '#22c55e' : '#ef4444' }}>
                    {testResult.success ? 'Success' : 'Failed'}
                  </span>
                  {testResult.source && <span className="prompt-badge">{testResult.source}</span>}
                  {testResult.duration !== undefined && <span className="prompt-badge">{testResult.duration}ms</span>}
                  {testResult.tokenEstimate && <span className="prompt-badge">~{testResult.tokenEstimate} tokens</span>}
                  {testResult.jsonValid !== null && (
                    <span className="prompt-badge" style={{ background: testResult.jsonValid ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: testResult.jsonValid ? '#22c55e' : '#ef4444' }}>
                      JSON {testResult.jsonValid ? 'Valid' : 'Invalid'}
                    </span>
                  )}
                </div>

                {/* Missing variables */}
                {testResult.missingVariables && testResult.missingVariables.length > 0 && (
                  <div
                    className="p-2 rounded-lg text-xs"
                    style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
                  >
                    Missing variables: {testResult.missingVariables.join(', ')}
                  </div>
                )}

                {/* Rendered template preview */}
                {testResult.renderedTemplate && (
                  <div>
                    <div className="flag-group-label" style={{ marginBottom: '0.25rem' }}>Rendered Template</div>
                    <pre
                      className="mono-textarea"
                      style={{ height: 'auto', maxHeight: '200px', overflow: 'auto', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}
                    >
                      {testResult.renderedTemplate}
                    </pre>
                  </div>
                )}

                {/* Test output */}
                {testResult.testResult && (
                  <div>
                    <div className="flag-group-label" style={{ marginBottom: '0.25rem' }}>Validation Output</div>
                    <pre
                      className="mono-textarea"
                      style={{ height: 'auto', maxHeight: '200px', overflow: 'auto', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}
                    >
                      {typeof testResult.testResult === 'string'
                        ? testResult.testResult
                        : JSON.stringify(testResult.testResult, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {testResult.error && (
                  <div
                    className="p-2 rounded-lg text-sm"
                    style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                  >
                    {testResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
