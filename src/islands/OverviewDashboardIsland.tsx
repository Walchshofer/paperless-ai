import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { OverviewDashboard } from '../ui/contracts/Settings.Overview.contract';
import { OverviewDashboardSchema } from '../ui/contracts/Settings.Overview.contract';

/**
 * OverviewDashboardIsland - Summary cards and quick actions for settings
 *
 * Displays current configuration summary across Connection, AI Provider,
 * Expert Models, and Advanced categories. Provides quick navigation actions.
 */
export default function OverviewDashboardIsland(
  props: Partial<OverviewDashboard>
) {
  // Validate and merge props with defaults
  const validated = OverviewDashboardSchema.parse(props);
  const [isLoading, setIsLoading] = useState(false);

  const handleNavigate = (category: string, focus?: string) => {
    const targetCategory = category === 'expert-models' ? 'ai-provider' : category;
    const targetFocus = category === 'expert-models' ? 'expert-models' : focus;

    // Dispatch navigation event
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('settings:navigate', {
        detail: { category: targetCategory, focus: targetFocus }
      }));
    }
    // Update URL hash for direct navigation
    if (typeof window !== 'undefined') {
      window.location.hash = targetCategory;
    }
  };

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/export');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paperless-ai-settings-${new Date().toISOString().split('T')[0]}.env`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="overview-dashboard space-y-6 p-6" data-testid="overview-dashboard-root">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Settings Overview</h2>
        <p className="text-gray-600">Quick summary of your current configuration</p>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Connection Card */}
        <div className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">Connection</h3>
            <div className={`w-2 h-2 rounded-full ${validated.connection?.isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <p className="truncate">{validated.connection?.paperlessApiUrl || 'Not configured'}</p>
            <p className="text-xs">
              {validated.connection?.isConnected ? '✓ Connected' : '○ Not tested'}
            </p>
          </div>
          <button
            onClick={() => handleNavigate('connection')}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            data-testid="nav-connection"
          >
            Configure →
          </button>
        </div>

        {/* AI Provider Card */}
        <div className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">AI Provider</h3>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <p className="capitalize">{validated.aiProvider?.provider || 'Not configured'}</p>
            <p className="truncate text-xs">{validated.aiProvider?.model || '-'}</p>
            {validated.aiProvider?.tokenLimit && (
              <p className="text-xs">Limit: {validated.aiProvider.tokenLimit.toLocaleString()}</p>
            )}
          </div>
          <button
            onClick={() => handleNavigate('ai-provider')}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            data-testid="nav-ai-provider"
          >
            Configure →
          </button>
        </div>

        {/* Expert Models Card */}
        <div className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">Expert Models</h3>
            <div className={`w-2 h-2 rounded-full ${validated.expertModels?.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <p>{validated.expertModels?.enabled ? 'Enabled' : 'Disabled'}</p>
            {validated.expertModels?.enabled && (
              <>
                <p className="text-xs truncate">Medical: {validated.expertModels.medicalVisionModel || '-'}</p>
                <p className="text-xs truncate">Financial: {validated.expertModels.financialAnalysisModel || '-'}</p>
              </>
            )}
          </div>
          <button
            onClick={() => handleNavigate('expert-models')}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            data-testid="nav-expert-models"
          >
            Configure →
          </button>
        </div>

        {/* Advanced Card */}
        <div className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">Advanced</h3>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <p className="text-xs">
              {validated.advanced?.activateTagging ? '✓' : '○'} Tagging
            </p>
            <p className="text-xs">
              {validated.advanced?.activateCorrespondents ? '✓' : '○'} Correspondents
            </p>
            <p className="text-xs">
              Scan: {validated.advanced?.scanInterval || 'Not set'}
            </p>
          </div>
          <button
            onClick={() => handleNavigate('advanced')}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            data-testid="nav-advanced"
          >
            Configure →
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-t pt-6">
        <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="btn-export-settings"
          >
            {isLoading ? 'Exporting...' : 'Export Settings'}
          </button>
          <button
            onClick={() => handleNavigate('connection')}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            data-testid="btn-test-connection"
          >
            Test Connection
          </button>
        </div>
      </div>
    </div>
  );
}
