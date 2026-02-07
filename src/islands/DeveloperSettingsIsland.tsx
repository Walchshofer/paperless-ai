import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { DeveloperSettings } from '../ui/contracts/Settings.Developer.contract';
import { DeveloperSettingsSchema } from '../ui/contracts/Settings.Developer.contract';
import { ToggleSwitch } from './components/ToggleSwitch';
import { ServiceTopology } from './components/ServiceTopology';
import { UsageBar } from './components/UsageBar';
import { RangeNumberInput } from './components/RangeNumberInput';

/**
 * DeveloperSettingsIsland - Developer-only settings
 *
 * Accessible only when developer mode is enabled.
 * Contains feature flags (auto-save), environment variables (manual save),
 * and runtime state monitoring with service topology visualization.
 */

const STORAGE_KEY_DEVELOPER_MODE = 'settings:developerMode';

// Feature flag groupings for visual organization
const FEATURE_FLAG_GROUPS = [
  {
    id: 'pipeline',
    label: 'AI Pipeline',
    flags: [
      { key: 'expertPipelineEnabled', label: 'Expert Pipeline', description: 'Enable domain-specific expert models' },
      { key: 'guidanceServiceEnabled', label: 'Guidance Service', description: 'Deterministic JSON extraction' },
      { key: 'summaryFallbackEnabled', label: 'Summary Fallback', description: 'Use summary fallback on errors' },
    ],
  },
  {
    id: 'visual',
    label: 'Visual Analysis',
    flags: [
      { key: 'visualRagEnabled', label: 'Visual RAG', description: 'Enable visual document analysis' },
      { key: 'visualRagSidecarEnabled', label: 'Visual RAG Sidecar', description: 'Use GPU-accelerated sidecar service' },
      { key: 'forceVisualRag', label: 'Force Visual RAG', description: 'Always use visual analysis' },
    ],
  },
  {
    id: 'integrity',
    label: 'System Integrity',
    flags: [
      { key: 'metricsEnabled', label: 'Model Metrics', description: 'Track model performance metrics' },
      { key: 'duplicateDetectionEnabled', label: 'Duplicate Detection', description: 'Prevent duplicate document processing' },
      { key: 'ocrCheckpointEnabled', label: 'OCR Checkpoint', description: 'Checkpoint after OCR step' },
    ],
  },
];

// Map feature flag keys to environment variable names
const FLAG_ENV_MAP: Record<string, string> = {
  expertPipelineEnabled: 'EXPERT_PIPELINE_ENABLED',
  visualRagEnabled: 'ENABLE_VISUAL_RAG',
  visualRagSidecarEnabled: 'ENABLE_VISUAL_RAG_SIDECAR',
  forceVisualRag: 'FORCE_VISUAL_RAG',
  guidanceServiceEnabled: 'GUIDANCE_SERVICE_ENABLED',
  metricsEnabled: 'ENABLE_MODEL_METRICS',
  duplicateDetectionEnabled: 'DUPLICATE_DETECTION_ENABLED',
  ocrCheckpointEnabled: 'OCR_CHECKPOINT_ENABLED',
  summaryFallbackEnabled: 'SUMMARY_FALLBACK_ENABLED',
};

interface RuntimeStateData {
  circuitBreaker?: { state: string; failures?: number; successes?: number };
  vram?: { used?: string; total?: string; utilization?: number };
  qdrant?: { connected?: boolean; collections?: number; documents?: number };
  sidecars?: { visualRag?: boolean; guidance?: boolean; biasEngine?: boolean };
  backgroundSync?: { lastSync?: string; nextSync?: string; running?: boolean; documentsProcessed?: number };
}

export default function DeveloperSettingsIsland(props: Partial<DeveloperSettings>) {
  const validated = DeveloperSettingsSchema.parse(props);

  // Developer mode visibility
  const initialDeveloperMode = ((): boolean => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY_DEVELOPER_MODE) === 'true';
  })();
  const [isDeveloperMode, setIsDeveloperMode] = useState(initialDeveloperMode);

  // Section collapse state
  const [featureFlagsExpanded, setFeatureFlagsExpanded] = useState(true);
  const [envVarsExpanded, setEnvVarsExpanded] = useState(false);
  const [ollamaLimitsExpanded, setOllamaLimitsExpanded] = useState(false);
  const [runtimeStateExpanded, setRuntimeStateExpanded] = useState(false);

  // Feature flags state - stored as a single object for cleaner management
  const [flags, setFlags] = useState({
    expertPipelineEnabled: validated.featureFlags?.expertPipelineEnabled ?? true,
    visualRagEnabled: validated.featureFlags?.visualRagEnabled ?? false,
    visualRagSidecarEnabled: validated.featureFlags?.visualRagSidecarEnabled ?? false,
    forceVisualRag: validated.featureFlags?.forceVisualRag ?? false,
    guidanceServiceEnabled: validated.featureFlags?.guidanceServiceEnabled ?? true,
    metricsEnabled: validated.featureFlags?.metricsEnabled ?? true,
    duplicateDetectionEnabled: validated.featureFlags?.duplicateDetectionEnabled ?? true,
    ocrCheckpointEnabled: validated.featureFlags?.ocrCheckpointEnabled ?? true,
    summaryFallbackEnabled: validated.featureFlags?.summaryFallbackEnabled ?? true,
  });

  // Environment variables state
  const [scanInterval, setScanInterval] = useState(validated.environmentVariables?.scanInterval || '*/30 * * * *');
  const [tokenLimit, setTokenLimit] = useState(validated.environmentVariables?.tokenLimit || 128000);
  const [responseTokens, setResponseTokens] = useState(validated.environmentVariables?.responseTokens || 4096);
  const [textQualityThreshold, setTextQualityThreshold] = useState(validated.environmentVariables?.textQualityThreshold || 60);
  const [maxVisionPages, setMaxVisionPages] = useState(validated.environmentVariables?.maxVisionPages || 4);
  const [guidanceTimeout, setGuidanceTimeout] = useState(validated.environmentVariables?.guidanceTimeout || 90000);
  const [visualRagTimeout, setVisualRagTimeout] = useState(validated.environmentVariables?.visualRagTimeout || 30000);

  // Ollama model limits state
  const [ollamaContextWindow, setOllamaContextWindow] = useState(validated.ollamaModelLimits?.ollamaContextWindow || 128000);
  const [ollamaMaxResponseTokens, setOllamaMaxResponseTokens] = useState(validated.ollamaModelLimits?.ollamaMaxResponseTokens || 4096);
  const [ollamaVisionContextWindow, setOllamaVisionContextWindow] = useState(validated.ollamaModelLimits?.ollamaVisionContextWindow || 32768);
  const [ollamaVisionMaxResponseTokens, setOllamaVisionMaxResponseTokens] = useState(validated.ollamaModelLimits?.ollamaVisionMaxResponseTokens || 2048);
  const [ollamaVisionImageTokens, setOllamaVisionImageTokens] = useState(validated.ollamaModelLimits?.ollamaVisionImageTokens || 1024);
  const [ollamaPlannerContextWindow, setOllamaPlannerContextWindow] = useState(validated.ollamaModelLimits?.ollamaPlannerContextWindow || 32768);
  const [ollamaPlannerMaxResponseTokens, setOllamaPlannerMaxResponseTokens] = useState(validated.ollamaModelLimits?.ollamaPlannerMaxResponseTokens || 2048);
  const [ollamaExpertContextWindow, setOllamaExpertContextWindow] = useState(validated.ollamaModelLimits?.ollamaExpertContextWindow || 128000);
  const [ollamaExpertMaxResponseTokens, setOllamaExpertMaxResponseTokens] = useState(validated.ollamaModelLimits?.ollamaExpertMaxResponseTokens || 4096);
  const [translationContextWindow, setTranslationContextWindow] = useState(validated.ollamaModelLimits?.translationContextWindow || 128000);

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null as string | null);

  // Ollama limits dirty/saving state
  const [isOllamaDirty, setIsOllamaDirty] = useState(false);
  const [isOllamaSaving, setIsOllamaSaving] = useState(false);
  const [ollamaSaveMessage, setOllamaSaveMessage] = useState(null as string | null);

  // Runtime state
  const [runtimeState, setRuntimeState] = useState(null as RuntimeStateData | null);
  const [isLoadingRuntimeState, setIsLoadingRuntimeState] = useState(false);
  const [runtimeStateError, setRuntimeStateError] = useState(null as string | null);
  const [runtimeRefreshKey, setRuntimeRefreshKey] = useState(0);

  const debounceTimerRef = useRef(null as number | null);
  const refreshIntervalRef = useRef(null as number | null);

  // Listen for developer mode toggle events
  useEffect(() => {
    const handleDeveloperToggle = (event: Event) => {
      const enabled = (event as CustomEvent).detail?.enabled ?? false;
      setIsDeveloperMode(enabled);
      if (!enabled) {
        setFeatureFlagsExpanded(false);
        setEnvVarsExpanded(false);
        setOllamaLimitsExpanded(false);
        setRuntimeStateExpanded(false);
      }
    };
    document.addEventListener('developer:toggled', handleDeveloperToggle as EventListener);
    return () => document.removeEventListener('developer:toggled', handleDeveloperToggle as EventListener);
  }, []);

  // Auto-clear save messages
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  useEffect(() => {
    if (ollamaSaveMessage) {
      const timer = setTimeout(() => setOllamaSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [ollamaSaveMessage]);

  // Fetch runtime state
  const fetchRuntimeState = async () => {
    setIsLoadingRuntimeState(true);
    setRuntimeStateError(null);
    try {
      const response = await fetch('/api/runtime/state');
      if (response.ok) {
        const data = await response.json();
        setRuntimeState(data);
        setRuntimeRefreshKey(k => k + 1);
      } else {
        setRuntimeStateError('Failed to fetch runtime state');
      }
    } catch (error) {
      setRuntimeStateError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoadingRuntimeState(false);
    }
  };

  // Auto-refresh runtime state
  useEffect(() => {
    if (runtimeStateExpanded) {
      fetchRuntimeState();
      refreshIntervalRef.current = setInterval(fetchRuntimeState, 10000) as unknown as number;
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [runtimeStateExpanded]);

  const handleFeatureFlagChange = (flagName: string, value: boolean) => {
    setFlags(prev => ({ ...prev, [flagName]: value }));

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const envName = FLAG_ENV_MAP[flagName];
        if (!envName) return;

        const settings: Record<string, string> = { [envName]: value ? 'yes' : 'no' };

        const response = await fetch('/settings/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'developer-feature-flags', settings, requiresRestart: false })
        });

        if (response.ok && typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:changed', {
            detail: { type: 'settings:changed', category: 'developer-feature-flags', settings, requiresRestart: false }
          }));
        }
      } catch (error) {
        console.error('Feature flag auto-save failed:', error);
      }
    }, validated.autoSaveDebounceMs || 500) as unknown as number;
  };

  const handleSaveEnvVars = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const settings = {
        SCAN_INTERVAL: scanInterval,
        TOKEN_LIMIT: tokenLimit.toString(),
        RESPONSE_TOKENS: responseTokens.toString(),
        TEXT_QUALITY_THRESHOLD: textQualityThreshold.toString(),
        MAX_VISION_PAGES: maxVisionPages.toString(),
        GUIDANCE_TIMEOUT: guidanceTimeout.toString(),
        VISUAL_RAG_TIMEOUT: visualRagTimeout.toString(),
      };

      const response = await fetch('/settings/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'developer-env-vars', settings, requiresRestart: true })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSaveMessage('Environment variables saved successfully');
        setIsDirty(false);
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:changed', {
            detail: { type: 'settings:changed', category: 'developer-env-vars', settings, requiresRestart: true }
          }));
          document.dispatchEvent(new CustomEvent('settings:restart-required', {
            detail: { type: 'settings:restart-required', reason: 'Developer environment variables changed', settings: ['Environment Variables'] }
          }));
          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: { type: 'settings:saved', category: 'developer-env-vars', success: true, message: 'Environment variables saved successfully' }
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

  const markDirty = () => setIsDirty(true);
  const markOllamaDirty = () => setIsOllamaDirty(true);

  const handleSaveOllamaLimits = async () => {
    setIsOllamaSaving(true);
    setOllamaSaveMessage(null);
    try {
      const settings: Record<string, string> = {
        OLLAMA_CONTEXT_WINDOW: ollamaContextWindow.toString(),
        OLLAMA_MAX_RESPONSE_TOKENS: ollamaMaxResponseTokens.toString(),
        OLLAMA_VISION_CONTEXT_WINDOW: ollamaVisionContextWindow.toString(),
        OLLAMA_VISION_MAX_RESPONSE_TOKENS: ollamaVisionMaxResponseTokens.toString(),
        OLLAMA_VISION_IMAGE_TOKENS: ollamaVisionImageTokens.toString(),
        OLLAMA_PLANNER_CONTEXT_WINDOW: ollamaPlannerContextWindow.toString(),
        OLLAMA_PLANNER_MAX_RESPONSE_TOKENS: ollamaPlannerMaxResponseTokens.toString(),
        OLLAMA_EXPERT_CONTEXT_WINDOW: ollamaExpertContextWindow.toString(),
        OLLAMA_EXPERT_MAX_RESPONSE_TOKENS: ollamaExpertMaxResponseTokens.toString(),
        TRANSLATION_CONTEXT_WINDOW: translationContextWindow.toString(),
      };

      const response = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setOllamaSaveMessage('Ollama model limits saved successfully');
        setIsOllamaDirty(false);
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: { type: 'settings:saved', category: 'developer-ollama-limits', success: true, message: 'Ollama model limits saved' }
          }));
          document.dispatchEvent(new CustomEvent('settings:restart-required', {
            detail: { type: 'settings:restart-required', reason: 'Ollama model limits changed', settings: ['Ollama Model Limits'] }
          }));
        }
      } else {
        setOllamaSaveMessage(`Save failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setOllamaSaveMessage(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsOllamaSaving(false);
    }
  };

  if (!isDeveloperMode) return null;

  // Build topology nodes from runtime state
  const topologyNodes = runtimeState ? [
    { id: 'paperless', label: 'Paperless-ngx', status: 'online' as const },
    { id: 'qdrant', label: 'Qdrant', status: (runtimeState.qdrant?.connected ? 'online' : 'offline') as 'online' | 'offline' | 'error' },
    { id: 'visual-rag', label: 'Visual RAG', status: (runtimeState.sidecars?.visualRag ? 'online' : 'offline') as 'online' | 'offline' | 'error' },
    { id: 'guidance', label: 'Guidance', status: (runtimeState.sidecars?.guidance ? 'online' : 'offline') as 'online' | 'offline' | 'error' },
    { id: 'bias-engine', label: 'Bias Engine', status: (runtimeState.sidecars?.biasEngine ? 'online' : 'offline') as 'online' | 'offline' | 'error' },
  ] : [];

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
    <div className="developer-settings space-y-4 p-6 max-w-4xl" data-testid="developer-settings-root">
      {/* Header */}
      <div className="space-y-2 mb-2">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Developer Settings</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Advanced configuration for developers and power users</p>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
          data-testid="developer-warning"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          These settings can affect system behavior. Only modify if you understand the implications.
        </div>
      </div>

      {/* ━━━ Feature Flags Section ━━━ */}
      <div className="dev-section-panel">
        <button
          onClick={() => setFeatureFlagsExpanded(!featureFlagsExpanded)}
          className="dev-section-header w-full"
          aria-expanded={featureFlagsExpanded}
          aria-controls="feature-flags-content"
          data-testid="feature-flags-header"
        >
          <div className="flex items-center gap-3">
            <h3>Feature Flags</h3>
            <span className="section-badge section-badge--autosave" data-testid="feature-flags-indicator">Auto-saves</span>
          </div>
          <Chevron open={featureFlagsExpanded} />
        </button>

        {featureFlagsExpanded && (
          <div id="feature-flags-content" data-testid="feature-flags-content">
            {FEATURE_FLAG_GROUPS.map((group, gi) => (
              <div key={group.id} className="flag-group stagger-child" data-testid={`flag-group-${group.id}`}>
                <div className="flag-group-label">{group.label}</div>
                {group.flags.map(flag => (
                  <ToggleSwitch
                    key={flag.key}
                    id={`flag-${flag.key}`}
                    label={flag.label}
                    description={flag.description}
                    checked={flags[flag.key as keyof typeof flags]}
                    onChange={(value) => handleFeatureFlagChange(flag.key, value)}
                    testId={`toggle-${flag.key}`}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ━━━ Environment Variables Section ━━━ */}
      <div className="dev-section-panel">
        <button
          onClick={() => setEnvVarsExpanded(!envVarsExpanded)}
          className="dev-section-header w-full"
          aria-expanded={envVarsExpanded}
          aria-controls="env-vars-content"
          data-testid="env-vars-header"
        >
          <div className="flex items-center gap-3">
            <h3>Environment Variables</h3>
            <span className="section-badge section-badge--manual" data-testid="env-vars-indicator">Manual save</span>
          </div>
          <Chevron open={envVarsExpanded} />
        </button>

        {envVarsExpanded && (
          <div id="env-vars-content" data-testid="env-vars-content">
            {/* Timing Group */}
            <div className="flag-group stagger-child">
              <div className="flag-group-label">Timing</div>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label htmlFor="scan-interval" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Scan Interval (cron)
                  </label>
                  <input
                    id="scan-interval"
                    type="text"
                    value={scanInterval}
                    onChange={(e: Event) => { setScanInterval((e.target as HTMLInputElement).value); markDirty(); }}
                    placeholder="*/30 * * * *"
                    className="w-full px-3 py-2 rounded-md text-sm"
                    style={{ border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}
                    data-testid="scan-interval-input"
                  />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cron expression for document scanning</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RangeNumberInput
                    id="guidance-timeout"
                    label="Guidance Timeout"
                    description="Timeout for guidance service calls"
                    value={guidanceTimeout}
                    min={1000}
                    max={300000}
                    step={1000}
                    unit="ms"
                    onChange={(v) => { setGuidanceTimeout(v); markDirty(); }}
                    testId="guidance-timeout-input"
                  />
                  <RangeNumberInput
                    id="visual-rag-timeout"
                    label="Visual RAG Timeout"
                    description="Timeout for visual RAG service calls"
                    value={visualRagTimeout}
                    min={1000}
                    max={300000}
                    step={1000}
                    unit="ms"
                    onChange={(v) => { setVisualRagTimeout(v); markDirty(); }}
                    testId="visual-rag-timeout-input"
                  />
                </div>
              </div>
            </div>

            {/* Token Budget Group */}
            <div className="flag-group stagger-child">
              <div className="flag-group-label">Token Budget</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                <RangeNumberInput
                  id="token-limit"
                  label="Token Limit"
                  description="Maximum context window size"
                  value={tokenLimit}
                  min={1024}
                  max={256000}
                  step={1024}
                  onChange={(v) => { setTokenLimit(v); markDirty(); }}
                  testId="token-limit-input"
                />
                <RangeNumberInput
                  id="response-tokens"
                  label="Response Tokens"
                  description="Maximum response length"
                  value={responseTokens}
                  min={256}
                  max={32768}
                  step={256}
                  onChange={(v) => { setResponseTokens(v); markDirty(); }}
                  testId="response-tokens-input"
                />
              </div>
            </div>

            {/* Quality Group */}
            <div className="flag-group stagger-child">
              <div className="flag-group-label">Quality</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                <div className="space-y-2">
                  <label htmlFor="text-quality" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Text Quality Threshold
                  </label>
                  <div className="range-number-group">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={textQualityThreshold}
                      onInput={(e: Event) => { setTextQualityThreshold(parseInt((e.target as HTMLInputElement).value)); markDirty(); }}
                      aria-label="Text quality slider"
                    />
                    <input
                      id="text-quality"
                      type="number"
                      min={0}
                      max={100}
                      value={textQualityThreshold}
                      onInput={(e: Event) => { setTextQualityThreshold(parseInt((e.target as HTMLInputElement).value)); markDirty(); }}
                      data-testid="text-quality-threshold-input"
                    />
                  </div>
                  <div className="usage-bar-track" style={{ marginTop: '0.25rem' }}>
                    <div
                      className="usage-bar-fill"
                      data-level={textQualityThreshold >= 80 ? 'ok' : textQualityThreshold >= 40 ? 'warn' : 'danger'}
                      style={{ width: `${textQualityThreshold}%` }}
                    />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Minimum OCR quality for text extraction ({textQualityThreshold}%)</p>
                </div>

                <RangeNumberInput
                  id="max-vision-pages"
                  label="Max Vision Pages"
                  description="Maximum pages for visual analysis"
                  value={maxVisionPages}
                  min={1}
                  max={20}
                  step={1}
                  onChange={(v) => { setMaxVisionPages(v); markDirty(); }}
                  testId="max-vision-pages-input"
                />
              </div>
            </div>

            {/* Save Bar */}
            <div className="save-bar">
              <button
                onClick={handleSaveEnvVars}
                disabled={!isDirty || isSaving}
                className="save-bar-btn"
                data-testid="save-env-vars-button"
              >
                {isSaving ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : 'Save Environment Variables'}
              </button>

              {saveMessage && (
                <span
                  className="text-sm font-medium"
                  style={{ color: saveMessage.startsWith('Save failed') ? '#ef4444' : '#22c55e' }}
                  data-testid="save-message"
                >
                  {saveMessage}
                </span>
              )}

              {isDirty && (
                <span className="text-xs" style={{ color: '#f59e0b', marginLeft: 'auto' }}>
                  Unsaved changes - restart required
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ━━━ Ollama Model Limits Section ━━━ */}
      <div className="dev-section-panel">
        <button
          onClick={() => setOllamaLimitsExpanded(!ollamaLimitsExpanded)}
          className="dev-section-header w-full"
          aria-expanded={ollamaLimitsExpanded}
          aria-controls="ollama-limits-content"
          data-testid="ollama-limits-header"
        >
          <div className="flex items-center gap-3">
            <h3>Ollama Model Limits</h3>
            <span className="local-badge" data-testid="ollama-limits-local-badge">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Local
            </span>
            <span className="section-badge section-badge--manual">Manual save</span>
          </div>
          <Chevron open={ollamaLimitsExpanded} />
        </button>

        {ollamaLimitsExpanded && (
          <div id="ollama-limits-content" data-testid="ollama-limits-content">
            {/* Info Notice */}
            <div
              className="mx-5 mt-4 p-3 rounded-lg text-xs"
              style={{ background: 'rgba(20, 184, 166, 0.06)', border: '1px solid rgba(20, 184, 166, 0.15)', color: 'var(--text-secondary)' }}
            >
              These limits apply to <strong style={{ color: '#14b8a6' }}>locally-hosted Ollama models</strong> only. Cloud providers (OpenAI, Azure) manage their own token limits.
            </div>

            {/* Inheritance Rail */}
            <div className="tier-rail mx-5 my-4">
              {/* TEXT (BASE) */}
              <div className="tier-group stagger-child" data-testid="tier-text">
                <div className="tier-label">Text (Base)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RangeNumberInput
                    id="ollama-context-window"
                    label="Context Window"
                    description="Maximum context for text models"
                    value={ollamaContextWindow}
                    min={1024}
                    max={256000}
                    step={1024}
                    unit="tokens"
                    onChange={(v) => { setOllamaContextWindow(v); markOllamaDirty(); }}
                    testId="tier-text-context-window"
                  />
                  <RangeNumberInput
                    id="ollama-max-response"
                    label="Max Response Tokens"
                    description="Maximum response length"
                    value={ollamaMaxResponseTokens}
                    min={256}
                    max={32768}
                    step={256}
                    unit="tokens"
                    onChange={(v) => { setOllamaMaxResponseTokens(v); markOllamaDirty(); }}
                    testId="tier-text-max-response"
                  />
                </div>
              </div>

              {/* VISION (capped 32k) */}
              <div className="tier-group stagger-child" data-testid="tier-vision">
                <div className="tier-label">
                  Vision
                  <span className="tier-cap-badge">capped 32k</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RangeNumberInput
                    id="ollama-vision-context"
                    label="Context Window"
                    description="Maximum context for vision models"
                    value={ollamaVisionContextWindow}
                    min={1024}
                    max={32768}
                    step={1024}
                    unit="tokens"
                    onChange={(v) => { setOllamaVisionContextWindow(v); markOllamaDirty(); }}
                    testId="tier-vision-context-window"
                  />
                  <RangeNumberInput
                    id="ollama-vision-response"
                    label="Max Response Tokens"
                    description="Maximum response length"
                    value={ollamaVisionMaxResponseTokens}
                    min={256}
                    max={8192}
                    step={256}
                    unit="tokens"
                    onChange={(v) => { setOllamaVisionMaxResponseTokens(v); markOllamaDirty(); }}
                    testId="tier-vision-max-response"
                  />
                </div>
                <div className="mt-3" style={{ maxWidth: '20rem' }}>
                  <RangeNumberInput
                    id="ollama-vision-image"
                    label="Image Token Overhead"
                    description="Token cost per image in vision context"
                    value={ollamaVisionImageTokens}
                    min={128}
                    max={4096}
                    step={128}
                    unit="tokens/image"
                    onChange={(v) => { setOllamaVisionImageTokens(v); markOllamaDirty(); }}
                    testId="tier-vision-image-tokens"
                  />
                </div>
              </div>

              {/* PLANNER (capped 32k) */}
              <div className="tier-group stagger-child" data-testid="tier-planner">
                <div className="tier-label">
                  Planner
                  <span className="tier-cap-badge">capped 32k</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RangeNumberInput
                    id="ollama-planner-context"
                    label="Context Window"
                    description="Maximum context for planner models"
                    value={ollamaPlannerContextWindow}
                    min={1024}
                    max={32768}
                    step={1024}
                    unit="tokens"
                    onChange={(v) => { setOllamaPlannerContextWindow(v); markOllamaDirty(); }}
                    testId="tier-planner-context-window"
                  />
                  <RangeNumberInput
                    id="ollama-planner-response"
                    label="Max Response Tokens"
                    description="Maximum response length"
                    value={ollamaPlannerMaxResponseTokens}
                    min={256}
                    max={8192}
                    step={256}
                    unit="tokens"
                    onChange={(v) => { setOllamaPlannerMaxResponseTokens(v); markOllamaDirty(); }}
                    testId="tier-planner-max-response"
                  />
                </div>
              </div>

              {/* EXPERT */}
              <div className="tier-group stagger-child" data-testid="tier-expert">
                <div className="tier-label">Expert</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RangeNumberInput
                    id="ollama-expert-context"
                    label="Context Window"
                    description="Maximum context for expert models"
                    value={ollamaExpertContextWindow}
                    min={1024}
                    max={256000}
                    step={1024}
                    unit="tokens"
                    onChange={(v) => { setOllamaExpertContextWindow(v); markOllamaDirty(); }}
                    testId="tier-expert-context-window"
                  />
                  <RangeNumberInput
                    id="ollama-expert-response"
                    label="Max Response Tokens"
                    description="Maximum response length"
                    value={ollamaExpertMaxResponseTokens}
                    min={256}
                    max={32768}
                    step={256}
                    unit="tokens"
                    onChange={(v) => { setOllamaExpertMaxResponseTokens(v); markOllamaDirty(); }}
                    testId="tier-expert-max-response"
                  />
                </div>
              </div>

              {/* TRANSLATION */}
              <div className="tier-group stagger-child" data-testid="tier-translation">
                <div className="tier-label">Translation</div>
                <div style={{ maxWidth: '20rem' }}>
                  <RangeNumberInput
                    id="translation-context"
                    label="Context Window"
                    description="Maximum context for translation"
                    value={translationContextWindow}
                    min={1024}
                    max={256000}
                    step={1024}
                    unit="tokens"
                    onChange={(v) => { setTranslationContextWindow(v); markOllamaDirty(); }}
                    testId="tier-translation-context-window"
                  />
                </div>
              </div>
            </div>

            {/* Save Bar */}
            <div className="save-bar">
              <button
                onClick={handleSaveOllamaLimits}
                disabled={!isOllamaDirty || isOllamaSaving}
                className="save-bar-btn"
                data-testid="save-ollama-limits-button"
              >
                {isOllamaSaving ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : 'Save Ollama Limits'}
              </button>

              {ollamaSaveMessage && (
                <span
                  className="text-sm font-medium"
                  style={{ color: ollamaSaveMessage.startsWith('Save failed') ? '#ef4444' : '#22c55e' }}
                  data-testid="ollama-save-message"
                >
                  {ollamaSaveMessage}
                </span>
              )}

              {isOllamaDirty && (
                <span className="text-xs" style={{ color: '#f59e0b', marginLeft: 'auto' }}>
                  Unsaved changes - restart required
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ━━━ Runtime State Section ━━━ */}
      <div className="dev-section-panel">
        <button
          onClick={() => setRuntimeStateExpanded(!runtimeStateExpanded)}
          className="dev-section-header w-full"
          aria-expanded={runtimeStateExpanded}
          aria-controls="runtime-state-content"
          data-testid="runtime-state-header"
        >
          <div className="flex items-center gap-3">
            <h3>Runtime State</h3>
            <span className="section-badge section-badge--readonly">Read-only</span>
          </div>
          <Chevron open={runtimeStateExpanded} />
        </button>

        {runtimeStateExpanded && (
          <div id="runtime-state-content" data-testid="runtime-state-content">
            {/* Refresh Controls */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Auto-refreshes every 10 seconds</p>
              <button
                onClick={fetchRuntimeState}
                disabled={isLoadingRuntimeState}
                className="save-bar-btn"
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                data-testid="refresh-runtime-state-button"
              >
                {isLoadingRuntimeState ? (
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Refresh
              </button>
            </div>

            {/* Error */}
            {runtimeStateError && (
              <div className="mx-5 mt-3 p-3 rounded-lg text-sm" style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' }} data-testid="runtime-state-error">
                {runtimeStateError}
              </div>
            )}

            {/* Service Topology */}
            {runtimeState && topologyNodes.length > 0 && (
              <ServiceTopology nodes={topologyNodes} />
            )}

            {/* Detail Cards */}
            {runtimeState && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5 pt-0" key={runtimeRefreshKey}>
                {/* Circuit Breaker */}
                {runtimeState.circuitBreaker && (
                  <div className="runtime-detail-card stagger-child" data-testid="circuit-breaker-status">
                    <h4>Circuit Breaker</h4>
                    <div className="runtime-kv">
                      <span className="runtime-kv-label">State</span>
                      <span className={`runtime-kv-value ${runtimeState.circuitBreaker.state === 'CLOSED' ? 'status-ok' : 'status-error'}`}>
                        {runtimeState.circuitBreaker.state}
                      </span>
                    </div>
                    <div className="runtime-kv">
                      <span className="runtime-kv-label">Failures</span>
                      <span className="runtime-kv-value">{runtimeState.circuitBreaker.failures || 0}</span>
                    </div>
                    <div className="runtime-kv">
                      <span className="runtime-kv-label">Successes</span>
                      <span className="runtime-kv-value">{runtimeState.circuitBreaker.successes || 0}</span>
                    </div>
                  </div>
                )}

                {/* VRAM Usage */}
                {runtimeState.vram && (
                  <div className="runtime-detail-card stagger-child" data-testid="vram-status">
                    <h4>VRAM Usage</h4>
                    <UsageBar
                      value={runtimeState.vram.utilization || 0}
                      max={100}
                      unit="%"
                    />
                    <div className="mt-2">
                      <div className="runtime-kv">
                        <span className="runtime-kv-label">Used</span>
                        <span className="runtime-kv-value">{runtimeState.vram.used || 'N/A'}</span>
                      </div>
                      <div className="runtime-kv">
                        <span className="runtime-kv-label">Total</span>
                        <span className="runtime-kv-value">{runtimeState.vram.total || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Qdrant */}
                {runtimeState.qdrant && (
                  <div className="runtime-detail-card stagger-child" data-testid="qdrant-status">
                    <h4>Qdrant Vector Store</h4>
                    <div className="runtime-kv">
                      <span className="runtime-kv-label">Status</span>
                      <span className={`runtime-kv-value ${runtimeState.qdrant.connected ? 'status-ok' : 'status-error'}`}>
                        {runtimeState.qdrant.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="runtime-kv">
                      <span className="runtime-kv-label">Collections</span>
                      <span className="runtime-kv-value">{runtimeState.qdrant.collections || 0}</span>
                    </div>
                    <div className="runtime-kv">
                      <span className="runtime-kv-label">Documents</span>
                      <span className="runtime-kv-value">{runtimeState.qdrant.documents || 0}</span>
                    </div>
                  </div>
                )}

                {/* Sidecar Status */}
                {runtimeState.sidecars && (
                  <div className="runtime-detail-card stagger-child" data-testid="sidecar-status">
                    <h4>AI Sidecars</h4>
                    <div className="runtime-kv">
                      <span className="runtime-kv-label">Visual RAG</span>
                      <span className={`runtime-kv-value ${runtimeState.sidecars.visualRag ? 'status-ok' : 'status-muted'}`}>
                        {runtimeState.sidecars.visualRag ? 'Running' : 'Offline'}
                      </span>
                    </div>
                    <div className="runtime-kv">
                      <span className="runtime-kv-label">Guidance</span>
                      <span className={`runtime-kv-value ${runtimeState.sidecars.guidance ? 'status-ok' : 'status-muted'}`}>
                        {runtimeState.sidecars.guidance ? 'Running' : 'Offline'}
                      </span>
                    </div>
                    <div className="runtime-kv">
                      <span className="runtime-kv-label">Bias Engine</span>
                      <span className={`runtime-kv-value ${runtimeState.sidecars.biasEngine ? 'status-ok' : 'status-muted'}`}>
                        {runtimeState.sidecars.biasEngine ? 'Running' : 'Offline'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Background Sync */}
                {runtimeState.backgroundSync && (
                  <div className="runtime-detail-card stagger-child md:col-span-2" data-testid="background-sync-status">
                    <h4>Background Sync</h4>
                    <div className="grid grid-cols-2 gap-x-4">
                      <div className="runtime-kv">
                        <span className="runtime-kv-label">Last Sync</span>
                        <span className="runtime-kv-value">{runtimeState.backgroundSync.lastSync || 'Never'}</span>
                      </div>
                      <div className="runtime-kv">
                        <span className="runtime-kv-label">Next Sync</span>
                        <span className="runtime-kv-value">{runtimeState.backgroundSync.nextSync || 'Not scheduled'}</span>
                      </div>
                      <div className="runtime-kv">
                        <span className="runtime-kv-label">Status</span>
                        <span className={`runtime-kv-value ${runtimeState.backgroundSync.running ? 'status-ok' : 'status-muted'}`}>
                          {runtimeState.backgroundSync.running ? 'Running' : 'Idle'}
                        </span>
                      </div>
                      <div className="runtime-kv">
                        <span className="runtime-kv-label">Processed</span>
                        <span className="runtime-kv-value">{runtimeState.backgroundSync.documentsProcessed || 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Loading */}
            {isLoadingRuntimeState && !runtimeState && (
              <div className="text-center py-10" style={{ color: 'var(--text-muted)' }} data-testid="runtime-state-loading">
                <div className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mb-3" />
                <div className="text-sm">Loading runtime state...</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
