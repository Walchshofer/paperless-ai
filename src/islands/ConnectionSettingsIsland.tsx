import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { ConnectionSettings } from '../ui/contracts/Settings.Connection.contract';
import { ConnectionSettingsSchema } from '../ui/contracts/Settings.Connection.contract';

interface TestConnectionResult {
  success: boolean;
  message: string;
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

/** Health badge: green/red/gray dot with label */
function HealthBadge({ status }: { status?: { status: string; message: string } }) {
  // If status is missing or unknown, show 'Not tested'
  if (!status || status.status === 'unknown') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-400" data-testid="health-badge-not-tested">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
      Not tested
    </span>
  );
  
  // Normalize status - handle case-insensitivity and multiple success strings
  const s = String(status.status || '').toLowerCase();
  const isOk = s === 'ok' || s === 'healthy' || s === 'connected' || s === 'online';
  const isWarning = s === 'warning' || s === 'partial' || s === 'initializing';
  
  if (isOk) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300" data-testid="health-badge-connected">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
      Connected
    </span>
  );

  if (isWarning) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" data-testid="health-badge-warning" title={status.message}>
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
      Ready (Partial)
    </span>
  );
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300" data-testid="health-badge-offline" title={status.message}>
      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
      Offline
    </span>
  );
}

/** Collapsible section header with optional health badge */
function CollapsibleSection({
  id, title, expanded, onToggle, children, testId, icon, disabled = false, badge
}: {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: any;
  testId: string;
  icon?: string;
  disabled?: boolean;
  badge?: any;
}) {
  return (
    <div className={`ollama-collapsible-section mb-4 ${disabled ? 'opacity-50 grayscale-[0.5]' : ''}`} data-testid={testId}>
      <button
        onClick={onToggle}
        className="ollama-collapsible-header w-full"
        aria-expanded={expanded}
        aria-controls={id}
        data-testid={`${testId}-header`}
      >
        <div className="flex items-center gap-2">
          {icon && <i className={`fas ${icon} ${disabled ? 'text-gray-400' : 'text-blue-500'} mr-1`}></i>}
          <h4 className="text-md font-medium" style={{ color: 'var(--text-primary)' }}>
            {title}
            {disabled && <span className="ml-2 text-xs font-normal text-gray-400 italic">(Inactive Provider)</span>}
          </h4>
          {badge && <span className="ml-2">{badge}</span>}
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

export default function ConnectionSettingsIsland(props: Partial<ConnectionSettings>) {
  const [isLoading, setIsLoading] = useState(!props.paperlessApiUrl);
  const [configData, setConfigData] = useState<any>(null);

  useEffect(() => {
    // OPTIMIZATION: Only fetch if we don't have config data yet
    if (configData) return;

    if (!props.paperlessApiUrl) {
      fetch('/api/settings/config')
        .then(res => res.json())
        .then(data => {
          if (data && data.connection) {
            setConfigData(data.connection);
          } else {
            setConfigData({}); // Fallback to empty to stop loading
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch connection config', err);
          setConfigData({}); // Stop spinner on error
          setIsLoading(false);
        });
    } else {
      setConfigData(props);
      setIsLoading(false);
    }
  }, [props.paperlessApiUrl, props, configData]);

  if (isLoading || !configData) {
    return (
      <div className="p-12 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <i className="fas fa-spinner fa-spin mr-2 text-blue-500"></i>
        Loading connection settings...
      </div>
    );
  }

  const validated = configData;

  // Active Provider (Synced from events)
  const [activeProvider, setActiveProvider] = useState(validated.activeProvider || 'ollama');

  // Paperless state
  const [apiUrl, setApiUrl] = useState(validated.paperlessApiUrl || '');
  const [apiToken, setApiToken] = useState(validated.paperlessApiToken || '');
  const [username, setUsername] = useState(validated.paperlessUsername || '');

  // AI Provider state
  const [ollamaUrl, setOllamaUrl] = useState(validated.ollamaApiUrl || '');
  const [openaiKey, setOpenaiKey] = useState(validated.openaiApiKey || '');
  const [azureEndpoint, setAzureEndpoint] = useState(validated.azureEndpoint || '');
  const [azureApiKey, setAzureApiKey] = useState(validated.azureApiKey || '');
  const [customApiUrl, setCustomApiUrl] = useState(validated.customApiUrl || '');
  const [customApiKey, setCustomApiKey] = useState(validated.customApiKey || '');

  // Sidecar Services state
  const [visualRagUrl, setVisualRagUrl] = useState(validated.visualRagUrl || 'http://visual-rag:8001');
  const [textRagUrl, setTextRagUrl] = useState(validated.textRagUrl || 'http://text-rag:8004');
  const [guidanceServiceUrl, setGuidanceServiceUrl] = useState(validated.guidanceServiceUrl || 'http://guidance-service:8002');
  const [biasEngineUrl, setBiasEngineUrl] = useState(validated.biasEngineUrl || 'bias-engine:50051');
  const [redisUrl, setRedisUrl] = useState(validated.redisUrl || 'redis://broker:6379');

  // Vector Store state
  const [qdrantHost, setQdrantHost] = useState(validated.qdrantHost || 'qdrant');
  const [qdrantPort, setQdrantPort] = useState(validated.qdrantPort || '6333');
  const [qdrantApiKey, setQdrantApiKey] = useState(validated.qdrantApiKey || '');

  // Connection Lifecycle state
  const [visionKeepAlive, setVisionKeepAlive] = useState(validated.visionKeepAlive || '5m');
  const [textKeepAlive, setTextKeepAlive] = useState(validated.textKeepAlive || '2m');
  const [routerKeepAlive, setRouterKeepAlive] = useState(validated.routerKeepAlive || '5m');
  const [guidanceTimeout, setGuidanceTimeout] = useState(validated.guidanceTimeout || 90000);
  const [visualRagTimeout, setVisualRagTimeout] = useState(validated.visualRagTimeout || 30000);

  // External API state
  const [extEnabled, setExtEnabled] = useState(validated.externalApiEnabled || false);
  const [extUrl, setExtUrl] = useState(validated.externalApiUrl || '');
  const [extMethod, setExtMethod] = useState(validated.externalApiMethod || 'GET');
  const [extHeaders, setExtHeaders] = useState(validated.externalApiHeaders || '{}');
  const [extBody, setExtBody] = useState(validated.externalApiBody || '{}');
  const [extTimeout, setExtTimeout] = useState(validated.externalApiTimeout || 5000);
  const [extTransform, setExtTransform] = useState(validated.externalApiTransform || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null as string | null);
  const [isDirty, setIsDirty] = useState(false);

  // Health status from /api/settings/health
  const [healthStatus, setHealthStatus] = useState<Record<string, { status: string; message: string }>>({});

  // Test status state
  const [testStates, setTestStatus] = useState<Record<string, { testing: boolean, result: TestConnectionResult | null }>>({
    paperless: { testing: false, result: null },
    ollama: { testing: false, result: null },
    qdrant: { testing: false, result: null },
    visual_rag: { testing: false, result: null },
    text_rag: { testing: false, result: null },
    guidance: { testing: false, result: null },
    redis: { testing: false, result: null },
  });

  // Section collapse state
  const [sections, setSections] = useState({
    paperless: true,
    ai: true,
    sidecars: false,
    vector: false,
    lifecycle: false,
    external: false,
  });

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/settings/health');
      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch health status:', error);
    }
  };

  // Fetch health on mount
  useEffect(() => {
    fetchHealth();
  }, []);

  // Event listener for provider changes from AI tab
  useEffect(() => {
    const handleProviderChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.provider) {
        setActiveProvider(detail.provider);
      }
    };
    document.addEventListener('settings:provider-changed', handleProviderChange);
    return () => document.removeEventListener('settings:provider-changed', handleProviderChange);
  }, []);

  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateTestState = (key: string, patch: Partial<{ testing: boolean, result: TestConnectionResult | null }>) => {
    setTestStatus(prev => ({
      ...prev,
      [key]: { ...prev[key], ...patch }
    }));
  };

  const handleTestConnection = async (service: string) => {
    updateTestState(service, { testing: true, result: null });

    try {
      let endpoint = '';
      let body = {};

      if (service === 'paperless') {
        endpoint = '/api/settings/test-connection';
        body = { paperlessApiUrl: apiUrl, paperlessApiToken: apiToken };
      } else if (service === 'ollama') {
        endpoint = '/api/settings/test-ollama';
        body = { url: ollamaUrl };
      } else if (service === 'qdrant') {
        endpoint = '/api/settings/test-qdrant';
        body = { host: qdrantHost, port: qdrantPort, apiKey: qdrantApiKey };
      } else if (service === 'visual_rag') {
        endpoint = '/api/settings/test-visual-rag';
        body = { url: visualRagUrl };
      } else if (service === 'text_rag') {
        endpoint = '/api/settings/test-text-rag';
        body = { url: textRagUrl };
      } else if (service === 'guidance') {
        endpoint = '/api/settings/test-guidance';
        body = { url: guidanceServiceUrl };
      } else if (service === 'redis') {
        endpoint = '/api/settings/test-redis';
        body = { url: redisUrl };
      }

      if (!endpoint) {
        throw new Error(`Unknown service for testing: ${service}`);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      const isSuccess = response.ok && result.success;
      updateTestState(service, {
        testing: false,
        result: {
          success: isSuccess,
          message: result.message || result.error || (response.ok ? 'Connection successful!' : 'Connection failed')
        }
      });

      // Refresh health badges on success
      if (isSuccess) {
        fetchHealth();
      }
    } catch (error) {
      updateTestState(service, {
        testing: false,
        result: {
          success: false,
          message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const settings: Record<string, any> = {
        PAPERLESS_API_URL: apiUrl,
        PAPERLESS_API_TOKEN: apiToken,
        PAPERLESS_USERNAME: username,
        OLLAMA_API_URL: ollamaUrl,
        PAPERLESS_OPENAI_API_KEY: openaiKey,
        AZURE_ENDPOINT: azureEndpoint,
        AZURE_API_KEY: azureApiKey,
        CUSTOM_BASE_URL: customApiUrl,
        CUSTOM_API_KEY: customApiKey,
        VISUAL_RAG_URL: visualRagUrl,
        TEXT_RAG_URL: textRagUrl,
        GUIDANCE_SERVICE_URL: guidanceServiceUrl,
        BIAS_ENGINE_URL: biasEngineUrl,
        REDIS_URL: redisUrl,
        QDRANT_HOST: qdrantHost,
        QDRANT_PORT: qdrantPort,
        QDRANT_API_KEY: qdrantApiKey,
        VISION_KEEP_ALIVE: visionKeepAlive,
        TEXT_KEEP_ALIVE: textKeepAlive,
        ROUTER_KEEP_ALIVE: routerKeepAlive,
        GUIDANCE_TIMEOUT: guidanceTimeout.toString(),
        VISUAL_RAG_TIMEOUT: visualRagTimeout.toString(),
        EXTERNAL_API_ENABLED: extEnabled ? 'yes' : 'no',
        EXTERNAL_API_URL: extUrl,
        EXTERNAL_API_METHOD: extMethod,
        EXTERNAL_API_HEADERS: extHeaders,
        EXTERNAL_API_BODY: extBody,
        EXTERNAL_API_TIMEOUT: extTimeout.toString(),
        EXTERNAL_API_TRANSFORM: extTransform,
      };

      const response = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSaveMessage('All connection settings saved successfully');
        setIsDirty(false);

        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: { category: 'connection', success: true }
          }));
          if (result.restartRequired) {
            document.dispatchEvent(new CustomEvent('settings:restart-required', {
              detail: { reason: 'Connection settings changed', settings: ['Connections'] }
            }));
          }
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

  const ServiceTestResult = ({ result }: { result: TestConnectionResult | null }) => {
    if (!result) return null;
    return (
      <div className={`mt-2 p-2 rounded text-xs border ${result.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
        <i className={`fas ${result.success ? 'fa-check-circle' : 'fa-times-circle'} mr-1`}></i>
        {result.message}
      </div>
    );
  };

  const ProviderBox = ({ id, label, icon, active, children }: { id: string, label: string, icon?: any, active: boolean, children: any }) => (
    <div className={`p-4 rounded-lg border transition-all ${active ? 'border-blue-200 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-900/10 shadow-sm' : 'border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/20 opacity-60 grayscale-[0.3]'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <span className={`font-semibold text-sm ${active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500'}`}>{label}</span>
        </div>
        {active ? (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-tight border border-blue-200/50 dark:border-blue-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            Active
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight">
            Inactive
          </span>
        )}
      </div>
      <div className={active ? '' : 'pointer-events-none'}>
        {children}
      </div>
    </div>
  );

  /** Sidecar service card (reuses ProviderBox styling but always active) */
  const SidecarCard = ({ id, label, icon, children }: { id: string, label: string, icon: any, children: any }) => (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div className="connection-settings space-y-6 p-6 max-w-4xl" data-testid="connection-settings-root">
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <i className="fas fa-network-wired text-white"></i>
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Connection Center</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Centralized management for all service integrations and API connections.</p>
          </div>
        </div>
      </div>

      {/* ━━━ 1. Paperless-ngx Section ━━━ */}
      <CollapsibleSection
        id="section-paperless"
        title="Paperless-ngx Instance"
        icon="fa-file-invoice"
        expanded={sections.paperless}
        onToggle={() => toggleSection('paperless')}
        testId="section-paperless"
        badge={<HealthBadge status={healthStatus.paperless} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="flex items-center gap-1 text-sm font-medium">
              API URL <Tooltip text="The base URL of your Paperless-ngx instance (e.g., http://192.168.1.10:8000). Do not include /api." />
            </label>
            <input
              type="url"
              value={apiUrl}
              onInput={(e) => { setApiUrl((e.target as HTMLInputElement).value); markDirty(); }}
              placeholder="http://localhost:8000"
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              data-testid="paperless-url-input"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-1 text-sm font-medium">
              API Token <Tooltip text="Long-lived API token from Paperless-ngx Administration > Users > Edit user > Tokens." />
            </label>
            <input
              type="password"
              value={apiToken}
              onInput={(e) => { setApiToken((e.target as HTMLInputElement).value); markDirty(); }}
              placeholder="Enter token..."
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              data-testid="paperless-token-input"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-1 text-sm font-medium">
              Username (Optional) <Tooltip text="Used for attribution in document history and notes. Does not affect authentication." />
            </label>
            <input
              type="text"
              value={username}
              onInput={(e) => { setUsername((e.target as HTMLInputElement).value); markDirty(); }}
              placeholder="AI User"
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              data-testid="paperless-username-input"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => handleTestConnection('paperless')}
            disabled={testStates.paperless?.testing || !apiUrl}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-sm transition-colors font-medium border border-gray-200 dark:border-gray-500"
          >
            {testStates.paperless?.testing ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-plug mr-1"></i>}
            Test Connection
          </button>
          <ServiceTestResult result={testStates.paperless?.result} />
        </div>
      </CollapsibleSection>

      {/* ━━━ 2. AI Provider Endpoints ━━━ */}
      <CollapsibleSection
        id="section-ai"
        title="AI Provider Endpoints"
        icon="fa-robot"
        expanded={sections.ai}
        onToggle={() => toggleSection('ai')}
        testId="section-ai"
        badge={<HealthBadge status={healthStatus.ollama} />}
      >
        <div className="space-y-4">
          <div className="mb-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
            <i className="fas fa-lightbulb text-amber-500 mt-0.5"></i>
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              Settings are context-aware. Only fields for the <strong>Active Provider</strong> (selected in AI Provider tab) are enabled.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Ollama */}
            <ProviderBox
              id="ollama"
              label="Ollama (Local)"
              active={activeProvider === 'ollama'}
              icon={<img src="https://ollama.com/favicon.ico" className="w-5 h-5 opacity-80" alt="" onError={(e) => (e.target as HTMLImageElement).src = 'https://ollama.com/favicon.ico'} />}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    API URL <Tooltip text="URL of your local Ollama server (default: http://localhost:11434). Must be reachable from the Docker network." />
                  </label>
                  <input
                    type="url"
                    value={ollamaUrl}
                    onInput={(e) => { setOllamaUrl((e.target as HTMLInputElement).value); markDirty(); }}
                    placeholder="http://localhost:11434"
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <button
                    onClick={() => handleTestConnection('ollama')}
                    disabled={testStates.ollama?.testing || !ollamaUrl}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Test Ollama
                  </button>
                  <div className="ml-3"><ServiceTestResult result={testStates.ollama?.result} /></div>
                </div>
              </div>
            </ProviderBox>

            {/* OpenAI */}
            <ProviderBox
              id="openai"
              label="OpenAI"
              active={activeProvider === 'openai'}
              icon={<i className="fab fa-openai text-lg opacity-80 text-emerald-600"></i>}
            >
              <div className="space-y-2 max-w-md">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  API Key <Tooltip text="Your OpenAI API key starting with sk-. Used for GPT-based document processing." />
                </label>
                <input
                  type="password"
                  value={openaiKey}
                  onInput={(e) => { setOpenaiKey((e.target as HTMLInputElement).value); markDirty(); }}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
            </ProviderBox>

            {/* Azure */}
            <ProviderBox
              id="azure"
              label="Azure OpenAI"
              active={activeProvider === 'azure'}
              icon={<i className="fab fa-microsoft text-lg opacity-80 text-blue-500"></i>}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endpoint <Tooltip text="Azure OpenAI resource endpoint (e.g., https://myresource.openai.azure.com)." />
                  </label>
                  <input
                    type="url"
                    value={azureEndpoint}
                    onInput={(e) => { setAzureEndpoint((e.target as HTMLInputElement).value); markDirty(); }}
                    placeholder="https://resource.openai.azure.com"
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    API Key <Tooltip text="Azure OpenAI API key from your Azure Portal resource." />
                  </label>
                  <input
                    type="password"
                    value={azureApiKey}
                    onInput={(e) => { setAzureApiKey((e.target as HTMLInputElement).value); markDirty(); }}
                    placeholder="Enter key..."
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
              </div>
            </ProviderBox>

            {/* Custom */}
            <ProviderBox
              id="custom"
              label="Custom OpenAI-compatible API"
              active={activeProvider === 'custom'}
              icon={<i className="fas fa-server text-lg opacity-80 text-purple-500"></i>}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base URL <Tooltip text="Base URL for any OpenAI-compatible API (e.g., LiteLLM, vLLM, or proxy endpoints)." />
                  </label>
                  <input
                    type="url"
                    value={customApiUrl}
                    onInput={(e) => { setCustomApiUrl((e.target as HTMLInputElement).value); markDirty(); }}
                    placeholder="https://api.proxy.com/v1"
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    API Key <Tooltip text="Authentication key for your custom OpenAI-compatible endpoint." />
                  </label>
                  <input
                    type="password"
                    value={customApiKey}
                    onInput={(e) => { setCustomApiKey((e.target as HTMLInputElement).value); markDirty(); }}
                    placeholder="Enter key..."
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
              </div>
            </ProviderBox>
          </div>
        </div>
      </CollapsibleSection>

      {/* ━━━ 3. Sidecar Services ━━━ */}
      <CollapsibleSection
        id="section-sidecars"
        title="Sidecar Services"
        icon="fa-cubes"
        expanded={sections.sidecars}
        onToggle={() => toggleSection('sidecars')}
        testId="section-sidecars"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Visual RAG */}
          <SidecarCard id="visual-rag" label="Visual RAG"
            icon={<i className="fas fa-eye text-lg opacity-80 text-indigo-500"></i>}>
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service URL <Tooltip text="URL of the Visual RAG GPU sidecar for document image analysis (default: http://visual-rag:8001)." />
              </label>
              <input type="url" value={visualRagUrl}
                onInput={(e) => { setVisualRagUrl((e.target as HTMLInputElement).value); markDirty(); }}
                placeholder="http://visual-rag:8001"
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                data-testid="visual-rag-url-input" />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => handleTestConnection('visual_rag')}
                  disabled={testStates.visual_rag?.testing || !visualRagUrl}
                  className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  data-testid="test-visual-rag-btn">
                  {testStates.visual_rag?.testing ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-plug mr-1"></i>}
                  Test
                </button>
                <HealthBadge status={healthStatus.visual_rag} />
              </div>
              <ServiceTestResult result={testStates.visual_rag?.result} />
            </div>
          </SidecarCard>

          {/* Text RAG */}
          <SidecarCard id="text-rag" label="Text RAG"
            icon={<i className="fas fa-search text-lg opacity-80 text-teal-500"></i>}>
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service URL <Tooltip text="URL of the Text RAG service for multilingual semantic search (default: http://text-rag:8004)." />
              </label>
              <input type="url" value={textRagUrl}
                onInput={(e) => { setTextRagUrl((e.target as HTMLInputElement).value); markDirty(); }}
                placeholder="http://text-rag:8004"
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                data-testid="text-rag-url-input" />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => handleTestConnection('text_rag')}
                  disabled={testStates.text_rag?.testing || !textRagUrl}
                  className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  data-testid="test-text-rag-btn">
                  {testStates.text_rag?.testing ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-plug mr-1"></i>}
                  Test
                </button>
                <HealthBadge status={healthStatus.text_rag} />
              </div>
              <ServiceTestResult result={testStates.text_rag?.result} />
            </div>
          </SidecarCard>

          {/* Guidance Service */}
          <SidecarCard id="guidance" label="Guidance Service"
            icon={<i className="fas fa-compass text-lg opacity-80 text-amber-500"></i>}>
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service URL <Tooltip text="URL of the Guidance service for deterministic JSON extraction (default: http://guidance-service:8002)." />
              </label>
              <input type="url" value={guidanceServiceUrl}
                onInput={(e) => { setGuidanceServiceUrl((e.target as HTMLInputElement).value); markDirty(); }}
                placeholder="http://guidance-service:8002"
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                data-testid="guidance-url-input" />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => handleTestConnection('guidance')}
                  disabled={testStates.guidance?.testing || !guidanceServiceUrl}
                  className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  data-testid="test-guidance-btn">
                  {testStates.guidance?.testing ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-plug mr-1"></i>}
                  Test
                </button>
                <HealthBadge status={healthStatus.guidance} />
              </div>
              <ServiceTestResult result={testStates.guidance?.result} />
            </div>
          </SidecarCard>

          {/* Bias Engine */}
          <SidecarCard id="bias-engine" label="Bias Engine"
            icon={<i className="fas fa-balance-scale text-lg opacity-80 text-rose-500"></i>}>
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                gRPC Endpoint <Tooltip text="gRPC endpoint for the logit bias engine (default: bias-engine:50051). Format: host:port." />
              </label>
              <input type="text" value={biasEngineUrl}
                onInput={(e) => { setBiasEngineUrl((e.target as HTMLInputElement).value); markDirty(); }}
                placeholder="bias-engine:50051"
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                data-testid="bias-engine-url-input" />
            </div>
          </SidecarCard>

          {/* Redis */}
          <SidecarCard id="redis" label="Redis Cache"
            icon={<i className="fas fa-database text-lg opacity-80 text-red-500"></i>}>
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Redis URL <Tooltip text="Redis endpoint used for Visual Query Cache and message brokering (default: redis://broker:6379)." />
              </label>
              <input type="text" value={redisUrl}
                onInput={(e) => { setRedisUrl((e.target as HTMLInputElement).value); markDirty(); }}
                placeholder="redis://broker:6379"
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                data-testid="redis-url-input" />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => handleTestConnection('redis')}
                  disabled={testStates.redis?.testing || !redisUrl}
                  className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  data-testid="test-redis-btn">
                  {testStates.redis?.testing ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-plug mr-1"></i>}
                  Test
                </button>
                <HealthBadge status={healthStatus.redis} />
              </div>
              <ServiceTestResult result={testStates.redis?.result} />
            </div>
          </SidecarCard>
        </div>
      </CollapsibleSection>

      {/* ━━━ 4. Vector Store Section ━━━ */}
      <CollapsibleSection
        id="section-vector"
        title="Vector Source of Truth (Qdrant)"
        icon="fa-database"
        expanded={sections.vector}
        onToggle={() => toggleSection('vector')}
        testId="section-vector"
        badge={<HealthBadge status={healthStatus.qdrant} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Host <Tooltip text="Hostname of your Qdrant vector database. Use 'qdrant' for the Docker service name." />
            </label>
            <input
              type="text"
              value={qdrantHost}
              onInput={(e) => { setQdrantHost((e.target as HTMLInputElement).value); markDirty(); }}
              placeholder="qdrant"
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Port <Tooltip text="REST API port for Qdrant (default: 6333)." />
            </label>
            <input
              type="text"
              value={qdrantPort}
              onInput={(e) => { setQdrantPort((e.target as HTMLInputElement).value); markDirty(); }}
              placeholder="6333"
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
              API Key (Optional) <Tooltip text="Optional API key for Qdrant authentication. Leave blank if no authentication is configured." />
            </label>
            <input
              type="password"
              value={qdrantApiKey}
              onInput={(e) => { setQdrantApiKey((e.target as HTMLInputElement).value); markDirty(); }}
              placeholder="Optional..."
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => handleTestConnection('qdrant')}
            disabled={testStates.qdrant?.testing || !qdrantHost}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-sm transition-colors font-medium border border-gray-200 dark:border-gray-500"
          >
            {testStates.qdrant?.testing ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-vial mr-1"></i>}
            Test Vector Store
          </button>
          <ServiceTestResult result={testStates.qdrant?.result} />
        </div>
      </CollapsibleSection>

      {/* ━━━ 5. Connection Lifecycle ━━━ */}
      <CollapsibleSection
        id="section-lifecycle"
        title="Connection Lifecycle"
        icon="fa-heartbeat"
        expanded={sections.lifecycle}
        onToggle={() => toggleSection('lifecycle')}
        testId="section-lifecycle"
      >
        <div className="space-y-6">
          {/* Keep-alive */}
          <div>
            <h5 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Ollama Keep-Alive <Tooltip text="Controls how long Ollama keeps models loaded in GPU/RAM after last use." />
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vision Model <Tooltip text="How long Ollama keeps vision models loaded in memory after last use (e.g., '5m', '30s', '-1' for indefinite)." />
                </label>
                <select value={visionKeepAlive}
                  onChange={(e) => { setVisionKeepAlive((e.target as HTMLSelectElement).value); markDirty(); }}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  data-testid="vision-keep-alive-select">
                  <option value="30s">30 seconds</option>
                  <option value="2m">2 minutes</option>
                  <option value="5m">5 minutes</option>
                  <option value="15m">15 minutes</option>
                  <option value="30m">30 minutes</option>
                  <option value="-1">Indefinite</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Text Model <Tooltip text="How long Ollama keeps text models loaded in memory after last use (e.g., '2m', '30s')." />
                </label>
                <select value={textKeepAlive}
                  onChange={(e) => { setTextKeepAlive((e.target as HTMLSelectElement).value); markDirty(); }}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  data-testid="text-keep-alive-select">
                  <option value="30s">30 seconds</option>
                  <option value="2m">2 minutes</option>
                  <option value="5m">5 minutes</option>
                  <option value="15m">15 minutes</option>
                  <option value="30m">30 minutes</option>
                  <option value="-1">Indefinite</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Router Model <Tooltip text="How long Ollama keeps the router model loaded in memory after last use." />
                </label>
                <select value={routerKeepAlive}
                  onChange={(e) => { setRouterKeepAlive((e.target as HTMLSelectElement).value); markDirty(); }}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  data-testid="router-keep-alive-select">
                  <option value="30s">30 seconds</option>
                  <option value="2m">2 minutes</option>
                  <option value="5m">5 minutes</option>
                  <option value="15m">15 minutes</option>
                  <option value="30m">30 minutes</option>
                  <option value="-1">Indefinite</option>
                </select>
              </div>
            </div>
          </div>

          {/* Timeouts */}
          <div>
            <h5 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Service Timeouts <Tooltip text="Maximum time to wait for sidecar service responses." />
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guidance Timeout <Tooltip text="Maximum time in milliseconds to wait for a Guidance Service response before timing out." />
                </label>
                <div className="flex items-center gap-3">
                  <input type="range" min={5000} max={300000} step={5000} value={guidanceTimeout}
                    onInput={(e) => { setGuidanceTimeout(parseInt((e.target as HTMLInputElement).value)); markDirty(); }}
                    className="flex-1" data-testid="guidance-timeout-range" />
                  <span className="text-xs font-mono w-16 text-right" style={{ color: 'var(--text-secondary)' }}>{(guidanceTimeout / 1000).toFixed(0)}s</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visual RAG Timeout <Tooltip text="Maximum time in milliseconds to wait for a Visual RAG response before timing out." />
                </label>
                <div className="flex items-center gap-3">
                  <input type="range" min={5000} max={300000} step={5000} value={visualRagTimeout}
                    onInput={(e) => { setVisualRagTimeout(parseInt((e.target as HTMLInputElement).value)); markDirty(); }}
                    className="flex-1" data-testid="visual-rag-timeout-range" />
                  <span className="text-xs font-mono w-16 text-right" style={{ color: 'var(--text-secondary)' }}>{(visualRagTimeout / 1000).toFixed(0)}s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ━━━ 6. External Integrations ━━━ */}
      <CollapsibleSection
        id="section-external"
        title="External Integrations"
        icon="fa-exchange-alt"
        expanded={sections.external}
        onToggle={() => toggleSection('external')}
        testId="section-external"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="ext-enabled"
              checked={extEnabled}
              onChange={(e) => { setExtEnabled((e.target as HTMLInputElement).checked); markDirty(); }}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="ext-enabled" className="text-sm font-medium">Enable External API Hook</label>
            <Tooltip text="If enabled, the pipeline will call this URL after processing to notify external systems." />
          </div>

          <div className={`space-y-4 transition-all duration-300 ${extEnabled ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 space-y-2">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Webhook URL <Tooltip text="Webhook URL that will be called after each document is processed." />
                </label>
                <input
                  type="url"
                  value={extUrl}
                  onInput={(e) => { setExtUrl((e.target as HTMLInputElement).value); markDirty(); }}
                  placeholder="https://hooks.yourdomain.com/webhook"
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method <Tooltip text="HTTP method to use when calling the webhook (GET, POST, PUT, or PATCH)." />
                </label>
                <select
                  value={extMethod}
                  onChange={(e) => { setExtMethod((e.target as HTMLSelectElement).value as any); markDirty(); }}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  JSON Headers <Tooltip text="JSON object of HTTP headers to send with the webhook request (e.g., Authorization header)." />
                </label>
                <textarea
                  value={extHeaders}
                  onInput={(e) => { setExtHeaders((e.target as HTMLTextAreaElement).value); markDirty(); }}
                  placeholder='{"Authorization": "Bearer ..."}'
                  className="w-full h-24 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payload Template <Tooltip text="JSON template for the webhook payload. Use {{id}} and {{status}} as placeholders." />
                </label>
                <textarea
                  value={extBody}
                  onInput={(e) => { setExtBody((e.target as HTMLTextAreaElement).value); markDirty(); }}
                  placeholder='{"document_id": "{{id}}", "status": "processed"}'
                  className="w-full h-24 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ━━━ Save Section ━━━ */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            data-testid="connection-save-button"
          >
            {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
            Save All Connections
          </button>

          {saveMessage && (
            <div
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                saveMessage.includes('failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}
              data-testid="save-message"
            >
              {saveMessage}
            </div>
          )}
        </div>
        <div className="flex items-start gap-2 max-w-2xl">
          <i className="fas fa-info-circle text-blue-500 mt-0.5"></i>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Service-critical changes will trigger an automatic server restart. Testing connections before saving is highly recommended to prevent service downtime.
          </p>
        </div>
      </div>
    </div>
  );
}
