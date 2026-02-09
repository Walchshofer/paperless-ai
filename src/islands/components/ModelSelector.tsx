import { h } from 'preact';
import { useState } from 'preact/hooks';

interface ModelSelectorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  availableModels: string[];
  placeholder?: string;
  testId: string;
}

/**
 * ModelSelector - Combobox with dropdown from available models + manual text input.
 * If availableModels has items, show a <select> with an "Other..." option that switches to text input.
 * If no models available, show text input only.
 */
export function ModelSelector({
  id,
  value,
  onChange,
  availableModels,
  placeholder = '',
  testId,
}: ModelSelectorProps) {
  const hasModels = availableModels && availableModels.length > 0;
  const valueInList = hasModels && availableModels.includes(value);
  const [manualMode, setManualMode] = useState(!valueInList && value !== '');

  if (!hasModels || manualMode) {
    return (
      <div className="mc-selector-wrap">
        <input
          id={id}
          type="text"
          value={value}
          onInput={(e: Event) => onChange((e.target as HTMLInputElement).value)}
          placeholder={placeholder}
          className="mc-selector-input"
          data-testid={testId}
        />
        {hasModels && (
          <button
            type="button"
            className="mc-selector-toggle"
            onClick={() => setManualMode(false)}
            aria-label="Switch to dropdown"
            data-testid={`${testId}-toggle-dropdown`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mc-selector-wrap">
      <select
        id={id}
        value={valueInList ? value : '__other__'}
        onChange={(e: Event) => {
          const selected = (e.target as HTMLSelectElement).value;
          if (selected === '__other__') {
            setManualMode(true);
          } else {
            onChange(selected);
          }
        }}
        className="mc-selector-select"
        data-testid={testId}
      >
        <option value="" disabled>
          {placeholder || 'Select a model...'}
        </option>
        {availableModels.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value="__other__">Other (manual entry)...</option>
      </select>
    </div>
  );
}
