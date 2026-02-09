import { h } from 'preact';
import { ModelSelector } from './ModelSelector';
import { RangeNumberInput } from './RangeNumberInput';

interface TokenLimits {
  contextWindow?: number;
  maxResponse?: number;
  imageTokens?: number;
}

interface ModelCardProps {
  id: string;
  label: string;
  purpose: string;
  value: string;
  onChange: (value: string) => void;
  defaultValue: string;
  onReset: () => void;
  availableModels: string[];
  promptId?: string;
  promptRegistry?: Record<string, string>;
  tokenLimits?: TokenLimits;
  onTokenLimitChange?: (field: string, value: number) => void;
  testIdPrefix: string;
}

/**
 * ModelCard - Single model configuration card.
 * Shows model selector, optional inline token limits, prompt link, and reset button.
 * Displays a "modified" indicator when value differs from defaultValue.
 */
export function ModelCard({
  id,
  label,
  purpose,
  value,
  onChange,
  defaultValue,
  onReset,
  availableModels,
  promptId,
  promptRegistry,
  tokenLimits,
  onTokenLimitChange,
  testIdPrefix,
}: ModelCardProps) {
  const isDirty = value !== defaultValue;
  const resolvedPromptId = promptId
    ? (promptRegistry && promptRegistry[promptId]) || promptId
    : null;

  return (
    <div
      className={`mc-card${isDirty ? ' mc-card--dirty' : ''}`}
      data-testid={`${testIdPrefix}-card`}
      role="group"
      aria-label={`${label} model configuration`}
    >
      {/* Header */}
      <div className="mc-card-header">
        <div className="mc-card-title-row">
          <h5 className="mc-card-label">{label}</h5>
          {isDirty && (
            <span
              className="mc-card-dirty-dot"
              aria-label="Modified"
              data-testid={`${testIdPrefix}-dirty-indicator`}
            />
          )}
        </div>
        <p className="mc-card-purpose">{purpose}</p>
      </div>

      {/* Body */}
      <div className="mc-card-body">
        <ModelSelector
          id={id}
          value={value}
          onChange={onChange}
          availableModels={availableModels}
          placeholder={defaultValue ? `${defaultValue} (default)` : '(uses default text model)'}
          testId={`${testIdPrefix}-selector`}
        />

        {/* Inline token limits */}
        {tokenLimits && onTokenLimitChange && (
          <div className="mc-card-limits">
            {tokenLimits.contextWindow !== undefined && (
              <RangeNumberInput
                id={`${id}-ctx`}
                label="Context Window"
                description=""
                value={tokenLimits.contextWindow}
                min={1024}
                max={256000}
                step={1024}
                unit="tokens"
                onChange={(v) => onTokenLimitChange('contextWindow', v)}
                testId={`${testIdPrefix}-context-window`}
              />
            )}
            {tokenLimits.maxResponse !== undefined && (
              <RangeNumberInput
                id={`${id}-resp`}
                label="Max Response"
                description=""
                value={tokenLimits.maxResponse}
                min={256}
                max={32768}
                step={256}
                unit="tokens"
                onChange={(v) => onTokenLimitChange('maxResponse', v)}
                testId={`${testIdPrefix}-max-response`}
              />
            )}
            {tokenLimits.imageTokens !== undefined && (
              <RangeNumberInput
                id={`${id}-img`}
                label="Image Tokens"
                description=""
                value={tokenLimits.imageTokens}
                min={128}
                max={4096}
                step={128}
                unit="tokens/image"
                onChange={(v) => onTokenLimitChange('imageTokens', v)}
                testId={`${testIdPrefix}-image-tokens`}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mc-card-footer">
        {resolvedPromptId && (
          <a
            href={`/settings#prompts`}
            className="mc-prompt-link"
            data-testid={`${testIdPrefix}-prompt-link`}
            title={`Prompt: ${resolvedPromptId}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M16 13H8M16 17H8M10 9H8" />
            </svg>
            {resolvedPromptId}
          </a>
        )}
        <button
          type="button"
          className="mc-reset-btn"
          onClick={onReset}
          disabled={!isDirty}
          aria-label={`Reset ${label} to default`}
          data-testid={`${testIdPrefix}-reset`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2.5 2v6h6M21.5 22v-6h-6" />
            <path d="M22 11.5A10 10 0 003.2 7.2M2 12.5a10 10 0 0018.8 4.3" />
          </svg>
          Reset
        </button>
      </div>
    </div>
  );
}
