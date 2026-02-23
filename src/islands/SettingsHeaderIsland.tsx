import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { SettingsHeaderProps } from '../ui/contracts/Settings.Header.contract';

export default function SettingsHeaderIsland({ apiKey: initialApiKey = '', isAdmin = false }: Partial<SettingsHeaderProps>) {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showCopySuccess, setShowCopyNotification] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey).then(() => {
      setShowCopyNotification(true);
      setTimeout(() => setShowCopyNotification(false), 3000);
    });
  };

  const handleRegenerate = async () => {
    if (!isAdmin || !confirm('Are you sure you want to regenerate the API key? Any existing integrations using the current key will stop working immediately.')) {
      return;
    }

    setIsRegenerating(true);
    try {
      const response = await fetch('/api/settings/regenerate-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        setApiKey(data.apiKey);
      } else {
        alert('Failed to regenerate API key: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('An error occurred while regenerating the API key.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="content-header flex justify-between items-center px-6 py-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700" data-testid="settings-header">
      <div className="flex items-center gap-3">
        <h2 className="content-title text-2xl font-semibold text-gray-800 dark:text-white">Configuration</h2>
      </div>
      
      <div className="relative flex items-center space-x-4">
        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">API-KEY:</span>
        <div 
          className="relative w-48 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded cursor-pointer select-none filter blur-sm hover:blur-none transition-all duration-200 truncate font-mono text-sm border border-gray-200 dark:border-gray-600"
          onClick={handleCopy}
          data-testid="settings-api-key"
          title="Click to copy"
        >
          {apiKey}
        </div>
        
        {isAdmin && (
          <button 
            onClick={handleRegenerate}
            disabled={isRegenerating}
            data-testid="settings-regenerate-btn"
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 transition-colors flex items-center space-x-2 text-sm font-medium shadow-sm"
          >
            <i className={`fas fa-sync-alt ${isRegenerating ? 'fa-spin' : ''}`}></i>
            <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
          </button>
        )}

        {showCopySuccess && (
          <div className="absolute right-0 top-12 w-64 bg-green-50 dark:bg-green-900/90 text-green-800 dark:text-green-100 border border-green-200 dark:border-green-700 rounded-lg p-3 shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center">
              <i className="fas fa-check-circle mr-2 text-green-500"></i>
              <span>API key copied to clipboard!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
