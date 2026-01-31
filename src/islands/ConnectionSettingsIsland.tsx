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
export default function ConnectionSettingsIsland(
  props: Partial<ConnectionSettings>
) {
  // Validate and merge props with defaults
  const validated = ConnectionSettingsSchema.parse(props);

  const [apiUrl, setApiUrl] = useState(validated.paperlessApiUrl || '');
  const [apiToken, setApiToken] = useState(validated.paperlessApiToken || '');
  const [username, setUsername] = useState(validated.paperlessUsername || '');

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState(null as TestConnectionResult | null);
  const [saveMessage, setSaveMessage] = useState(null as string | null);

  // Auto-clear test result after 5 seconds
  useEffect(() => {
    if (testResult) {
      const timer = setTimeout(() => setTestResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [testResult]);

  // Auto-clear save message after 3 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperlessApiUrl: apiUrl,
          paperlessApiToken: apiToken,
          timeout: validated.testConnectionTimeoutMs
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTestResult({
          success: true,
          message: result.message || 'Connection successful!'
        });
      } else {
        setTestResult({
          success: false,
          message: result.message || result.error || 'Connection failed'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const settings = {
        PAPERLESS_API_URL: apiUrl,
        PAPERLESS_API_TOKEN: apiToken,
        ...(username && { PAPERLESS_USERNAME: username })
      };

      // Connection settings require restart
      const response = await fetch('/settings/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'connection',
          settings,
          requiresRestart: true
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSaveMessage('Settings saved successfully');

        // Dispatch settings changed event
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:changed', {
            detail: {
              type: 'settings:changed',
              category: 'connection',
              settings,
              requiresRestart: true
            }
          }));

          // Dispatch restart required event
          document.dispatchEvent(new CustomEvent('settings:restart-required', {
            detail: {
              type: 'settings:restart-required',
              reason: 'Connection settings changed',
              settings: ['API URL', 'API Token']
            }
          }));

          // Dispatch save confirmation
          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: {
              type: 'settings:saved',
              category: 'connection',
              success: true,
              message: 'Settings saved successfully'
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

  const isFormValid = apiUrl.trim() !== '' && apiToken.trim() !== '';

  return (
    <div className="connection-settings space-y-6 p-6 max-w-2xl" data-testid="connection-settings-root">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Connection Settings</h2>
        <p className="text-gray-600">Configure connection to Paperless-ngx instance</p>
      </div>

      <div className="space-y-4">
        {/* API URL Field */}
        <div className="space-y-2">
          <label htmlFor="api-url" className="block text-sm font-medium text-gray-700">
            API URL <span className="text-red-500">*</span>
          </label>
          <input
            id="api-url"
            type="url"
            value={apiUrl}
            onChange={(e: Event) => setApiUrl((e.target as HTMLInputElement).value)}
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
