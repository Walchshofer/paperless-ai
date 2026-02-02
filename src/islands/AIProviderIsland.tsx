import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { AIProviderSettings } from '../ui/contracts/Settings.AIProvider.contract';
import { AIProviderSettingsSchema } from '../ui/contracts/Settings.AIProvider.contract';

/**
 * AIProviderIsland - AI Provider configuration with internal tabs
 *
 * Supports OpenAI, Ollama, Custom, and Azure providers with tabbed interface.
 * Implements mixed save semantics:
 * - Auto-save for non-critical fields (token limits) with debounce
 * - Manual save for critical fields (provider selection, API keys, URLs)
 * - Flushes pending debounced saves on unmount
 */
import ExpertModelsIsland from './ExpertModelsIsland';

interface AIProviderProps extends Partial<AIProviderSettings> {
  expertModels?: Record<string, unknown>;
}

export default function AIProviderIsland(props: AIProviderProps) {
  const validated = AIProviderSettingsSchema.parse(props);

  type ProviderTab = 'general' | 'openai' | 'ollama' | 'custom' | 'azure';
  const [activeTab, setActiveTab] = useState('general' as ProviderTab);
  const [provider, setProvider] = useState((validated.provider || 'openai') as string);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null as string | null);

  // OpenAI state
  const [openaiApiKey, setOpenaiApiKey] = useState(validated.openai?.apiKey || '');

  // Ollama state
  const [ollamaApiUrl, setOllamaApiUrl] = useState(validated.ollama?.apiUrl || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(validated.ollama?.model || 'sauerkraut-llama3.1:8b');
  const [ollamaVisionModel, setOllamaVisionModel] = useState(validated.ollama?.visionModel || 'qwen3-vl:8b');
  const [ollamaPlannerModel, setOllamaPlannerModel] = useState(validated.ollama?.plannerModel || '');
  const [ollamaRouterModel, setOllamaRouterModel] = useState(validated.ollama?.routerModel || '');
  const [ollamaOrchestratorModel, setOllamaOrchestratorModel] = useState(validated.ollama?.orchestratorModel || '');
  const [ollamaVisionKeepAlive, setOllamaVisionKeepAlive] = useState(validated.ollama?.visionKeepAlive || '5m');
  const [ollamaTextKeepAlive, setOllamaTextKeepAlive] = useState(validated.ollama?.textKeepAlive || '2m');
  const [ollamaRouterKeepAlive, setOllamaRouterKeepAlive] = useState(validated.ollama?.routerKeepAlive || '5m');

  // Ollama token limits (auto-save fields)
  const [ollamaTextContextWindow, setOllamaTextContextWindow] = useState(validated.ollama?.limits?.text?.contextWindow || 128000);
  const [ollamaTextMaxTokens, setOllamaTextMaxTokens] = useState(validated.ollama?.limits?.text?.maxResponseTokens || 4096);
  const [ollamaVisionContextWindow, setOllamaVisionContextWindow] = useState(validated.ollama?.limits?.vision?.contextWindow || 128000);
  const [ollamaVisionMaxTokens, setOllamaVisionMaxTokens] = useState(validated.ollama?.limits?.vision?.maxResponseTokens || 2048);
  const [ollamaPlannerContextWindow, setOllamaPlannerContextWindow] = useState(validated.ollama?.limits?.planner?.contextWindow || 128000);
  const [ollamaPlannerMaxTokens, setOllamaPlannerMaxTokens] = useState(validated.ollama?.limits?.planner?.maxResponseTokens || 700);
  const [ollamaExpertContextWindow, setOllamaExpertContextWindow] = useState(validated.ollama?.limits?.expert?.contextWindow || 128000);
  const [ollamaExpertMaxTokens, setOllamaExpertMaxTokens] = useState(validated.ollama?.limits?.expert?.maxResponseTokens || 4096);
  const [ollamaImageTokenOverhead, setOllamaImageTokenOverhead] = useState(validated.ollama?.limits?.imageTokenOverhead || 1024);

  // Custom provider state
  const [customApiUrl, setCustomApiUrl] = useState(validated.custom?.apiUrl || '');
  const [customApiKey, setCustomApiKey] = useState(validated.custom?.apiKey || '');
  const [customModel, setCustomModel] = useState(validated.custom?.model || '');

  // Azure state
  const [azureApiKey, setAzureApiKey] = useState(validated.azure?.apiKey || '');
  const [azureEndpoint, setAzureEndpoint] = useState(validated.azure?.endpoint || '');
  const [azureDeploymentName, setAzureDeploymentName] = useState(validated.azure?.deploymentName || '');
  const [azureApiVersion, setAzureApiVersion] = useState(validated.azure?.apiVersion || '2023-05-15');

  // Debounce timer for auto-save fields
  const debounceTimerRef = useRef(null as number | null);
  const hasPendingAutoSave = useRef(false);

  // Ref for expert models area to support sidebar focus/scroll
  const expertRef = useRef(null as HTMLDivElement | null);
  // Accessible announcement text for Expert Models visibility changes
  const [expertAnnouncement, setExpertAnnouncement] = useState(null as string | null);

  // Auto-clear save message
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

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

    // Only auto-save token limits
    const autoSaveSettings = {
      OLLAMA_CONTEXT_WINDOW: ollamaTextContextWindow,
      OLLAMA_MAX_RESPONSE_TOKENS: ollamaTextMaxTokens,
      OLLAMA_VISION_CONTEXT_WINDOW: ollamaVisionContextWindow,
      OLLAMA_VISION_MAX_RESPONSE_TOKENS: ollamaVisionMaxTokens,
      OLLAMA_PLANNER_CONTEXT_WINDOW: ollamaPlannerContextWindow,
      OLLAMA_PLANNER_MAX_RESPONSE_TOKENS: ollamaPlannerMaxTokens,
      OLLAMA_EXPERT_CONTEXT_WINDOW: ollamaExpertContextWindow,
      OLLAMA_EXPERT_MAX_RESPONSE_TOKENS: ollamaExpertMaxTokens,
      OLLAMA_VISION_IMAGE_TOKENS: ollamaImageTokenOverhead,
    };

    fetch('/settings/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'ai-provider',
        settings: autoSaveSettings,
        requiresRestart: false // Token limits don't require restart
      })
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
        settings.PAPERLESS_OPENAI_API_KEY = openaiApiKey;
      } else if (provider === 'ollama') {
        settings.OLLAMA_API_URL = ollamaApiUrl;
        settings.OLLAMA_MODEL = ollamaModel;
        settings.OLLAMA_VISION_MODEL = ollamaVisionModel;
        if (ollamaPlannerModel) settings.PLANNER_MODEL = ollamaPlannerModel;
        if (ollamaRouterModel) settings.ROUTER_MODEL = ollamaRouterModel;
        if (ollamaOrchestratorModel) settings.ORCHESTRATOR_MODEL = ollamaOrchestratorModel;
        settings.VISION_KEEP_ALIVE = ollamaVisionKeepAlive;
        settings.TEXT_KEEP_ALIVE = ollamaTextKeepAlive;
        settings.ROUTER_KEEP_ALIVE = ollamaRouterKeepAlive;
      } else if (provider === 'custom') {
        settings.CUSTOM_BASE_URL = customApiUrl;
        settings.CUSTOM_API_KEY = customApiKey;
        settings.CUSTOM_MODEL = customModel;
      } else if (provider === 'azure') {
        settings.AZURE_API_KEY = azureApiKey;
        settings.AZURE_ENDPOINT = azureEndpoint;
        settings.AZURE_DEPLOYMENT_NAME = azureDeploymentName;
        settings.AZURE_API_VERSION = azureApiVersion;
      }

      const response = await fetch('/settings/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'ai-provider',
          settings,
          requiresRestart: true // Provider changes require restart
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSaveMessage('AI provider settings saved successfully');
        setIsDirty(false);

        // Dispatch events
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

  const markDirty = () => setIsDirty(true);

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

  return (
    <div className="ai-provider-settings space-y-6 p-6 max-w-4xl" data-testid="ai-provider-root">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">AI Provider Settings</h2>
        <p className="text-gray-600">Configure AI provider and model settings</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" data-testid="ai-provider-tabs">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            data-testid="tab-general"
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('openai')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'openai'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            data-testid="tab-openai"
          >
            OpenAI
          </button>
          <button
            onClick={() => setActiveTab('ollama')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'ollama'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            data-testid="tab-ollama"
          >
            Ollama
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'custom'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            data-testid="tab-custom"
          >
            Custom
          </button>
          <button
            onClick={() => setActiveTab('azure')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'azure'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            data-testid="tab-azure"
          >
            Azure
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-4" data-testid="tab-content-general">
            <h3 className="text-lg font-semibold">Provider Selection</h3>
            <div className="space-y-2">
              <label htmlFor="provider" className="block text-sm font-medium text-gray-700">
                Active AI Provider <span className="text-red-500">*</span>
              </label>
              <select
                id="provider"
                value={provider}
                onChange={(e: Event) => {
                  setProvider((e.target as HTMLSelectElement).value as ProviderTab);
                  markDirty();
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="provider-select"
              >
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama (Local)</option>
                <option value="custom">Custom Provider</option>
                <option value="azure">Azure OpenAI</option>
              </select>
              <p className="text-xs text-gray-500">
                Select which AI provider to use for document processing
              </p>
            </div>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Current provider:</span> {provider}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Configure provider-specific settings in the respective tab
              </p>
            </div>
          </div>
        )}

        {/* OpenAI Tab */}
        {activeTab === 'openai' && (
          <div className="space-y-4" data-testid="tab-content-openai">
            <h3 className="text-lg font-semibold">OpenAI Configuration</h3>
            <div className="space-y-2">
              <label htmlFor="openai-api-key" className="block text-sm font-medium text-gray-700">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                id="openai-api-key"
                type="password"
                value={openaiApiKey}
                onChange={(e: Event) => {
                  setOpenaiApiKey((e.target as HTMLInputElement).value);
                  markDirty();
                }}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="openai-api-key-input"
              />
              <p className="text-xs text-gray-500">
                Your OpenAI API key from platform.openai.com
              </p>
            </div>
          </div>
        )}

        {/* Ollama Tab */}
        {activeTab === 'ollama' && (
          <div className="space-y-6" data-testid="tab-content-ollama">
            <h3 className="text-lg font-semibold">Ollama Configuration</h3>

            {/* Connection Settings */}
            <div className="space-y-4">
              <h4 className="text-md font-medium">Connection</h4>
              <div className="space-y-2">
                <label htmlFor="ollama-api-url" className="block text-sm font-medium text-gray-700">
                  API URL <span className="text-red-500">*</span>
                </label>
                <input
                  id="ollama-api-url"
                  type="url"
                  value={ollamaApiUrl}
                  onChange={(e: Event) => {
                    setOllamaApiUrl((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="ollama-api-url-input"
                />
              </div>
            </div>

            {/* Model Settings */}
            <div className="space-y-4">
              <h4 className="text-md font-medium">Models</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="ollama-text-model" className="block text-sm font-medium text-gray-700">
                    Text Model
                  </label>
                  <input
                    id="ollama-text-model"
                    type="text"
                    value={ollamaModel}
                    onChange={(e: Event) => {
                      setOllamaModel((e.target as HTMLInputElement).value);
                      markDirty();
                    }}
                    placeholder="sauerkraut-llama3.1:8b"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="ollama-text-model-input"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="ollama-vision-model" className="block text-sm font-medium text-gray-700">
                    Vision Model
                  </label>
                  <input
                    id="ollama-vision-model"
                    type="text"
                    value={ollamaVisionModel}
                    onChange={(e: Event) => {
                      setOllamaVisionModel((e.target as HTMLInputElement).value);
                      markDirty();
                    }}
                    placeholder="qwen3-vl:8b"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="ollama-vision-model-input"
                  />
                </div>
              </div>
            </div>

            {/* Token Limits - Auto-save fields */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-medium">Token Limits</h4>
                <span className="text-xs text-gray-500 italic">Auto-saves on change</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="ollama-text-context" className="block text-sm font-medium text-gray-700">
                    Text Context Window
                  </label>
                  <input
                    id="ollama-text-context"
                    type="number"
                    value={ollamaTextContextWindow}
                    onChange={(e: Event) => {
                      setOllamaTextContextWindow(parseInt((e.target as HTMLInputElement).value));
                      handleAutoSaveField();
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="ollama-text-context-input"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="ollama-text-max-tokens" className="block text-sm font-medium text-gray-700">
                    Text Max Response Tokens
                  </label>
                  <input
                    id="ollama-text-max-tokens"
                    type="number"
                    value={ollamaTextMaxTokens}
                    onChange={(e: Event) => {
                      setOllamaTextMaxTokens(parseInt((e.target as HTMLInputElement).value));
                      handleAutoSaveField();
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="ollama-text-max-tokens-input"
                  />
                </div>
              </div>
            </div>

            {/* Expert Models: Ollama-only; integrated here to prevent accidental overrides */}
            <div className="mt-6" ref={expertRef}>
              <div role="status" aria-live="polite" className="sr-only" data-testid="expert-models-announcement">{expertAnnouncement}</div>
              {provider === 'ollama' ? (
                <div data-testid="expert-models-area">
                  <h4 className="text-md font-medium">Expert Models (Ollama)</h4>
                  <ExpertModelsIsland {...(props.expertModels || {})} />
                </div>
              ) : (
                <div data-testid="expert-models-locked" role="region" aria-labelledby="expert-locked-label" aria-disabled="true" className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p id="expert-locked-label" className="text-sm text-yellow-800">Expert models are available only when <strong>Ollama</strong> is selected as the AI provider.</p>
                  <button data-testid="switch-to-ollama-btn" aria-label="Switch to Ollama provider to enable Expert Models" type="button" onClick={() => { setProvider('ollama'); markDirty(); }} className="mt-2 px-3 py-1 bg-yellow-200 rounded">Switch to Ollama</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom Tab */}
        {activeTab === 'custom' && (
          <div className="space-y-4" data-testid="tab-content-custom">
            <h3 className="text-lg font-semibold">Custom Provider Configuration</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="custom-api-url" className="block text-sm font-medium text-gray-700">
                  API Base URL <span className="text-red-500">*</span>
                </label>
                <input
                  id="custom-api-url"
                  type="url"
                  value={customApiUrl}
                  onChange={(e: Event) => {
                    setCustomApiUrl((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="https://api.example.com/v1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="custom-api-url-input"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="custom-api-key" className="block text-sm font-medium text-gray-700">
                  API Key <span className="text-red-500">*</span>
                </label>
                <input
                  id="custom-api-key"
                  type="password"
                  value={customApiKey}
                  onChange={(e: Event) => {
                    setCustomApiKey((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="Enter API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="custom-api-key-input"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="custom-model" className="block text-sm font-medium text-gray-700">
                  Model Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="custom-model"
                  type="text"
                  value={customModel}
                  onChange={(e: Event) => {
                    setCustomModel((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="model-name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="custom-model-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Azure Tab */}
        {activeTab === 'azure' && (
          <div className="space-y-4" data-testid="tab-content-azure">
            <h3 className="text-lg font-semibold">Azure OpenAI Configuration</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="azure-endpoint" className="block text-sm font-medium text-gray-700">
                  Endpoint <span className="text-red-500">*</span>
                </label>
                <input
                  id="azure-endpoint"
                  type="url"
                  value={azureEndpoint}
                  onChange={(e: Event) => {
                    setAzureEndpoint((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="https://your-resource.openai.azure.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="azure-endpoint-input"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="azure-api-key" className="block text-sm font-medium text-gray-700">
                  API Key <span className="text-red-500">*</span>
                </label>
                <input
                  id="azure-api-key"
                  type="password"
                  value={azureApiKey}
                  onChange={(e: Event) => {
                    setAzureApiKey((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="Enter Azure API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="azure-api-key-input"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="azure-deployment" className="block text-sm font-medium text-gray-700">
                  Deployment Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="azure-deployment"
                  type="text"
                  value={azureDeploymentName}
                  onChange={(e: Event) => {
                    setAzureDeploymentName((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="your-deployment-name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="azure-deployment-input"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="azure-api-version" className="block text-sm font-medium text-gray-700">
                  API Version
                </label>
                <input
                  id="azure-api-version"
                  type="text"
                  value={azureApiVersion}
                  onChange={(e: Event) => {
                    setAzureApiVersion((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="2023-05-15"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="azure-api-version-input"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Section */}
      <div className="border-t pt-4">
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
            className="mt-3 p-3 rounded bg-blue-50 border border-blue-200 text-blue-800"
            data-testid="save-message"
          >
            {saveMessage}
          </div>
        )}

        <p className="mt-2 text-sm text-gray-500">
          ⚠️ Changing AI provider settings requires a restart to take effect
        </p>
      </div>
    </div>
  );
}
