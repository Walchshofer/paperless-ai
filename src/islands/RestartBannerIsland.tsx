import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { RestartBannerSettings } from '../ui/contracts/Settings.RestartBanner.contract';
import { RestartBannerSettingsSchema } from '../ui/contracts/Settings.RestartBanner.contract';

/**
 * RestartBannerIsland - Persistent restart notification banner
 *
 * Listens for settings:restart-required events and displays a non-blocking
 * banner notification. Persists across navigation until dismissed or restart occurs.
 */
export default function RestartBannerIsland(props: Partial<RestartBannerSettings>) {
  const validated = RestartBannerSettingsSchema.parse(props);

  const [isVisible, setIsVisible] = useState(validated.initiallyVisible || false);
  const [reason, setReason] = useState(validated.initialReason || 'Settings changed');
  const [changedSettings, setChangedSettings] = useState(validated.initialChangedSettings || [] as string[]);

  useEffect(() => {
    // Listen for restart-required events
    const handleRestartRequired = (event: CustomEvent<{ settings?: string[]; reason?: string }>) => {
      const detail = event.detail;
      setIsVisible(true);
      setReason(detail.reason || 'Settings changed');

      // Accumulate changed settings (avoid duplicates)
      if (detail.settings && Array.isArray(detail.settings)) {
        setChangedSettings((prev: string[]) => {
          const additions = detail.settings || [];
          const combined = [...prev, ...additions];
          return Array.from(new Set(combined));
        });
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('settings:restart-required', handleRestartRequired as EventListener);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('settings:restart-required', handleRestartRequired as EventListener);
      }
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setChangedSettings([]);
  };

  const handleRestart = async () => {
    // Trigger restart via API
    try {
      const response = await fetch('/api/settings/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // Show "Restarting..." message
        setReason('System reboot initiated. Reconnecting in 5s...');
        // Refresh page after a short delay to reconnect
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to trigger restart:', error);
    }
  };

  // Always render wrapper for test discoverability, but hide content when not visible
  return (
    <div
      className={`restart-banner ${isVisible ? 'fixed top-0 left-0 right-0 z-50 bg-yellow-100 border-b-2 border-yellow-400 px-6 py-4 shadow-md' : 'hidden'}`}
      data-testid="restart-banner-root"
      data-visible={isVisible ? 'true' : 'false'}
    >
      {!isVisible ? null : (
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              data-testid="warning-icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-yellow-800" data-testid="restart-message">
              <span className="font-semibold">Restart Required:</span> {reason}
            </p>
            {changedSettings.length > 0 && (
              <p className="text-xs text-yellow-700 mt-1" data-testid="changed-settings">
                Changed: {changedSettings.join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRestart}
            className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            data-testid="restart-button"
          >
            Restart Now
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-yellow-700 hover:text-yellow-900 focus:outline-none"
            data-testid="dismiss-button"
            aria-label="Dismiss"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
