import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { ConnectionSettings } from '../ui/contracts/Settings.Connection.contract';
import { ConnectionSettingsSchema } from '../ui/contracts/Settings.Connection.contract';

interface TestConnectionResult {
  success: boolean;
  message: string;
}

/**
 * ConnectionSettingsIsland - Paperless-ngx connection configuration
 *
 * Allows users to configure API URL, token, and username, with connection testing.
 * Connection changes require restart, so this triggers restart-required banner.
 */
import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
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

/** Collapsible section header */
function CollapsibleSection({
  id, title, expanded, onToggle, children, testId, icon
}: {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: preact.ComponentChildren;
  testId: string;
  icon?: string;
}) {
  return (
    <div className="ollama-collapsible-section mb-4" data-testid={testId}>
      <button
        onClick={onToggle}
        className="ollama-collapsible-header w-full"
        aria-expanded={expanded}
        aria-controls={id}
        data-testid={`${testId}-header`}
      >
        <div className="flex items-center gap-2">
          {icon && <i className={`fas ${icon} text-blue-500 mr-1`}></i>}
          <h4 className="text-md font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h4>
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
  const validated = ConnectionSettingsSchema.parse(props);

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

  // Vector Store state
  const [qdrantHost, setQdrantHost] = useState(validated.qdrantHost || 'qdrant');
  const [qdrantPort, setQdrantPort] = useState(validated.qdrantPort || '6333');
  const [qdrantApiKey, setQdrantApiKey] = useState(validated.qdrantApiKey || '');

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

  // Test status state
  const [testStates, setTestStatus] = useState<Record<string, { testing: boolean, result: TestConnectionResult | null }>>({
    paperless: { testing: false, result: null },
    ollama: { testing: false, result: null },
    qdrant: { testing: false, result: null },
  });

  // Section collapse state
  const [sections, setSections] = useState({
    paperless: true,
    ai: false,
    vector: false,
    external: false,
  });

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

  const handleTestConnection = async (service: 'paperless' | 'ollama' | 'qdrant') => {
    updateTestState(service, { testing: true, result: null });

    try {
      let endpoint = '';
      let body = {};

      if (service === 'paperless') {
        endpoint = '/api/settings/test-connection';
        body = { paperlessApiUrl: apiUrl, paperlessApiToken: apiToken };
      } else if (service === 'ollama') {
        endpoint = '/api/settings/test-ollama'; // New endpoint needed or use existing logic
        body = { url: ollamaUrl };
      } else if (service === 'qdrant') {
        endpoint = '/api/settings/test-qdrant';
        body = { host: qdrantHost, port: qdrantPort, apiKey: qdrantApiKey };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      updateTestState(service, {
        testing: false,
        result: {
          success: response.ok && result.success,
          message: result.message || result.error || (response.ok ? 'Connection successful!' : 'Connection failed')
        }
      });
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
        QDRANT_HOST: qdrantHost,
        QDRANT_PORT: qdrantPort,
        QDRANT_API_KEY: qdrantApiKey,
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

  return (
    <div className="connection-settings space-y-6 p-6 max-w-4xl" data-testid="connection-settings-root">
      <div className="space-y-2 mb-4">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Connection Center</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Centralized management for all service integrations and API connections.</p>
      </div>

      {/* ━━━ Paperless-ngx Section ━━━ */}
      <CollapsibleSection
        id="section-paperless"
        title="Paperless-ngx Instance"
        icon="fa-file-invoice"
        expanded={sections.paperless}
        onToggle={() => toggleSection('paperless')}
        testId="section-paperless"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="flex items-center gap-1 text-sm font-medium">
              API URL <Tooltip text="The base URL of your Paperless-ngx instance (e.g., http://192.168.1.10:8000)" />
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
              API Token <Tooltip text="Long-lived API token from Paperless-ngx user settings." />
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
              Username (Optional) <Tooltip text="Used for attribution in document history and notes." />
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
            disabled={testStates.paperless.testing || !apiUrl}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-sm transition-colors"
          >
            {testStates.paperless.testing ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-plug mr-1"></i>}
            Test Connection
          </button>
          <ServiceTestResult result={testStates.paperless.result} />
        </div>
      </CollapsibleSection>

      {/* ━━━ AI Providers Section ━━━ */}
      <CollapsibleSection
        id="section-ai"
        title="AI Cloud & Local Providers"
        icon="fa-robot"
        expanded={sections.ai}
        onToggle={() => toggleSection('ai')}
        testId="section-ai"
      >
        <div className="space-y-6">
          {/* Ollama */}
          <div className="p-3 rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-900/10">
            <div className="flex items-center gap-2 mb-3">
              <img src="/img/ollama.png" className="w-5 h-5 opacity-80" alt="Ollama" onError={(e) => (e.target as HTMLImageElement).src = 'https://ollama.com/favicon.ico'} />
              <span className="font-semibold text-sm">Ollama (Local)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">API URL</label>
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
                  disabled={testStates.ollama.testing || !ollamaUrl}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs hover:bg-gray-50 transition-colors"
                >
                  Test Ollama
                </button>
                <div className="ml-3"><ServiceTestResult result={testStates.ollama.result} /></div>
              </div>
            </div>
          </div>

          {/* OpenAI */}
          <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/10">
            <div className="flex items-center gap-2 mb-3">
              <i className="fab fa-openai text-lg opacity-80"></i>
              <span className="font-semibold text-sm">OpenAI</span>
            </div>
            <div className="space-y-2 max-w-md">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</label>
              <input
                type="password"
                value={openaiKey}
                onInput={(e) => { setOpenaiKey((e.target as HTMLInputElement).value); markDirty(); }}
                placeholder="sk-..."
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              />
            </div>
          </div>

          {/* Azure */}
          <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/10">
            <div className="flex items-center gap-2 mb-3">
              <i className="fab fa-microsoft text-blue-400 opacity-80"></i>
              <span className="font-semibold text-sm">Azure OpenAI</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint</label>
                <input
                  type="url"
                  value={azureEndpoint}
                  onInput={(e) => { setAzureEndpoint((e.target as HTMLInputElement).value); markDirty(); }}
                  placeholder="https://resource.openai.azure.com"
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</label>
                <input
                  type="password"
                  value={azureApiKey}
                  onInput={(e) => { setAzureApiKey((e.target as HTMLInputElement).value); markDirty(); }}
                  placeholder="Enter key..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Custom */}
          <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/10">
            <div className="flex items-center gap-2 mb-3">
              <i className="fas fa-server opacity-80"></i>
              <span className="font-semibold text-sm">Custom OpenAI-compatible API</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Base URL</label>
                <input
                  type="url"
                  value={customApiUrl}
                  onInput={(e) => { setCustomApiUrl((e.target as HTMLInputElement).value); markDirty(); }}
                  placeholder="https://api.proxy.com/v1"
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</label>
                <input
                  type="password"
                  value={customApiKey}
                  onInput={(e) => { setCustomApiKey((e.target as HTMLInputElement).value); markDirty(); }}
                  placeholder="Enter key..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ━━━ Vector Store Section ━━━ */}
      <CollapsibleSection
        id="section-vector"
        title="Vector Source of Truth (Qdrant)"
        icon="fa-database"
        expanded={sections.vector}
        onToggle={() => toggleSection('vector')}
        testId="section-vector"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Host</label>
            <input
              type="text"
              value={qdrantHost}
              onInput={(e) => { setQdrantHost((e.target as HTMLInputElement).value); markDirty(); }}
              placeholder="qdrant"
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Port</label>
            <input
              type="text"
              value={qdrantPort}
              onInput={(e) => { setQdrantPort((e.target as HTMLInputElement).value); markDirty(); }}
              placeholder="6333"
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">API Key (Optional)</label>
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
            disabled={testStates.qdrant.testing || !qdrantHost}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-sm transition-colors"
          >
            {testStates.qdrant.testing ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-vial mr-1"></i>}
            Test Vector Store
          </button>
          <ServiceTestResult result={testStates.qdrant.result} />
        </div>
      </CollapsibleSection>

      {/* ━━━ External API Section ━━━ */}
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

          <div className={`space-y-4 transition-opacity ${extEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Webhook URL</label>
                <input
                  type="url"
                  value={extUrl}
                  onInput={(e) => { setExtUrl((e.target as HTMLInputElement).value); markDirty(); }}
                  placeholder="https://hooks.yourdomain.com/webhook"
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Method</label>
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
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">JSON Headers</label>
                <textarea
                  value={extHeaders}
                  onInput={(e) => { setExtHeaders((e.target as HTMLTextAreaElement).value); markDirty(); }}
                  placeholder='{"Authorization": "Bearer ..."}'
                  className="w-full h-24 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Payload Template (optional)</label>
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
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <i className="fas fa-info-circle mr-1"></i>
          Service-critical changes will trigger an automatic server restart to apply new connection parameters.
        </p>
      </div>
    </div>
  );
}
            placeholder="http://localhost:8000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="api-url-input"
          />
          <p className="text-xs text-gray-500">
            Base URL of your Paperless-ngx instance
          </p>
        </div>

        {/* API Token Field */}
        <div className="space-y-2">
          <label htmlFor="api-token" className="block text-sm font-medium text-gray-700">
            API Token <span className="text-red-500">*</span>
          </label>
          <input
            id="api-token"
            type="password"
            value={apiToken}
            onChange={(e: Event) => setApiToken((e.target as HTMLInputElement).value)}
            placeholder="Enter API token"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="api-token-input"
          />
          <p className="text-xs text-gray-500">
            Authentication token from Paperless-ngx settings
          </p>
        </div>

        {/* Username Field (Optional) */}
        <div className="space-y-2">
          <label htmlFor="username" className="block text-sm font-medium text-gray-700">
            Username <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e: Event) => setUsername((e.target as HTMLInputElement).value)}
            placeholder="Enter username"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="username-input"
          />
          <p className="text-xs text-gray-500">
            Optional username for API authentication
          </p>
        </div>
      </div>

      {/* Test Connection Section */}
      <div className="border-t pt-4">
        <button
          onClick={handleTestConnection}
          disabled={!isFormValid || isTesting}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="test-connection-button"
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </button>

        {/* Test Result Feedback */}
        {testResult && (
          <div
            className={`mt-3 p-3 rounded ${
              testResult.success
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
            data-testid="test-result"
          >
            <div className="flex items-start">
              <span className="mr-2">
                {testResult.success ? '✓' : '✗'}
              </span>
              <span>{testResult.message}</span>
            </div>
          </div>
        )}
      </div>

      {/* Save Section */}
      <div className="border-t pt-4">
        <button
          onClick={handleSave}
          disabled={!isFormValid || isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="save-button"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>

        {/* Save Message */}
        {saveMessage && (
          <div
            className="mt-3 p-3 rounded bg-blue-50 border border-blue-200 text-blue-800"
            data-testid="save-message"
          >
            {saveMessage}
          </div>
        )}

        <p className="mt-2 text-sm text-gray-500">
          ⚠️ Changing connection settings requires a restart to take effect
        </p>
      </div>
    </div>
  );
}
