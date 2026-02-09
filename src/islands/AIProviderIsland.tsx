import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { AIProviderSettings } from '../ui/contracts/Settings.AIProvider.contract';
import { AIProviderSettingsSchema } from '../ui/contracts/Settings.AIProvider.contract';
import { RangeNumberInput } from './components/RangeNumberInput';

/**
 * AIProviderIsland - AI Provider configuration with internal tabs
 *
 * Supports OpenAI, Ollama, Custom, and Azure providers with tabbed interface.
 * The Ollama tab consolidates all local model settings:
 *   - Connection, Base Models, System Pipeline Models, Domain Expert Models,
 *     Token Limits (moved from Developer Settings), and Advanced Services.
 */
import ExpertModelsIsland from './ExpertModelsIsland';

interface AIProviderProps extends Partial<AIProviderSettings> {
  expertModels?: Record<string, unknown>;
}

/** Inline tooltip: renders a circled "?" with hover text */
function Tooltip({ text }: { text: string }) {
  return (
    <span className="ai-tooltip-wrapper" data-testid="tooltip">
      <span className="ai-tooltip-icon" tabIndex={0} aria-label={text}>?</span>
      <span className="ai-tooltip-content">{text}</span>
    </span>
  );
}

/** Collapsible section header */
function CollapsibleSection({
  id, title, badge, expanded, onToggle, children, testId
}: {
  id: string;
  title: string;
  badge?: string;
  expanded: boolean;
  onToggle: () => void;
  children: preact.ComponentChildren;
  testId: string;
}) {
  return (
    <div className="ollama-collapsible-section" data-testid={testId}>
      <button
        onClick={onToggle}
        className="ollama-collapsible-header w-full"
        aria-expanded={expanded}
        aria-controls={id}
        data-testid={`${testId}-header`}
      >
        <div className="flex items-center gap-2">
          <h4 className="text-md font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h4>
          {badge && <span className="section-badge section-badge--manual">{badge}</span>}
        </div>
        <svg
          className={`ollama-chevron ${expanded ? 'ollama-chevron--open' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && <div id={id} className="ollama-collapsible-body">{children}</div>}
    </div>
  );
}

export default function AIProviderIsland(props: AIProviderProps) {
  const validated = AIProviderSettingsSchema.parse(props);

  type ProviderTab = 'general' | 'openai' | 'ollama' | 'custom' | 'azure';
  const [activeTab, setActiveTab] = useState('general' as ProviderTab);
  const [provider, setProvider] = useState((validated.provider || 'openai') as string);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null as string | null);

  // Ollama state - Base Models
  const [ollamaModel, setOllamaModel] = useState(validated.ollama?.model || 'sauerkraut-llama3.1:8b');
  const [ollamaVisionModel, setOllamaVisionModel] = useState(validated.ollama?.visionModel || 'qwen3-vl:8b');

  // Ollama state - System Pipeline Models
  const [ollamaRouterModel, setOllamaRouterModel] = useState(validated.ollama?.routerModel || '');
  const [ollamaPlannerModel, setOllamaPlannerModel] = useState(validated.ollama?.plannerModel || '');
  const [ollamaOrchestratorModel, setOllamaOrchestratorModel] = useState(validated.ollama?.orchestratorModel || '');

  // Ollama state - Advanced Services
  const [ollamaTranslationModel, setOllamaTranslationModel] = useState(validated.ollama?.translationModel || '');
  const [ollamaGuidanceModel, setOllamaGuidanceModel] = useState(validated.ollama?.guidanceModel || '');

  // Ollama state - Keep-alive
  const [ollamaVisionKeepAlive, setOllamaVisionKeepAlive] = useState(validated.ollama?.visionKeepAlive || '5m');
  const [ollamaTextKeepAlive, setOllamaTextKeepAlive] = useState(validated.ollama?.textKeepAlive || '2m');
  const [ollamaRouterKeepAlive, setOllamaRouterKeepAlive] = useState(validated.ollama?.routerKeepAlive || '5m');

  // Ollama token limits (consolidated from Developer Settings)
  const [ollamaTextContextWindow, setOllamaTextContextWindow] = useState(validated.ollama?.limits?.text?.contextWindow || 128000);
  const [ollamaTextMaxTokens, setOllamaTextMaxTokens] = useState(validated.ollama?.limits?.text?.maxResponseTokens || 4096);
  const [ollamaVisionContextWindow, setOllamaVisionContextWindow] = useState(validated.ollama?.limits?.vision?.contextWindow || 32768);
  const [ollamaVisionMaxTokens, setOllamaVisionMaxTokens] = useState(validated.ollama?.limits?.vision?.maxResponseTokens || 2048);
  const [ollamaPlannerContextWindow, setOllamaPlannerContextWindow] = useState(validated.ollama?.limits?.planner?.contextWindow || 32768);
  const [ollamaPlannerMaxTokens, setOllamaPlannerMaxTokens] = useState(validated.ollama?.limits?.planner?.maxResponseTokens || 2048);
  const [ollamaExpertContextWindow, setOllamaExpertContextWindow] = useState(validated.ollama?.limits?.expert?.contextWindow || 128000);
  const [ollamaExpertMaxTokens, setOllamaExpertMaxTokens] = useState(validated.ollama?.limits?.expert?.maxResponseTokens || 4096);
  const [ollamaImageTokenOverhead, setOllamaImageTokenOverhead] = useState(validated.ollama?.limits?.imageTokenOverhead || 1024);
  const [translationContextWindow, setTranslationContextWindow] = useState(validated.ollama?.limits?.translation?.contextWindow || 128000);

  // Custom provider state
  const [customModel, setCustomModel] = useState(validated.custom?.model || '');

  // Azure state
  const [azureDeploymentName, setAzureDeploymentName] = useState(validated.azure?.deploymentName || '');
  const [azureApiVersion, setAzureApiVersion] = useState(validated.azure?.apiVersion || '2023-05-15');

  // Collapsible section states for Ollama tab
  const [systemModelsExpanded, setSystemModelsExpanded] = useState(false);
  const [tokenLimitsExpanded, setTokenLimitsExpanded] = useState(false);
  const [advancedServicesExpanded, setAdvancedServicesExpanded] = useState(false);

  // Token limits dirty/saving state (separate from main save)
  const [isTokenLimitsDirty, setIsTokenLimitsDirty] = useState(false);
  const [isTokenLimitsSaving, setIsTokenLimitsSaving] = useState(false);
  const [tokenLimitsSaveMessage, setTokenLimitsSaveMessage] = useState(null as string | null);

  // Debounce timer for auto-save fields
  const debounceTimerRef = useRef(null as number | null);
  const hasPendingAutoSave = useRef(false);

  // Ref for expert models area to support sidebar focus/scroll
  const expertRef = useRef(null as HTMLDivElement | null);
  // Accessible announcement text for Expert Models visibility changes
  const [expertAnnouncement, setExpertAnnouncement] = useState(null as string | null);

  // Auto-clear save messages
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  useEffect(() => {
    if (tokenLimitsSaveMessage) {
      const timer = setTimeout(() => setTokenLimitsSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [tokenLimitsSaveMessage]);

  // Flush pending auto-save on unmount
  useEffect(() => {
    return () => {
      if (hasPendingAutoSave.current && debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        flushAutoSave();
      }
    };
  }, []);

  const flushAutoSave = () => {
    if (!hasPendingAutoSave.current) return;

    const autoSaveSettings = {
      OLLAMA_CONTEXT_WINDOW: ollamaTextContextWindow.toString(),
      OLLAMA_MAX_RESPONSE_TOKENS: ollamaTextMaxTokens.toString(),
      OLLAMA_VISION_CONTEXT_WINDOW: ollamaVisionContextWindow.toString(),
      OLLAMA_VISION_MAX_RESPONSE_TOKENS: ollamaVisionMaxTokens.toString(),
      OLLAMA_PLANNER_CONTEXT_WINDOW: ollamaPlannerContextWindow.toString(),
      OLLAMA_PLANNER_MAX_RESPONSE_TOKENS: ollamaPlannerMaxTokens.toString(),
      OLLAMA_EXPERT_CONTEXT_WINDOW: ollamaExpertContextWindow.toString(),
      OLLAMA_EXPERT_MAX_RESPONSE_TOKENS: ollamaExpertMaxTokens.toString(),
      OLLAMA_VISION_IMAGE_TOKENS: ollamaImageTokenOverhead.toString(),
    };

    fetch('/api/settings/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(autoSaveSettings)
    }).catch(err => console.error('Auto-save failed:', err));

    hasPendingAutoSave.current = false;
  };

  const handleAutoSaveField = () => {
    hasPendingAutoSave.current = true;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      flushAutoSave();
    }, validated.autoSaveDebounceMs || 1000) as unknown as number;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Flush any pending auto-save first
      if (hasPendingAutoSave.current && debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        flushAutoSave();
      }

      const settings: Record<string, unknown> = {
        AI_PROVIDER: provider,
      };

      // Add provider-specific settings
      if (provider === 'openai') {
        // API Key moved to Connection Center
      } else if (provider === 'ollama') {
        settings.OLLAMA_MODEL = ollamaModel;
        settings.OLLAMA_VISION_MODEL = ollamaVisionModel;
        if (ollamaPlannerModel) settings.PLANNER_MODEL = ollamaPlannerModel;
        if (ollamaRouterModel) settings.ROUTER_MODEL = ollamaRouterModel;
        if (ollamaOrchestratorModel) settings.ORCHESTRATOR_MODEL = ollamaOrchestratorModel;
        if (ollamaTranslationModel) settings.TRANSLATION_MODEL = ollamaTranslationModel;
        if (ollamaGuidanceModel) settings.GUIDANCE_MODEL = ollamaGuidanceModel;
        settings.VISION_KEEP_ALIVE = ollamaVisionKeepAlive;
        settings.TEXT_KEEP_ALIVE = ollamaTextKeepAlive;
        settings.ROUTER_KEEP_ALIVE = ollamaRouterKeepAlive;
      } else if (provider === 'custom') {
        settings.CUSTOM_MODEL = customModel;
      } else if (provider === 'azure') {
        settings.AZURE_DEPLOYMENT_NAME = azureDeploymentName;
        settings.AZURE_API_VERSION = azureApiVersion;
      }

      const response = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSaveMessage('AI provider settings saved successfully');
        setIsDirty(false);

        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:changed', {
            detail: {
              type: 'settings:changed',
              category: 'ai-provider',
              settings,
              requiresRestart: true
            }
          }));

          document.dispatchEvent(new CustomEvent('settings:restart-required', {
            detail: {
              type: 'settings:restart-required',
              reason: 'AI provider settings changed',
              settings: ['AI Provider', 'API Configuration']
            }
          }));

          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: {
              type: 'settings:saved',
              category: 'ai-provider',
              success: true,
              message: 'AI provider settings saved successfully'
            }
          }));
        }
      } else {
        setSaveMessage(`Save failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setSaveMessage(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTokenLimits = async () => {
    setIsTokenLimitsSaving(true);
    setTokenLimitsSaveMessage(null);
    try {
      const settings: Record<string, string> = {
        OLLAMA_CONTEXT_WINDOW: ollamaTextContextWindow.toString(),
        OLLAMA_MAX_RESPONSE_TOKENS: ollamaTextMaxTokens.toString(),
        OLLAMA_VISION_CONTEXT_WINDOW: ollamaVisionContextWindow.toString(),
        OLLAMA_VISION_MAX_RESPONSE_TOKENS: ollamaVisionMaxTokens.toString(),
        OLLAMA_VISION_IMAGE_TOKENS: ollamaImageTokenOverhead.toString(),
        OLLAMA_PLANNER_CONTEXT_WINDOW: ollamaPlannerContextWindow.toString(),
        OLLAMA_PLANNER_MAX_RESPONSE_TOKENS: ollamaPlannerMaxTokens.toString(),
        OLLAMA_EXPERT_CONTEXT_WINDOW: ollamaExpertContextWindow.toString(),
        OLLAMA_EXPERT_MAX_RESPONSE_TOKENS: ollamaExpertMaxTokens.toString(),
        TRANSLATION_CONTEXT_WINDOW: translationContextWindow.toString(),
      };

      const response = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTokenLimitsSaveMessage('Token limits saved successfully');
        setIsTokenLimitsDirty(false);
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: { type: 'settings:saved', category: 'ollama-token-limits', success: true, message: 'Token limits saved' }
          }));
          document.dispatchEvent(new CustomEvent('settings:restart-required', {
            detail: { type: 'settings:restart-required', reason: 'Ollama token limits changed', settings: ['Token Limits'] }
          }));
        }
      } else {
        setTokenLimitsSaveMessage(`Save failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setTokenLimitsSaveMessage(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTokenLimitsSaving(false);
    }
  };

  const markDirty = () => setIsDirty(true);
  const markTokenLimitsDirty = () => setIsTokenLimitsDirty(true);

  // Accessible announcement for Expert Models when provider changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (provider === 'ollama') {
      setExpertAnnouncement('Expert Models are now available.');
    } else {
      setExpertAnnouncement('Expert Models are available only when Ollama is selected as the AI provider.');
    }
    const t = setTimeout(() => setExpertAnnouncement(null), 3000);
    return () => clearTimeout(t);
  }, [provider]);

  // Listen for sidebar navigation focus (e.g., Expert Models shortcut)
  useEffect(() => {
    const onNavigate = (_e: Event) => {
      const detail = (_e as CustomEvent)?.detail || {};
      if (detail && detail.focus === 'expert-models') {
        setActiveTab('ollama');
        setTimeout(() => {
          if (expertRef.current) {
            try {
              expertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const switchBtn = expertRef.current.querySelector('[data-testid="switch-to-ollama-btn"]') as HTMLButtonElement | null;
              if (switchBtn && provider !== 'ollama') switchBtn.focus();
            } catch (err) { /* ignore */ }
          }
        }, 100);
      }
    };

    window.addEventListener('settings:category-changed', onNavigate as EventListener);
    return () => window.removeEventListener('settings:category-changed', onNavigate as EventListener);
  }, [provider]);

  // Reflect visibility state as string attributes for accessibility
  useEffect(() => {
    try {
      const area = expertRef.current?.querySelector('[data-testid="expert-models-area"]') as HTMLElement | null;
      const locked = expertRef.current?.querySelector('[data-testid="expert-models-locked"]') as HTMLElement | null;
      if (area) area.setAttribute('aria-hidden', String(provider !== 'ollama'));
      if (locked) locked.setAttribute('aria-hidden', String(provider === 'ollama'));
    } catch (err) { /* ignore */ }
  }, [provider]);

  /** Model input field with tooltip */
  const ModelInput = ({
    id, label, tooltip, value, onChange, placeholder, testId, required = false
  }: {
    id: string; label: string; tooltip: string; value: string;
    onChange: (v: string) => void; placeholder: string; testId: string; required?: boolean;
  }) => (
    <div className="space-y-2">
      <label htmlFor={id} className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {label}
        {required && <span style={{ color: '#ef4444' }}>*</span>}
        <Tooltip text={tooltip} />
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e: Event) => { onChange((e.target as HTMLInputElement).value); markDirty(); }}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-md text-sm"
        style={{ border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
        data-testid={testId}
      />
    </div>
  );

  return (
    <div className="ai-provider-settings space-y-6 p-6 max-w-4xl" data-testid="ai-provider-root">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>AI Provider Settings</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Configure AI provider and model settings</p>
      </div>

      {/* Tab Navigation */}
      <div style={{ borderBottom: '1px solid var(--border-color)' }}>
        <nav className="-mb-px flex space-x-8" data-testid="ai-provider-tabs">
          {(['general', 'openai', 'ollama', 'custom', 'azure'] as ProviderTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent hover:border-gray-300'
              }`}
              style={activeTab !== tab ? { color: 'var(--text-secondary)' } : undefined}
              data-testid={`tab-${tab}`}
            >
              {tab === 'general' ? 'General' : tab === 'openai' ? 'OpenAI' : tab === 'ollama' ? 'Ollama' : tab === 'custom' ? 'Custom' : 'Azure'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-4" data-testid="tab-content-general">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Provider Selection</h3>
            <div className="space-y-2">
              <label htmlFor="provider" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Active AI Provider <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="provider"
                value={provider}
                onChange={(e: Event) => {
                  setProvider((e.target as HTMLSelectElement).value as ProviderTab);
                  markDirty();
                }}
                className="w-full px-3 py-2 rounded-md"
                style={{ border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                data-testid="provider-select"
              >
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama (Local)</option>
                <option value="custom">Custom Provider</option>
                <option value="azure">Azure OpenAI</option>
              </select>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Select which AI provider to use for document processing
              </p>
            </div>
            <div className="mt-4 p-4 rounded" style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                <span className="font-medium">Current provider:</span> {provider}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Configure provider-specific settings in the respective tab
              </p>
            </div>
          </div>
        )}

        {/* OpenAI Tab */}
        {activeTab === 'openai' && (
          <div className="space-y-4" data-testid="tab-content-openai">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>OpenAI Configuration</h3>
            <div className="p-4 rounded-md border border-blue-100 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-900/10">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <i className="fas fa-info-circle mr-2"></i>
                The OpenAI API Key has been moved to the centralized <strong>Connection Center</strong>.
              </p>
              <button 
                onClick={() => window.location.hash = 'connection'}
                className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Go to Connection Center →
              </button>
            </div>
          </div>
        )}

        {/* ━━━ Ollama Tab ━━━ */}
        {activeTab === 'ollama' && (
          <div className="space-y-6" data-testid="tab-content-ollama">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Ollama Configuration</h3>

            {/* ── Section 1: Connection ── */}
            <div className="p-4 rounded-md border border-blue-100 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-900/10 mb-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <i className="fas fa-info-circle mr-2"></i>
                Ollama connection parameters (API URL) are now managed in the <strong>Connection Center</strong>.
              </p>
              <button 
                onClick={() => window.location.hash = 'connection'}
                className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Go to Connection Center →
              </button>
            </div>

            {/* ── Section 2: Base Models ── */}
            <div className="space-y-4" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h4 className="text-md font-medium" style={{ color: 'var(--text-primary)' }}>Base Models</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ModelInput
                  id="ollama-text-model"
                  label="Default Text Model"
                  tooltip="General-purpose text model used for chat, fallback extraction, and translation"
                  value={ollamaModel}
                  onChange={setOllamaModel}
                  placeholder="sauerkraut-llama3.1:8b"
                  testId="ollama-text-model-input"
                />
                <ModelInput
                  id="ollama-vision-model"
                  label="Default Vision Model"
                  tooltip="Multimodal model for document image analysis and visual extraction"
                  value={ollamaVisionModel}
                  onChange={setOllamaVisionModel}
                  placeholder="qwen3-vl:8b"
                  testId="ollama-vision-model-input"
                />
              </div>
            </div>

            {/* ── Section 3: System Pipeline Models (collapsible) ── */}
            <CollapsibleSection
              id="system-pipeline-models"
              title="System Pipeline Models"
              expanded={systemModelsExpanded}
              onToggle={() => setSystemModelsExpanded(!systemModelsExpanded)}
              testId="system-pipeline-section"
            >
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Models used by the internal expert pipeline stages. Leave blank to use defaults.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ModelInput
                  id="ollama-router-model"
                  label="Router Model"
                  tooltip="Classifies incoming documents to the correct domain expert. Uses vision for layout analysis."
                  value={ollamaRouterModel}
                  onChange={setOllamaRouterModel}
                  placeholder="qwen3-vl:8b (default)"
                  testId="ollama-router-model-input"
                />
                <ModelInput
                  id="ollama-planner-model"
                  label="Planner Model"
                  tooltip="Plans document extraction strategy and determines required analysis stages"
                  value={ollamaPlannerModel}
                  onChange={setOllamaPlannerModel}
                  placeholder="qwen3-vl:8b (default)"
                  testId="ollama-planner-model-input"
                />
                <ModelInput
                  id="ollama-orchestrator-model"
                  label="Orchestrator Model"
                  tooltip="Coordinates multi-stage expert pipeline execution and result merging"
                  value={ollamaOrchestratorModel}
                  onChange={setOllamaOrchestratorModel}
                  placeholder="nemotron-orchestrator:8b (default)"
                  testId="ollama-orchestrator-model-input"
                />
              </div>
            </CollapsibleSection>

            {/* ── Section 4: Domain Expert Models ── */}
            <div className="mt-2" ref={expertRef}>
              <div role="status" aria-live="polite" className="sr-only" data-testid="expert-models-announcement">{expertAnnouncement}</div>
              {provider === 'ollama' ? (
                <div data-testid="expert-models-area">
                  <ExpertModelsIsland {...(props.expertModels || {})} />
                </div>
              ) : (
                <div data-testid="expert-models-locked" role="region" aria-labelledby="expert-locked-label" aria-disabled="true"
                  className="p-3 rounded"
                  style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
                >
                  <p id="expert-locked-label" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Expert models are available only when <strong>Ollama</strong> is selected as the AI provider.
                  </p>
                  <button
                    data-testid="switch-to-ollama-btn"
                    aria-label="Switch to Ollama provider to enable Expert Models"
                    type="button"
                    onClick={() => { setProvider('ollama'); markDirty(); }}
                    className="mt-2 px-3 py-1 rounded text-sm"
                    style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--text-primary)' }}
                  >
                    Switch to Ollama
                  </button>
                </div>
              )}
            </div>

            {/* ── Section 5: Token Limits (consolidated from Developer Settings) ── */}
            <CollapsibleSection
              id="ollama-token-limits"
              title="Token Limits"
              badge="Manual save"
              expanded={tokenLimitsExpanded}
              onToggle={() => setTokenLimitsExpanded(!tokenLimitsExpanded)}
              testId="token-limits-section"
            >
              {/* Info Notice */}
              <div
                className="p-3 rounded-lg text-xs mb-4"
                style={{ background: 'rgba(20, 184, 166, 0.06)', border: '1px solid rgba(20, 184, 166, 0.15)', color: 'var(--text-secondary)' }}
              >
                These limits apply to <strong style={{ color: '#14b8a6' }}>locally-hosted Ollama models</strong> only.
                Cloud providers (OpenAI, Azure) manage their own token limits.
              </div>

              <div className="tier-rail">
                {/* TEXT (BASE) */}
                <div className="tier-group" data-testid="tier-text">
                  <div className="tier-label">
                    Text (Base)
                    <Tooltip text="Context and response limits for the default text model used in chat and fallback extraction" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RangeNumberInput
                      id="ollama-context-window"
                      label="Context Window"
                      description="Maximum context for text models"
                      value={ollamaTextContextWindow}
                      min={1024} max={256000} step={1024} unit="tokens"
                      onChange={(v) => { setOllamaTextContextWindow(v); markTokenLimitsDirty(); }}
                      testId="tier-text-context-window"
                    />
                    <RangeNumberInput
                      id="ollama-max-response"
                      label="Max Response Tokens"
                      description="Maximum response length"
                      value={ollamaTextMaxTokens}
                      min={256} max={32768} step={256} unit="tokens"
                      onChange={(v) => { setOllamaTextMaxTokens(v); markTokenLimitsDirty(); }}
                      testId="tier-text-max-response"
                    />
                  </div>
                </div>

                {/* VISION */}
                <div className="tier-group" data-testid="tier-vision">
                  <div className="tier-label">
                    Vision
                    <span className="tier-cap-badge">capped 32k</span>
                    <Tooltip text="Limits for vision/multimodal models used in document image analysis and visual extraction" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RangeNumberInput
                      id="ollama-vision-context"
                      label="Context Window"
                      description="Maximum context for vision models"
                      value={ollamaVisionContextWindow}
                      min={1024} max={32768} step={1024} unit="tokens"
                      onChange={(v) => { setOllamaVisionContextWindow(v); markTokenLimitsDirty(); }}
                      testId="tier-vision-context-window"
                    />
                    <RangeNumberInput
                      id="ollama-vision-response"
                      label="Max Response Tokens"
                      description="Maximum response length"
                      value={ollamaVisionMaxTokens}
                      min={256} max={8192} step={256} unit="tokens"
                      onChange={(v) => { setOllamaVisionMaxTokens(v); markTokenLimitsDirty(); }}
                      testId="tier-vision-max-response"
                    />
                  </div>
                  <div className="mt-3" style={{ maxWidth: '20rem' }}>
                    <RangeNumberInput
                      id="ollama-vision-image"
                      label="Image Token Overhead"
                      description="Token cost per image in vision context"
                      value={ollamaImageTokenOverhead}
                      min={128} max={4096} step={128} unit="tokens/image"
                      onChange={(v) => { setOllamaImageTokenOverhead(v); markTokenLimitsDirty(); }}
                      testId="tier-vision-image-tokens"
                    />
                  </div>
                </div>

                {/* PLANNER */}
                <div className="tier-group" data-testid="tier-planner">
                  <div className="tier-label">
                    Planner
                    <span className="tier-cap-badge">capped 32k</span>
                    <Tooltip text="Limits for the planner model that determines extraction strategy for each document" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RangeNumberInput
                      id="ollama-planner-context"
                      label="Context Window"
                      description="Maximum context for planner models"
                      value={ollamaPlannerContextWindow}
                      min={1024} max={32768} step={1024} unit="tokens"
                      onChange={(v) => { setOllamaPlannerContextWindow(v); markTokenLimitsDirty(); }}
                      testId="tier-planner-context-window"
                    />
                    <RangeNumberInput
                      id="ollama-planner-response"
                      label="Max Response Tokens"
                      description="Maximum response length"
                      value={ollamaPlannerMaxTokens}
                      min={256} max={8192} step={256} unit="tokens"
                      onChange={(v) => { setOllamaPlannerMaxTokens(v); markTokenLimitsDirty(); }}
                      testId="tier-planner-max-response"
                    />
                  </div>
                </div>

                {/* EXPERT */}
                <div className="tier-group" data-testid="tier-expert">
                  <div className="tier-label">
                    Expert
                    <Tooltip text="Limits for domain expert models (Medical, Financial, Legal) used in specialized extraction" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RangeNumberInput
                      id="ollama-expert-context"
                      label="Context Window"
                      description="Maximum context for expert models"
                      value={ollamaExpertContextWindow}
                      min={1024} max={256000} step={1024} unit="tokens"
                      onChange={(v) => { setOllamaExpertContextWindow(v); markTokenLimitsDirty(); }}
                      testId="tier-expert-context-window"
                    />
                    <RangeNumberInput
                      id="ollama-expert-response"
                      label="Max Response Tokens"
                      description="Maximum response length"
                      value={ollamaExpertMaxTokens}
                      min={256} max={32768} step={256} unit="tokens"
                      onChange={(v) => { setOllamaExpertMaxTokens(v); markTokenLimitsDirty(); }}
                      testId="tier-expert-max-response"
                    />
                  </div>
                </div>

                {/* TRANSLATION */}
                <div className="tier-group" data-testid="tier-translation">
                  <div className="tier-label">
                    Translation
                    <Tooltip text="Context window for the translation model. Falls back to the base text model if no dedicated translation model is set." />
                  </div>
                  <div style={{ maxWidth: '20rem' }}>
                    <RangeNumberInput
                      id="translation-context"
                      label="Context Window"
                      description="Maximum context for translation"
                      value={translationContextWindow}
                      min={1024} max={256000} step={1024} unit="tokens"
                      onChange={(v) => { setTranslationContextWindow(v); markTokenLimitsDirty(); }}
                      testId="tier-translation-context-window"
                    />
                  </div>
                </div>
              </div>

              {/* Save Bar */}
              <div className="save-bar">
                <button
                  onClick={handleSaveTokenLimits}
                  disabled={!isTokenLimitsDirty || isTokenLimitsSaving}
                  className="save-bar-btn"
                  data-testid="save-token-limits-button"
                >
                  {isTokenLimitsSaving ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : 'Save Token Limits'}
                </button>

                {tokenLimitsSaveMessage && (
                  <span
                    className="text-sm font-medium"
                    style={{ color: tokenLimitsSaveMessage.startsWith('Save failed') ? '#ef4444' : '#22c55e' }}
                    data-testid="token-limits-save-message"
                  >
                    {tokenLimitsSaveMessage}
                  </span>
                )}

                {isTokenLimitsDirty && (
                  <span className="text-xs" style={{ color: '#f59e0b', marginLeft: 'auto' }}>
                    Unsaved changes - restart required
                  </span>
                )}
              </div>
            </CollapsibleSection>

            {/* ── Section 6: Advanced Services (collapsible) ── */}
            <CollapsibleSection
              id="advanced-services"
              title="Advanced Services"
              expanded={advancedServicesExpanded}
              onToggle={() => setAdvancedServicesExpanded(!advancedServicesExpanded)}
              testId="advanced-services-section"
            >
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Dedicated models for specialized services. Leave blank to use the default text model.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ModelInput
                  id="ollama-translation-model"
                  label="Translation Model"
                  tooltip="Model for translating non-English documents. Falls back to base text model if left blank."
                  value={ollamaTranslationModel}
                  onChange={setOllamaTranslationModel}
                  placeholder="(uses default text model)"
                  testId="ollama-translation-model-input"
                />
                <ModelInput
                  id="ollama-guidance-model"
                  label="Guidance Model"
                  tooltip="Model for deterministic JSON extraction via the guidance service"
                  value={ollamaGuidanceModel}
                  onChange={setOllamaGuidanceModel}
                  placeholder="(uses default text model)"
                  testId="ollama-guidance-model-input"
                />
              </div>
            </CollapsibleSection>
          </div>
        )}

        {/* Custom Tab */}
        {activeTab === 'custom' && (
          <div className="space-y-4" data-testid="tab-content-custom">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Custom Provider Configuration</h3>
            <div className="p-4 rounded-md border border-blue-100 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-900/10">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <i className="fas fa-info-circle mr-2"></i>
                Custom endpoint URLs and API Keys are now managed in the <strong>Connection Center</strong>.
              </p>
              <button 
                onClick={() => window.location.hash = 'connection'}
                className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Go to Connection Center →
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="custom-model" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Model Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="custom-model"
                  type="text"
                  value={customModel}
                  onChange={(e: Event) => { setCustomModel((e.target as HTMLInputElement).value); markDirty(); }}
                  placeholder="model-name"
                  className="w-full px-3 py-2 rounded-md"
                  style={{ border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                  data-testid="custom-model-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Azure Tab */}
        {activeTab === 'azure' && (
          <div className="space-y-4" data-testid="tab-content-azure">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Azure OpenAI Configuration</h3>
            <div className="p-4 rounded-md border border-blue-100 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-900/10 mb-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <i className="fas fa-info-circle mr-2"></i>
                Azure Endpoints and API Keys are now managed in the <strong>Connection Center</strong>.
              </p>
              <button 
                onClick={() => window.location.hash = 'connection'}
                className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Go to Connection Center →
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="azure-deployment" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Deployment Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="azure-deployment"
                  type="text"
                  value={azureDeploymentName}
                  onChange={(e: Event) => { setAzureDeploymentName((e.target as HTMLInputElement).value); markDirty(); }}
                  placeholder="your-deployment-name"
                  className="w-full px-3 py-2 rounded-md"
                  style={{ border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                  data-testid="azure-deployment-input"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="azure-api-version" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  API Version
                </label>
                <input
                  id="azure-api-version"
                  type="text"
                  value={azureApiVersion}
                  onChange={(e: Event) => { setAzureApiVersion((e.target as HTMLInputElement).value); markDirty(); }}
                  placeholder="2023-05-15"
                  className="w-full px-3 py-2 rounded-md"
                  style={{ border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                  data-testid="azure-api-version-input"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Section */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="ai-provider-save-button"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>

        {saveMessage && (
          <div
            className="mt-3 p-3 rounded text-sm"
            style={{
              background: saveMessage.startsWith('Save failed') ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.06)',
              border: saveMessage.startsWith('Save failed') ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)',
              color: saveMessage.startsWith('Save failed') ? '#ef4444' : 'var(--text-primary)'
            }}
            data-testid="save-message"
          >
            {saveMessage}
          </div>
        )}

        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Changing AI provider settings requires a restart to take effect
        </p>
      </div>
    </div>
  );
}
