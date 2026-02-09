import { h } from 'preact';
import { useState } from 'preact/hooks';

interface UnifiedSaveFooterProps {
  dirtyCount: number;
  onSave: () => void;
  onResetAll: () => void;
  isSaving: boolean;
  saveMessage: string | null;
}

/**
 * UnifiedSaveFooter - Sticky save footer for the Ollama tab.
 * Shows unsaved count indicator, "Save All Settings" button, "Reset All to Defaults" button.
 * Reset opens a confirmation dialog (simple div overlay).
 */
export function UnifiedSaveFooter({
  dirtyCount,
  onSave,
  onResetAll,
  isSaving,
  saveMessage,
}: UnifiedSaveFooterProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="sf-footer" data-testid="unified-save-footer">
      <div className="sf-footer-inner">
        {/* Unsaved count indicator */}
        {dirtyCount > 0 && (
          <span className="sf-indicator" data-testid="sf-dirty-count">
            {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
          </span>
        )}

        {/* Save message */}
        {saveMessage && (
          <span
            className={`sf-message ${saveMessage.toLowerCase().includes('fail') ? 'sf-message--error' : 'sf-message--success'}`}
            data-testid="sf-save-message"
          >
            {saveMessage}
          </span>
        )}

        <div className="sf-actions">
          <button
            type="button"
            className="sf-reset-btn"
            onClick={() => setConfirmReset(true)}
            disabled={isSaving}
            data-testid="sf-reset-all-btn"
          >
            Reset All to Defaults
          </button>

          <button
            type="button"
            className="sf-save-btn"
            onClick={onSave}
            disabled={dirtyCount === 0 || isSaving}
            data-testid="sf-save-all-btn"
          >
            {isSaving ? (
              <>
                <span className="sf-spinner" />
                Saving...
              </>
            ) : (
              'Save All Settings'
            )}
          </button>
        </div>
      </div>

      {/* Reset confirmation overlay */}
      {confirmReset && (
        <div className="sf-confirm-modal" data-testid="sf-confirm-modal">
          <div className="sf-confirm-modal-backdrop" onClick={() => setConfirmReset(false)} />
          <div className="sf-confirm-modal-content" role="alertdialog" aria-label="Confirm reset">
            <h4 className="sf-confirm-title">Reset All to Defaults?</h4>
            <p className="sf-confirm-body">
              This will revert all Ollama and expert model settings to their factory defaults.
              You will still need to click "Save All Settings" to persist the changes.
            </p>
            <div className="sf-confirm-actions">
              <button
                type="button"
                className="sf-confirm-cancel"
                onClick={() => setConfirmReset(false)}
                data-testid="sf-confirm-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                className="sf-confirm-proceed"
                onClick={() => {
                  setConfirmReset(false);
                  onResetAll();
                }}
                data-testid="sf-confirm-proceed"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
