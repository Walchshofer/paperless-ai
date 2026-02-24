import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { PresetsManagerSettings, PresetMetadata, PresetDiff } from '../ui/contracts/Settings.Presets.contract';
import { PresetsManagerSettingsSchema } from '../ui/contracts/Settings.Presets.contract';
import { DiffTable } from './components/DiffTable';
import { CategoryFilter } from './components/CategoryFilter';

/**
 * PresetsManagerIsland - Configuration presets, import & export
 *
 * Renders inline within the #advanced settings section.
 * Provides preset gallery with category filtering, diff review, and import/export.
 */
export default function PresetsManagerIsland(props: Partial<PresetsManagerSettings>) {
  void PresetsManagerSettingsSchema.parse(props); // validate props shape at mount

  const [presets, setPresets] = useState([] as PresetMetadata[]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [selectedPreset, setSelectedPreset] = useState(null as string | null);
  const [presetDiff, setPresetDiff] = useState(null as PresetDiff | null);
  const [isApplying, setIsApplying] = useState(false);
  const [isImportMode, setIsImportMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null as File | null);
  const [fileContent, setFileContent] = useState(null as string | null);
  const [filterCategory, setFilterCategory] = useState(null as string | null);
  const fileInputRef = useRef(null as HTMLInputElement | null);

  // Fetch presets on mount
  useEffect(() => {
    fetchPresets();
  }, []);

  // Listen for preset:open event (backward compat)
  useEffect(() => {
    const handlePresetOpen = () => {
      fetchPresets();
    };
    document.addEventListener('preset:open', handlePresetOpen);
    return () => document.removeEventListener('preset:open', handlePresetOpen);
  }, []);

  const fetchPresets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/settings/presets');
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
      const response = await fetch(`/api/settings/presets/${presetName}`, {
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
      const response = await fetch(`/api/settings/presets/${selectedPreset}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: false })
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('preset:loaded', {
            detail: { presetName: selectedPreset, requiresRestart: data.requiresRestart || false }
          }));
          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: { type: 'settings:saved', category: 'preset', success: true, message: `Preset "${selectedPreset}" applied successfully` }
          }));
          if (data.requiresRestart) {
            document.dispatchEvent(new CustomEvent('settings:restart-required', {
              detail: { type: 'settings:restart-required', reason: `Preset "${selectedPreset}" applied`, settings: ['Preset'] }
            }));
          }
        }
        handleBackToList();
      } else {
        setError('Failed to apply preset');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsApplying(false);
    }
  };

  const handleBackToList = () => {
    setSelectedPreset(null);
    setPresetDiff(null);
    setError(null);
    setIsImportMode(false);
    setSelectedFile(null);
    setFileContent(null);
  };

  const handleExport = () => {
    window.location.href = '/api/settings/export';
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.env')) {
      setError('Please select a .env file');
      return;
    }

    setSelectedFile(file);
    setIsImportMode(true);
    setError(null);

    // Read file content client-side and send as JSON
    const text = await file.text();
    setFileContent(text);

    try {
      const response = await fetch('/api/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, filename: file.name, preview: true })
      });
      if (response.ok) {
        const data = await response.json();
        setPresetDiff(data.diff);
      } else {
        const errorData = await response.json();
        if (errorData.details) {
          setError(`Invalid .env file:\n${errorData.details.join('\n')}`);
        } else {
          setError(errorData.error || 'Failed to import settings');
        }
        setIsImportMode(false);
        setSelectedFile(null);
        setFileContent(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsImportMode(false);
      setSelectedFile(null);
      setFileContent(null);
    }

    target.value = '';
  };

  const handleApplyImport = async () => {
    if (!fileContent) return;
    setIsApplying(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fileContent, filename: selectedFile?.name, preview: false })
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: { type: 'settings:saved', category: 'import', success: true, message: `Settings imported successfully (${data.changesCount} changes)` }
          }));
          if (data.requiresRestart) {
            document.dispatchEvent(new CustomEvent('settings:restart-required', {
              detail: { type: 'settings:restart-required', reason: 'Settings imported', settings: ['Import'] }
            }));
          }
        }
        handleBackToList();
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

  // Derive available categories from presets
  const availableCategories = Array.from(new Set(presets.map(p => p.category).filter(Boolean))) as string[];
  const filteredPresets = filterCategory
    ? presets.filter(p => p.category === filterCategory)
    : presets;

  return (
    <div className="presets-manager space-y-6 p-6 max-w-4xl" data-testid="presets-manager-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Presets & Configuration</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Load presets, import settings, or export your current configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportClick}
            className="save-bar-btn"
            style={{ fontSize: '0.8125rem', padding: '0.4375rem 1rem' }}
            data-testid="import-settings-button"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          <button
            onClick={handleExport}
            className="save-bar-btn"
            style={{ fontSize: '0.8125rem', padding: '0.4375rem 1rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            data-testid="export-settings-button"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
          data-testid="error-message"
        >
          {error.split('\n').map((line: string, index: number) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      )}

      {/* Diff Review Panel */}
      {presetDiff ? (
        <div className="dev-section-panel" data-testid="preset-diff">
          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Review Changes</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {isImportMode
                  ? 'The following settings will change when you import this file'
                  : `The following settings will change when you apply "${selectedPreset}"`}
              </p>
            </div>

            <DiffTable changes={presetDiff.changes} />

            {presetDiff.requiresRestart && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#f59e0b' }}
              >
                Applying this preset requires a restart to take effect.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleBackToList}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)', background: 'transparent' }}
                data-testid="cancel-diff-button"
              >
                {isImportMode ? 'Cancel Import' : 'Back to Presets'}
              </button>
              <button
                onClick={isImportMode ? handleApplyImport : handleApplyPreset}
                disabled={isApplying}
                className="save-bar-btn"
                data-testid={isImportMode ? 'apply-import-button' : 'apply-preset-button'}
              >
                {isApplying ? 'Applying...' : (isImportMode ? 'Apply Import' : 'Apply Preset')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Preset Gallery */
        <div>
          {/* Category Filter */}
          {availableCategories.length > 0 && (
            <CategoryFilter
              categories={availableCategories}
              activeCategory={filterCategory}
              onSelect={setFilterCategory}
            />
          )}

          {isLoading ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }} data-testid="loading-presets">
              <div className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mb-3" />
              <div className="text-sm">Loading presets...</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPresets.map((preset: PresetMetadata, i: number) => (
                <button
                  key={preset.name}
                  onClick={() => handleSelectPreset(preset.name)}
                  className="preset-card w-full text-left stagger-child"
                  style={{ animationDelay: `${i * 40}ms` }}
                  data-testid={`preset-${preset.name}`}
                >
                  {preset.icon && (
                    <span className="text-2xl flex-shrink-0 mt-0.5">{preset.icon}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{preset.displayName}</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{preset.description}</p>
                    {preset.category && (
                      <span
                        className="inline-block mt-1.5 px-2 py-0.5 rounded text-xs font-medium"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                      >
                        {preset.category}
                      </span>
                    )}
                  </div>
                  <svg className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}

              {!isLoading && filteredPresets.length === 0 && (
                <div className="text-center py-12" style={{ color: 'var(--text-muted)' }} data-testid="no-presets">
                  <div className="text-3xl mb-2">📦</div>
                  <div className="text-sm">
                    {filterCategory ? `No presets in "${filterCategory}" category` : 'No presets available'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".env"
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
        data-testid="file-input"
      />
    </div>
  );
}
