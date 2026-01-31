import { h } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { ViewModeToggleSchema, type ViewModeToggleContract } from '../ui/contracts/ViewModeToggle.contract';

function dispatchEventSafe(name: string, detail?: unknown) {
  if (typeof document === 'undefined') return;
  if (typeof document.dispatchEvent !== 'function') return;
  const EventConstructor = (typeof window !== 'undefined' && window.CustomEvent) ? window.CustomEvent : CustomEvent;
  document.dispatchEvent(new EventConstructor(name, { detail } as CustomEventInit<any>));
}

export default function ViewModeToggleIsland(props: Partial<ViewModeToggleContract>) {
  // Runtime validate props
  const validated = ViewModeToggleSchema.parse(props);

  const [mode, setMode] = useState((props.mode || 'text') as 'text' | 'visual');
  const [visualEnabled, setVisualEnabled] = useState(props.visualEnabled !== false);

  // Listen for document selection to enable/disable visual mode
  useEffect(() => {
    const onDocumentSelected = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      if (detail.documentId) {
        setVisualEnabled(true);
        return;
      }
      setVisualEnabled(false);
      setMode('text');
    };

    window.addEventListener('document:selected', onDocumentSelected as EventListener);
    return () => window.removeEventListener('document:selected', onDocumentSelected as EventListener);
  }, []);

  // Test-only marker to indicate the island mounted
  useEffect(() => {
    try { (window as any).__viewmode_toggle_island_mounted = true; } catch (e) { /* ignore */ }
  }, []);

  const handleModeChange = useCallback((newMode: 'text' | 'visual') => {
    if (newMode === mode) return;
    
    setMode(newMode);
    
    dispatchEventSafe('viewmode:changed', {
      type: 'viewmode:changed',
      mode: newMode,
      documentId: props.documentId ?? null,
    });
  }, [mode, props.documentId]);

  const textBtnRef = useRef(null as HTMLButtonElement | null);
  const visualBtnRef = useRef(null as HTMLButtonElement | null);

  useEffect(() => {
    if (textBtnRef.current) textBtnRef.current.setAttribute('aria-pressed', String(mode === 'text'));
    if (visualBtnRef.current) visualBtnRef.current.setAttribute('aria-pressed', String(mode === 'visual'));
  }, [mode]);

  return (
    <div data-testid="view-mode-toggle-root" data-hydrated="true" className="vmt-root">
      <div className="vmt-toggle-group" role="group" aria-label="View mode toggle">
        <button
          type="button"
          data-testid="view-text-btn"
          ref={(el: HTMLButtonElement | null) => { textBtnRef.current = el; }}
          onClick={() => handleModeChange('text')}
          className={`vmt-btn ${mode === 'text' ? 'vmt-btn-active' : 'vmt-btn-inactive'}`}
        >
          <i className="fas fa-file-alt vmt-icon" aria-hidden="true"></i>
          <span>Text</span>
        </button>
        <button
          type="button"
          data-testid="view-visual-btn"
          onClick={() => handleModeChange('visual')}
          className={`vmt-btn ${mode === 'visual' ? 'vmt-btn-active' : 'vmt-btn-inactive'}`}
          ref={(el: HTMLButtonElement | null) => { visualBtnRef.current = el; }}
          disabled={!visualEnabled}
        >
          <i className="fas fa-image vmt-icon" aria-hidden="true"></i>
          <span>Visual</span>
        </button>
      </div>

      <style>{`
        .vmt-root {
          font-family: system-ui, -apple-system, sans-serif;
        }
        .vmt-toggle-group {
          display: flex;
          gap: 8px;
        }
        .vmt-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          font-size: 0.875rem;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid var(--border-color, #ddd);
        }
        .vmt-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .vmt-btn-active {
          background: var(--accent-primary, #3498db);
          color: white;
          border-color: var(--accent-primary, #3498db);
        }
        .vmt-btn-inactive {
          background: var(--bg-secondary, #f8f9fa);
          color: var(--text-primary, #333);
        }
        .vmt-btn-inactive:hover:not(:disabled) {
          background: var(--hover-bg, #e9ecef);
        }
        .vmt-icon {
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
