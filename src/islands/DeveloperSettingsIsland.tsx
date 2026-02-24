import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { DeveloperSettings } from '../ui/contracts/Settings.Developer.contract';
import { ToggleSwitch } from './components/ToggleSwitch';
import { ServiceTopology } from './components/ServiceTopology';
import { UsageBar } from './components/UsageBar';

/**
 * DeveloperSettingsIsland - Developer-only settings
 *
 * Accessible only when developer mode is enabled.
 * Contains feature flags (auto-save), environment variables (manual save),
 * and runtime state monitoring with service topology visualization.
 */

const STORAGE_KEY_DEVELOPER_MODE = 'settings:developerMode';

// Extended local type that includes legacy token-limit fields still used by this island
// (Token limits were moved to AI Provider settings in the contract, but the UI retains them)
type DeveloperSettingsLocal = Omit<Partial<DeveloperSettings>, 'environmentVariables'> & {
  environmentVariables?: Partial<NonNullable<DeveloperSettings['environmentVariables']>> & {
    tokenLimit?: string;
    responseTokens?: string;
    textQualityThreshold?: string;
    maxVisionPages?: string;
  };
};

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
  qdrant?: {
    connected?: boolean;
    documents?: number;
    details?: Array<{ name: string; label: string; vectors: number; status: string }>;
  };
  sidecars?: { visualRag?: boolean; guidance?: boolean; biasEngine?: boolean };
  backgroundSync?: { lastSync?: string; nextSync?: string; running?: boolean; documentsProcessed?: number };
}

export default function DeveloperSettingsIsland(props: Partial<DeveloperSettings>) {
  const [isLoading, setIsLoading] = useState(!props.featureFlags);
  const [configData, setConfigData] = useState<DeveloperSettingsLocal | null>(null);

  useEffect(() => {
    // OPTIMIZATION: Only fetch if we don't have config data yet
    if (configData) return;

    if (!props.featureFlags) {
      fetch('/api/settings/config')
        .then(res => res.json())
        .then(data => {
          if (data && data.developer) {
            setConfigData(data.developer);
          } else {
            setConfigData({});
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch developer config', err);
          setConfigData({});
          setIsLoading(false);
        });
    } else {
      setConfigData(props);
      setIsLoading(false);
    }
  }, [props.featureFlags, props, configData]);

  if (isLoading || !configData) {
    return (
      <div className="p-12 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <i className="fas fa-spinner fa-spin mr-2 text-blue-500"></i>
        Loading developer settings...
      </div>
    );
  }

  const validated = configData;

  // Developer mode visibility
  const initialDeveloperMode = ((): boolean => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY_DEVELOPER_MODE) === 'true';
  })();
  const [isDeveloperMode, setIsDeveloperMode] = useState(initialDeveloperMode);

  // Section collapse state
  const [featureFlagsExpanded, setFeatureFlagsExpanded] = useState(true);
  const [envVarsExpanded, setEnvVarsExpanded] = useState(false);
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
  // guidanceTimeout, visualRagTimeout moved to Connection Center

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null as string | null);

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

        const response = await fetch('/api/settings/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
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
        // Timeouts saved via Connection Center
      };

      const response = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
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
            {FEATURE_FLAG_GROUPS.map((group, _gi) => (
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

                <div className="p-3 rounded-md border border-blue-100 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-900/10 mt-2">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <i className="fas fa-arrow-right mr-2"></i>
                    Service timeouts (Guidance, Visual RAG) have been moved to the <strong>Connection Center</strong>.
                  </p>
                  <button
                    onClick={() => { window.location.hash = 'connection'; }}
                    className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Go to Connection Center
                  </button>
                </div>
              </div>
            </div>

            {/* Token Budget & Quality Settings (Relocated) */}
            <div className="flag-group stagger-child">
              <div className="flag-group-label">Token Budget & Quality</div>
              <div className="p-4 rounded-md border border-blue-100 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-900/10 mt-2">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <i className="fas fa-info-circle mr-2"></i>
                  Token limits, text quality thresholds, and vision page limits have been moved to the <strong>AI Provider</strong> settings for better grouping.
                </p>
                <button
                  onClick={() => { window.location.hash = 'ai-provider'; }}
                  className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Go to AI Provider Settings →
                </button>
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
                      <span className="runtime-kv-label">Indexed Documents</span>
                      <span className="runtime-kv-value">{runtimeState.qdrant.documents || 0}</span>
                    </div>
                    {runtimeState.qdrant.details && runtimeState.qdrant.details.length > 0 && (
                      <table style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                            <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 500, color: 'var(--text-muted)' }}>Collection</th>
                            <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontWeight: 500, color: 'var(--text-muted)' }}>Vectors</th>
                            <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontWeight: 500, color: 'var(--text-muted)' }}>Health</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runtimeState.qdrant.details.map((col) => (
                            <tr key={col.name} style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                              <td style={{ padding: '0.35rem 0.5rem' }}>{col.label}</td>
                              <td style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontVariantNumeric: 'tabular-nums' }}>{col.vectors.toLocaleString()}</td>
                              <td style={{ textAlign: 'right', padding: '0.35rem 0.5rem' }}>
                                <span className={col.status === 'green' ? 'status-ok' : 'status-error'}>
                                  {col.status === 'green' ? 'OK' : col.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
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
