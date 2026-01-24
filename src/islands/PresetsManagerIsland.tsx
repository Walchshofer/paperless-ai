import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { PresetsManagerSettings, PresetMetadata, PresetDiff } from '../ui/contracts/Settings.Presets.contract';
import { PresetsManagerSettingsSchema } from '../ui/contracts/Settings.Presets.contract';

/**
 * PresetsManagerIsland - Preset loading modal
 *
 * Allows users to load predefined configuration presets.
 * Shows diff review before applying changes.
 */
export default function PresetsManagerIsland(props: Partial<PresetsManagerSettings>) {
  const validated = PresetsManagerSettingsSchema.parse(props);

  const [isOpen, setIsOpen] = useState(validated.isOpen || false);
  const [presets, setPresets] = useState<PresetMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [presetDiff, setPresetDiff] = useState<PresetDiff | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isImportMode, setIsImportMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch available presets when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchPresets();
    }
  }, [isOpen]);

  // Listen for preset:open event
  useEffect(() => {
    const handlePresetOpen = () => {
      setIsOpen(true);
    };

    document.addEventListener('preset:open', handlePresetOpen);

    return () => {
      document.removeEventListener('preset:open', handlePresetOpen);
    };
  }, []);

  const fetchPresets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/settings/presets');
      if (response.ok) {
        const data = await response.json();
        setPresets(data.presets || []);
      } else {
        setError('Failed to load presets');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = async (presetName: string) => {
    setSelectedPreset(presetName);
    setError(null);

    try {
      const response = await fetch(`/settings/presets/${presetName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: true })
      });

      if (response.ok) {
        const data = await response.json();
        setPresetDiff(data.diff);
      } else {
        setError('Failed to load preset diff');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleApplyPreset = async () => {
    if (!selectedPreset) return;

    setIsApplying(true);
    setError(null);

    try {
      const response = await fetch(`/settings/presets/${selectedPreset}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: false })
      });

      if (response.ok) {
        const data = await response.json();

        // Dispatch preset:loaded event
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('preset:loaded', {
            detail: {
              presetName: selectedPreset,
              requiresRestart: data.requiresRestart || false
            }
          }));

          // Dispatch settings:saved event
          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: {
              type: 'settings:saved',
              category: 'preset',
              success: true,
              message: `Preset "${selectedPreset}" applied successfully`
            }
          }));

          // If requires restart, dispatch restart-required event
          if (data.requiresRestart) {
            document.dispatchEvent(new CustomEvent('settings:restart-required', {
              detail: {
                type: 'settings:restart-required',
                reason: `Preset "${selectedPreset}" applied`,
                settings: ['Preset']
              }
            }));
          }
        }

        // Close modal
        handleClose();
      } else {
        setError('Failed to apply preset');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedPreset(null);
    setPresetDiff(null);
    setError(null);
    setIsImportMode(false);
    setSelectedFile(null);
  };

  const handleCancelDiff = () => {
    setSelectedPreset(null);
    setPresetDiff(null);
    setError(null);
    setIsImportMode(false);
    setSelectedFile(null);
  };

  const handleExport = () => {
    // Trigger settings export by navigating to the export endpoint
    window.location.href = '/settings/export';
  };

  const handleImportClick = () => {
    // Trigger the hidden file input
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith('.env')) {
      setError('Please select a .env file');
      return;
    }

    setSelectedFile(file);
    setIsImportMode(true);
    setError(null);

    // Upload file for preview
    const formData = new FormData();
    formData.append('file', file);
    formData.append('preview', 'true');

    try {
      const response = await fetch('/settings/import', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setPresetDiff(data.diff);
      } else {
        const errorData = await response.json();
        if (errorData.details) {
          // Validation errors with line numbers
          setError(`Invalid .env file:\n${errorData.details.join('\n')}`);
        } else {
          setError(errorData.error || 'Failed to import settings');
        }
        setIsImportMode(false);
        setSelectedFile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsImportMode(false);
      setSelectedFile(null);
    }

    // Reset file input
    target.value = '';
  };

  const handleApplyImport = async () => {
    if (!selectedFile) return;

    setIsApplying(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('preview', 'false');

    try {
      const response = await fetch('/settings/import', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();

        // Dispatch settings:saved event
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: {
              type: 'settings:saved',
              category: 'import',
              success: true,
              message: `Settings imported successfully (${data.changesCount} changes)`
            }
          }));

          // If requires restart, dispatch restart-required event
          if (data.requiresRestart) {
            document.dispatchEvent(new CustomEvent('settings:restart-required', {
              detail: {
                type: 'settings:restart-required',
                reason: 'Settings imported',
                settings: ['Import']
              }
            }));
          }
        }

        // Close modal
        handleClose();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to import settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" data-testid="presets-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" data-testid="presets-modal-content">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Presets, Import & Export</h2>
            <p className="text-sm text-gray-600">Load presets, import settings, or export current settings</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleImportClick}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              data-testid="import-settings-button"
            >
              <svg className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Settings
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              data-testid="export-settings-button"
            >
              <svg className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Settings
            </button>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              data-testid="close-modal-button"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800" data-testid="error-message">
              {error.split('\n').map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
          )}

          {/* Preset List */}
          {!presetDiff && (
            <div>
              {isLoading ? (
                <div className="text-center py-8 text-gray-500" data-testid="loading-presets">
                  Loading presets...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {presets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handleSelectPreset(preset.name)}
                      className="p-4 border-2 rounded-lg text-left hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      data-testid={`preset-${preset.name}`}
                    >
                      <div className="flex items-start space-x-3">
                        {preset.icon && (
                          <span className="text-3xl">{preset.icon}</span>
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{preset.displayName}</h3>
                          <p className="text-sm text-gray-600">{preset.description}</p>
                          {preset.category && (
                            <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-200 rounded">
                              {preset.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!isLoading && presets.length === 0 && (
                <div className="text-center py-8 text-gray-500" data-testid="no-presets">
                  No presets available
                </div>
              )}
            </div>
          )}

          {/* Preset/Import Diff Review */}
          {presetDiff && (
            <div data-testid="preset-diff">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Review Changes</h3>
                <p className="text-sm text-gray-600">
                  {isImportMode
                    ? 'The following settings will be changed when you import this file'
                    : `The following settings will be changed when you apply "${selectedPreset}"`}
                </p>
              </div>

              <div className="space-y-2 mb-6">
                {presetDiff.changes.map((change, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 border rounded"
                    data-testid={`diff-item-${index}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{change.key}</div>
                        {change.category && (
                          <div className="text-xs text-gray-500">{change.category}</div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="text-red-600" data-testid={`current-value-${index}`}>
                          {String(change.currentValue ?? 'not set')}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-600 font-medium" data-testid={`new-value-${index}`}>
                          {String(change.newValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {presetDiff.requiresRestart && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                  ⚠️ Applying this preset will require a restart
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleCancelDiff}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                  data-testid="cancel-diff-button"
                >
                  {isImportMode ? 'Cancel Import' : 'Back to Presets'}
                </button>
                <button
                  onClick={isImportMode ? handleApplyImport : handleApplyPreset}
                  disabled={isApplying}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid={isImportMode ? 'apply-import-button' : 'apply-preset-button'}
                >
                  {isApplying ? 'Applying...' : (isImportMode ? 'Apply Import' : 'Apply Preset')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".env"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          data-testid="file-input"
        />
      </div>
    </div>
  );
}
