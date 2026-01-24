import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { DeveloperSettings } from '../ui/contracts/Settings.Developer.contract';
import { DeveloperSettingsSchema } from '../ui/contracts/Settings.Developer.contract';

/**
 * DeveloperSettingsIsland - Developer-only settings
 *
 * Accessible only when developer mode is enabled.
 * Contains feature flags (auto-save) and environment variables (manual save).
 */
const STORAGE_KEY_DEVELOPER_MODE = 'settings:developerMode';

export default function DeveloperSettingsIsland(props: Partial<DeveloperSettings>) {
  const validated = DeveloperSettingsSchema.parse(props);

  // Developer mode visibility state
  const [isDeveloperMode, setIsDeveloperMode] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY_DEVELOPER_MODE);
    return stored === 'true';
  });

  // Section collapse state
  const [featureFlagsExpanded, setFeatureFlagsExpanded] = useState(true);
  const [envVarsExpanded, setEnvVarsExpanded] = useState(false);
  const [runtimeStateExpanded, setRuntimeStateExpanded] = useState(false);

  // Feature flags state
  const [expertPipeline, setExpertPipeline] = useState(validated.featureFlags?.expertPipelineEnabled ?? true);
  const [visualRag, setVisualRag] = useState(validated.featureFlags?.visualRagEnabled ?? false);
  const [visualRagSidecar, setVisualRagSidecar] = useState(validated.featureFlags?.visualRagSidecarEnabled ?? false);
  const [forceVisualRag, setForceVisualRag] = useState(validated.featureFlags?.forceVisualRag ?? false);
  const [guidanceService, setGuidanceService] = useState(validated.featureFlags?.guidanceServiceEnabled ?? true);
  const [metrics, setMetrics] = useState(validated.featureFlags?.metricsEnabled ?? true);
  const [duplicateDetection, setDuplicateDetection] = useState(validated.featureFlags?.duplicateDetectionEnabled ?? true);
  const [ocrCheckpoint, setOcrCheckpoint] = useState(validated.featureFlags?.ocrCheckpointEnabled ?? true);
  const [summaryFallback, setSummaryFallback] = useState(validated.featureFlags?.summaryFallbackEnabled ?? true);

  // Environment variables state
  const [disableAutoProcessing, setDisableAutoProcessing] = useState(validated.environmentVariables?.disableAutomaticProcessing || 'no');
  const [scanInterval, setScanInterval] = useState(validated.environmentVariables?.scanInterval || '*/30 * * * *');
  const [tokenLimit, setTokenLimit] = useState(validated.environmentVariables?.tokenLimit || 128000);
  const [responseTokens, setResponseTokens] = useState(validated.environmentVariables?.responseTokens || 4096);
  const [textQualityThreshold, setTextQualityThreshold] = useState(validated.environmentVariables?.textQualityThreshold || 60);
  const [maxVisionPages, setMaxVisionPages] = useState(validated.environmentVariables?.maxVisionPages || 4);
  const [guidanceTimeout, setGuidanceTimeout] = useState(validated.environmentVariables?.guidanceTimeout || 90000);
  const [visualRagTimeout, setVisualRagTimeout] = useState(validated.environmentVariables?.visualRagTimeout || 30000);

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Runtime state
  const [runtimeState, setRuntimeState] = useState<any>(null);
  const [isLoadingRuntimeState, setIsLoadingRuntimeState] = useState(false);
  const [runtimeStateError, setRuntimeStateError] = useState<string | null>(null);

  // Debounce timer for feature flag auto-save
  const debounceTimerRef = useRef<number | null>(null);
  // Auto-refresh interval for runtime state
  const refreshIntervalRef = useRef<number | null>(null);

  // Listen for developer mode toggle events
  useEffect(() => {
    const handleDeveloperToggle = (event: CustomEvent) => {
      const enabled = event.detail?.enabled ?? false;
      setIsDeveloperMode(enabled);

      // If developer mode is being disabled, collapse all sections
      if (!enabled) {
        setFeatureFlagsExpanded(false);
        setEnvVarsExpanded(false);
        setRuntimeStateExpanded(false);
      }
    };

    document.addEventListener('developer:toggled', handleDeveloperToggle as EventListener);

    return () => {
      document.removeEventListener('developer:toggled', handleDeveloperToggle as EventListener);
    };
  }, []);

  // Auto-clear save message
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
      } else {
        setRuntimeStateError('Failed to fetch runtime state');
      }
    } catch (error) {
      setRuntimeStateError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoadingRuntimeState(false);
    }
  };

  // Auto-refresh runtime state when section is expanded
  useEffect(() => {
    if (runtimeStateExpanded) {
      // Fetch immediately when expanded
      fetchRuntimeState();

      // Set up 10s auto-refresh
      refreshIntervalRef.current = setInterval(() => {
        fetchRuntimeState();
      }, 10000) as unknown as number;
    } else {
      // Clear interval when collapsed
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [runtimeStateExpanded]);

  const handleFeatureFlagChange = async (flagName: string, value: boolean) => {
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce and auto-save
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const settings: Record<string, string> = {};

        // Map feature flag to environment variable name
        switch (flagName) {
          case 'expertPipelineEnabled':
            settings.EXPERT_PIPELINE_ENABLED = value ? 'yes' : 'no';
            break;
          case 'visualRagEnabled':
            settings.ENABLE_VISUAL_RAG = value ? 'yes' : 'no';
            break;
          case 'visualRagSidecarEnabled':
            settings.ENABLE_VISUAL_RAG_SIDECAR = value ? 'yes' : 'no';
            break;
          case 'forceVisualRag':
            settings.FORCE_VISUAL_RAG = value ? 'yes' : 'no';
            break;
          case 'guidanceServiceEnabled':
            settings.GUIDANCE_SERVICE_ENABLED = value ? 'yes' : 'no';
            break;
          case 'metricsEnabled':
            settings.ENABLE_MODEL_METRICS = value ? 'yes' : 'no';
            break;
          case 'duplicateDetectionEnabled':
            settings.DUPLICATE_DETECTION_ENABLED = value ? 'yes' : 'no';
            break;
          case 'ocrCheckpointEnabled':
            settings.OCR_CHECKPOINT_ENABLED = value ? 'yes' : 'no';
            break;
          case 'summaryFallbackEnabled':
            settings.SUMMARY_FALLBACK_ENABLED = value ? 'yes' : 'no';
            break;
        }

        const response = await fetch('/settings/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'developer-feature-flags',
            settings,
            requiresRestart: false // Most feature flags don't require restart
          })
        });

        if (response.ok) {
          // Dispatch settings changed event
          if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('settings:changed', {
              detail: {
                type: 'settings:changed',
                category: 'developer-feature-flags',
                settings,
                requiresRestart: false
              }
            }));
          }
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
        DISABLE_AUTOMATIC_PROCESSING: disableAutoProcessing,
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
        body: JSON.stringify({
          category: 'developer-env-vars',
          settings,
          requiresRestart: true // Environment variables require restart
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSaveMessage('Environment variables saved successfully');
        setIsDirty(false);

        // Dispatch events
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:changed', {
            detail: {
              type: 'settings:changed',
              category: 'developer-env-vars',
              settings,
              requiresRestart: true
            }
          }));

          document.dispatchEvent(new CustomEvent('settings:restart-required', {
            detail: {
              type: 'settings:restart-required',
              reason: 'Developer environment variables changed',
              settings: ['Environment Variables']
            }
          }));

          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: {
              type: 'settings:saved',
              category: 'developer-env-vars',
              success: true,
              message: 'Environment variables saved successfully'
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

  const markDirty = () => setIsDirty(true);

  // Hide island if developer mode is disabled
  if (!isDeveloperMode) {
    return null;
  }

  return (
    <div className="developer-settings space-y-6 p-6 max-w-4xl" data-testid="developer-settings-root">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Developer Settings</h2>
        <p className="text-gray-600">Advanced configuration for developers and power users</p>
        <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2" data-testid="developer-warning">
          ⚠️ Warning: These settings can affect system behavior. Only modify if you understand the implications.
        </p>
      </div>

      {/* Feature Flags Section */}
      <div className="border rounded-lg">
        <button
          onClick={() => setFeatureFlagsExpanded(!featureFlagsExpanded)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          data-testid="feature-flags-header"
        >
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold">Feature Flags</h3>
            <span className="text-xs text-gray-500 italic" data-testid="feature-flags-indicator">Auto-saves on change</span>
          </div>
          <svg
            className={`w-5 h-5 transition-transform ${featureFlagsExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {featureFlagsExpanded && (
          <div className="p-4 space-y-4" data-testid="feature-flags-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Expert Pipeline */}
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <label htmlFor="flag-expert-pipeline" className="block text-sm font-medium text-gray-700">
                    Expert Pipeline
                  </label>
                  <p className="text-xs text-gray-500">Enable domain-specific expert models</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="flag-expert-pipeline"
                    type="checkbox"
                    checked={expertPipeline}
                    onChange={(e) => {
                      const value = (e.target as HTMLInputElement).checked;
                      setExpertPipeline(value);
                      handleFeatureFlagChange('expertPipelineEnabled', value);
                    }}
                    className="sr-only peer"
                    data-testid="toggle-expertPipelineEnabled"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Visual RAG */}
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <label htmlFor="flag-visual-rag" className="block text-sm font-medium text-gray-700">
                    Visual RAG
                  </label>
                  <p className="text-xs text-gray-500">Enable visual document analysis</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="flag-visual-rag"
                    type="checkbox"
                    checked={visualRag}
                    onChange={(e) => {
                      const value = (e.target as HTMLInputElement).checked;
                      setVisualRag(value);
                      handleFeatureFlagChange('visualRagEnabled', value);
                    }}
                    className="sr-only peer"
                    data-testid="toggle-visualRagEnabled"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Visual RAG Sidecar */}
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <label htmlFor="flag-visual-rag-sidecar" className="block text-sm font-medium text-gray-700">
                    Visual RAG Sidecar
                  </label>
                  <p className="text-xs text-gray-500">Use GPU-accelerated sidecar service</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="flag-visual-rag-sidecar"
                    type="checkbox"
                    checked={visualRagSidecar}
                    onChange={(e) => {
                      const value = (e.target as HTMLInputElement).checked;
                      setVisualRagSidecar(value);
                      handleFeatureFlagChange('visualRagSidecarEnabled', value);
                    }}
                    className="sr-only peer"
                    data-testid="toggle-visualRagSidecarEnabled"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Force Visual RAG */}
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <label htmlFor="flag-force-visual-rag" className="block text-sm font-medium text-gray-700">
                    Force Visual RAG
                  </label>
                  <p className="text-xs text-gray-500">Always use visual analysis</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="flag-force-visual-rag"
                    type="checkbox"
                    checked={forceVisualRag}
                    onChange={(e) => {
                      const value = (e.target as HTMLInputElement).checked;
                      setForceVisualRag(value);
                      handleFeatureFlagChange('forceVisualRag', value);
                    }}
                    className="sr-only peer"
                    data-testid="toggle-forceVisualRag"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Guidance Service */}
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <label htmlFor="flag-guidance" className="block text-sm font-medium text-gray-700">
                    Guidance Service
                  </label>
                  <p className="text-xs text-gray-500">Deterministic JSON extraction</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="flag-guidance"
                    type="checkbox"
                    checked={guidanceService}
                    onChange={(e) => {
                      const value = (e.target as HTMLInputElement).checked;
                      setGuidanceService(value);
                      handleFeatureFlagChange('guidanceServiceEnabled', value);
                    }}
                    className="sr-only peer"
                    data-testid="toggle-guidanceServiceEnabled"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Metrics */}
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <label htmlFor="flag-metrics" className="block text-sm font-medium text-gray-700">
                    Model Metrics
                  </label>
                  <p className="text-xs text-gray-500">Track model performance metrics</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="flag-metrics"
                    type="checkbox"
                    checked={metrics}
                    onChange={(e) => {
                      const value = (e.target as HTMLInputElement).checked;
                      setMetrics(value);
                      handleFeatureFlagChange('metricsEnabled', value);
                    }}
                    className="sr-only peer"
                    data-testid="toggle-metricsEnabled"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Duplicate Detection */}
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <label htmlFor="flag-duplicate-detection" className="block text-sm font-medium text-gray-700">
                    Duplicate Detection
                  </label>
                  <p className="text-xs text-gray-500">Prevent duplicate document processing</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="flag-duplicate-detection"
                    type="checkbox"
                    checked={duplicateDetection}
                    onChange={(e) => {
                      const value = (e.target as HTMLInputElement).checked;
                      setDuplicateDetection(value);
                      handleFeatureFlagChange('duplicateDetectionEnabled', value);
                    }}
                    className="sr-only peer"
                    data-testid="toggle-duplicateDetectionEnabled"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* OCR Checkpoint */}
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <label htmlFor="flag-ocr-checkpoint" className="block text-sm font-medium text-gray-700">
                    OCR Checkpoint
                  </label>
                  <p className="text-xs text-gray-500">Checkpoint after OCR step</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="flag-ocr-checkpoint"
                    type="checkbox"
                    checked={ocrCheckpoint}
                    onChange={(e) => {
                      const value = (e.target as HTMLInputElement).checked;
                      setOcrCheckpoint(value);
                      handleFeatureFlagChange('ocrCheckpointEnabled', value);
                    }}
                    className="sr-only peer"
                    data-testid="toggle-ocrCheckpointEnabled"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Summary Fallback */}
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <label htmlFor="flag-summary-fallback" className="block text-sm font-medium text-gray-700">
                    Summary Fallback
                  </label>
                  <p className="text-xs text-gray-500">Use summary fallback on errors</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="flag-summary-fallback"
                    type="checkbox"
                    checked={summaryFallback}
                    onChange={(e) => {
                      const value = (e.target as HTMLInputElement).checked;
                      setSummaryFallback(value);
                      handleFeatureFlagChange('summaryFallbackEnabled', value);
                    }}
                    className="sr-only peer"
                    data-testid="toggle-summaryFallbackEnabled"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Environment Variables Section */}
      <div className="border rounded-lg">
        <button
          onClick={() => setEnvVarsExpanded(!envVarsExpanded)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          data-testid="env-vars-header"
        >
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold">Environment Variables</h3>
            <span className="text-xs text-gray-500 italic" data-testid="env-vars-indicator">Manual save required</span>
          </div>
          <svg
            className={`w-5 h-5 transition-transform ${envVarsExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {envVarsExpanded && (
          <div className="p-4 space-y-4" data-testid="env-vars-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scan Interval */}
              <div className="space-y-2">
                <label htmlFor="scan-interval" className="block text-sm font-medium text-gray-700">
                  Scan Interval (cron)
                </label>
                <input
                  id="scan-interval"
                  type="text"
                  value={scanInterval}
                  onChange={(e) => {
                    setScanInterval((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="*/30 * * * *"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="scan-interval-input"
                />
                <p className="text-xs text-gray-500">Cron expression for document scanning</p>
              </div>

              {/* Token Limit */}
              <div className="space-y-2">
                <label htmlFor="token-limit" className="block text-sm font-medium text-gray-700">
                  Token Limit
                </label>
                <input
                  id="token-limit"
                  type="number"
                  value={tokenLimit}
                  onChange={(e) => {
                    setTokenLimit(parseInt((e.target as HTMLInputElement).value));
                    markDirty();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="token-limit-input"
                />
                <p className="text-xs text-gray-500">Maximum context window size</p>
              </div>

              {/* Response Tokens */}
              <div className="space-y-2">
                <label htmlFor="response-tokens" className="block text-sm font-medium text-gray-700">
                  Response Tokens
                </label>
                <input
                  id="response-tokens"
                  type="number"
                  value={responseTokens}
                  onChange={(e) => {
                    setResponseTokens(parseInt((e.target as HTMLInputElement).value));
                    markDirty();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="response-tokens-input"
                />
                <p className="text-xs text-gray-500">Maximum response length</p>
              </div>

              {/* Text Quality Threshold */}
              <div className="space-y-2">
                <label htmlFor="text-quality" className="block text-sm font-medium text-gray-700">
                  Text Quality Threshold (%)
                </label>
                <input
                  id="text-quality"
                  type="number"
                  min="0"
                  max="100"
                  value={textQualityThreshold}
                  onChange={(e) => {
                    setTextQualityThreshold(parseInt((e.target as HTMLInputElement).value));
                    markDirty();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="text-quality-threshold-input"
                />
                <p className="text-xs text-gray-500">Minimum OCR quality for text extraction</p>
              </div>

              {/* Max Vision Pages */}
              <div className="space-y-2">
                <label htmlFor="max-vision-pages" className="block text-sm font-medium text-gray-700">
                  Max Vision Pages
                </label>
                <input
                  id="max-vision-pages"
                  type="number"
                  min="1"
                  value={maxVisionPages}
                  onChange={(e) => {
                    setMaxVisionPages(parseInt((e.target as HTMLInputElement).value));
                    markDirty();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="max-vision-pages-input"
                />
                <p className="text-xs text-gray-500">Maximum pages for visual analysis</p>
              </div>

              {/* Guidance Timeout */}
              <div className="space-y-2">
                <label htmlFor="guidance-timeout" className="block text-sm font-medium text-gray-700">
                  Guidance Timeout (ms)
                </label>
                <input
                  id="guidance-timeout"
                  type="number"
                  min="1000"
                  value={guidanceTimeout}
                  onChange={(e) => {
                    setGuidanceTimeout(parseInt((e.target as HTMLInputElement).value));
                    markDirty();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="guidance-timeout-input"
                />
                <p className="text-xs text-gray-500">Timeout for guidance service calls</p>
              </div>

              {/* Visual RAG Timeout */}
              <div className="space-y-2">
                <label htmlFor="visual-rag-timeout" className="block text-sm font-medium text-gray-700">
                  Visual RAG Timeout (ms)
                </label>
                <input
                  id="visual-rag-timeout"
                  type="number"
                  min="1000"
                  value={visualRagTimeout}
                  onChange={(e) => {
                    setVisualRagTimeout(parseInt((e.target as HTMLInputElement).value));
                    markDirty();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="visual-rag-timeout-input"
                />
                <p className="text-xs text-gray-500">Timeout for visual RAG service calls</p>
              </div>
            </div>

            {/* Save Button */}
            <div className="border-t pt-4">
              <button
                onClick={handleSaveEnvVars}
                disabled={!isDirty || isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="save-env-vars-button"
              >
                {isSaving ? 'Saving...' : 'Save Environment Variables'}
              </button>

              {saveMessage && (
                <div
                  className="mt-3 p-3 rounded bg-blue-50 border border-blue-200 text-blue-800"
                  data-testid="save-message"
                >
                  {saveMessage}
                </div>
              )}

              <p className="mt-2 text-sm text-gray-500">
                ⚠️ Changing environment variables requires a restart to take effect
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Runtime State Section */}
      <div className="border rounded-lg">
        <button
          onClick={() => setRuntimeStateExpanded(!runtimeStateExpanded)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          data-testid="runtime-state-header"
        >
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold">Runtime State</h3>
            <span className="text-xs text-gray-500 italic">Read-only, auto-refreshes</span>
          </div>
          <svg
            className={`w-5 h-5 transition-transform ${runtimeStateExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {runtimeStateExpanded && (
          <div className="p-4 space-y-4" data-testid="runtime-state-content">
            {/* Manual Refresh Button */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">Auto-refreshes every 10 seconds</p>
              <button
                onClick={fetchRuntimeState}
                disabled={isLoadingRuntimeState}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="refresh-runtime-state-button"
              >
                {isLoadingRuntimeState ? 'Refreshing...' : 'Refresh Now'}
              </button>
            </div>

            {/* Error Display */}
            {runtimeStateError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800" data-testid="runtime-state-error">
                Error: {runtimeStateError}
              </div>
            )}

            {/* Runtime State Display */}
            {runtimeState && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Circuit Breaker Status */}
                {runtimeState.circuitBreaker && (
                  <div className="p-3 border rounded" data-testid="circuit-breaker-status">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Circuit Breaker</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">State:</span>
                        <span className={`font-medium ${runtimeState.circuitBreaker.state === 'CLOSED' ? 'text-green-600' : 'text-red-600'}`}>
                          {runtimeState.circuitBreaker.state}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Failures:</span>
                        <span>{runtimeState.circuitBreaker.failures || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Successes:</span>
                        <span>{runtimeState.circuitBreaker.successes || 0}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* VRAM Usage */}
                {runtimeState.vram && (
                  <div className="p-3 border rounded" data-testid="vram-status">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">VRAM Usage</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Used:</span>
                        <span>{runtimeState.vram.used || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total:</span>
                        <span>{runtimeState.vram.total || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Utilization:</span>
                        <span className={`font-medium ${(runtimeState.vram.utilization || 0) > 80 ? 'text-red-600' : 'text-green-600'}`}>
                          {runtimeState.vram.utilization || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Qdrant Status */}
                {runtimeState.qdrant && (
                  <div className="p-3 border rounded" data-testid="qdrant-status">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Qdrant Vector Store</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className={`font-medium ${runtimeState.qdrant.connected ? 'text-green-600' : 'text-red-600'}`}>
                          {runtimeState.qdrant.connected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Collections:</span>
                        <span>{runtimeState.qdrant.collections || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Documents:</span>
                        <span>{runtimeState.qdrant.documents || 0}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sidecar Status */}
                {runtimeState.sidecars && (
                  <div className="p-3 border rounded" data-testid="sidecar-status">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">AI Sidecars</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Visual RAG:</span>
                        <span className={`font-medium ${runtimeState.sidecars.visualRag ? 'text-green-600' : 'text-gray-400'}`}>
                          {runtimeState.sidecars.visualRag ? 'Running' : 'Offline'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Guidance:</span>
                        <span className={`font-medium ${runtimeState.sidecars.guidance ? 'text-green-600' : 'text-gray-400'}`}>
                          {runtimeState.sidecars.guidance ? 'Running' : 'Offline'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bias Engine:</span>
                        <span className={`font-medium ${runtimeState.sidecars.biasEngine ? 'text-green-600' : 'text-gray-400'}`}>
                          {runtimeState.sidecars.biasEngine ? 'Running' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Background Sync */}
                {runtimeState.backgroundSync && (
                  <div className="p-3 border rounded col-span-full" data-testid="background-sync-status">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Background Sync</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Sync:</span>
                        <span>{runtimeState.backgroundSync.lastSync || 'Never'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Next Sync:</span>
                        <span>{runtimeState.backgroundSync.nextSync || 'Not scheduled'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className={`font-medium ${runtimeState.backgroundSync.running ? 'text-blue-600' : 'text-gray-600'}`}>
                          {runtimeState.backgroundSync.running ? 'Running' : 'Idle'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Documents Processed:</span>
                        <span>{runtimeState.backgroundSync.documentsProcessed || 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Loading State */}
            {isLoadingRuntimeState && !runtimeState && (
              <div className="text-center py-8 text-gray-500" data-testid="runtime-state-loading">
                Loading runtime state...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
