import { h } from 'preact';
import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import type { FeedbackControlsContract } from '../ui/contracts/FeedbackControls.contract';

type FeedbackState = 'up' | 'down' | null;

let styles: Record<string, string> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  styles = require('./FeedbackControlsIsland.module.css');
} catch (e) {
  // Server/test: CSS module may not be available at runtime
}

function dispatchEventSafe(name: string, detail: any) {
  if (typeof document === 'undefined') return;
  if (typeof document.dispatchEvent !== 'function') return;
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

export default function FeedbackControlsIsland(
  props: Partial<FeedbackControlsContract>
) {
  const available = props.availableComponents || ['tags', 'correspondent', 'document_type'];
  // map of component -> 'up' | 'down' | null
  const [stateMap, setStateMap] = useState<Record<string, FeedbackState>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  // refs for accessibility updates
  const refs = useRef<Record<string, { up?: HTMLButtonElement | null; down?: HTMLButtonElement | null }>>({});

  // Load initial state from props
  useEffect(() => {
    if (props.components && Array.isArray(props.components)) {
      const initial: Record<string, FeedbackState> = {};
      for (const c of props.components) {
        initial[c.component] = c.feedback_type === 'thumbs_up' ? 'up' : 'down';
      }
      setStateMap(initial);
    }
  }, [props.components]);

  // Reflect state on DOM as literal strings for axe accessibility
  useEffect(() => {
    available.forEach((c) => {
      const s = stateMap[c] || null;
      const r = refs.current[c];
      if (r && r.up) r.up.setAttribute('aria-pressed', s === 'up' ? 'true' : 'false');
      if (r && r.down) r.down.setAttribute('aria-pressed', s === 'down' ? 'true' : 'false');
    });
  }, [stateMap, available]);

  const emitFeedback = useCallback(async (
    component: string,
    feedback_type: 'thumbs_up' | 'thumbs_down'
  ) => {
    const detail: any = { component, feedback_type };
    if (props.documentId != null) detail.documentId = props.documentId;

    // Dispatch updated event (legacy/consumer)
    dispatchEventSafe('feedback:updated', detail);

    // Publish a confirmation event for thumbs_up only
    if (feedback_type === 'thumbs_up') {
      dispatchEventSafe('feedback:confirmed', {
        component,
        documentId: props.documentId || null
      });
    }

    // Persist to backend
    if (props.documentId != null) {
      setIsSyncing(true);
      try {
        await fetch('/api/visual-rag/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': `fci-${Date.now()}`,
          },
          body: JSON.stringify({
            documentId: props.documentId,
            events: [{
              event_type: feedback_type === 'thumbs_up' ? 'verification' : 'correction',
              field_name: component,
              context: { feedback_type }
            }]
          }),
        });
      } catch (err) {
        console.warn('Feedback sync failed:', err);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [props.documentId]);

  const handleUp = useCallback((component: string) => {
    const newState = stateMap[component] === 'up' ? null : 'up';
    setStateMap((prev) => ({ ...prev, [component]: newState }));
    if (newState === 'up') {
      emitFeedback(component, 'thumbs_up');
    }
  }, [stateMap, emitFeedback]);

  const handleDown = useCallback((component: string) => {
    const newState = stateMap[component] === 'down' ? null : 'down';
    setStateMap((prev) => ({ ...prev, [component]: newState }));
    if (newState === 'down') {
      emitFeedback(component, 'thumbs_down');
    }
  }, [stateMap, emitFeedback]);

  // Display name for components
  const getDisplayName = (component: string): string => {
    const names: Record<string, string> = {
      tags: 'Tags',
      correspondent: 'Correspondent',
      document_type: 'Document Type',
      content: 'Content',
      title: 'Title',
    };
    return names[component] || component.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div
      data-testid="feedback-controls-island-root"
      data-hydrated="true"
      role="group"
      aria-label="Feedback Controls"
      className={`fci-root ${styles.root ?? ''}`}
    >
      {isSyncing && (
        <div className="fci-sync-indicator" data-testid="sync-indicator" aria-live="polite">
          Syncing...
        </div>
      )}

      <div className="fci-grid">
        {available.map((c) => (
          <div key={c} className="fci-item">
            <span className="fci-label">{getDisplayName(c)}</span>
            <div className="fci-buttons">
              <button
                type="button"
                data-testid={`thumbs-up-${c}`}
                aria-pressed={stateMap[c] === 'up'}
                ref={(el) => {
                  refs.current[c] = Object.assign(refs.current[c] || {}, { up: el });
                }}
                className={`fci-btn fci-btn-up ${stateMap[c] === 'up' ? 'fci-btn-active' : ''} ${styles.button ?? ''}`}
                onClick={() => handleUp(c)}
                title={`${getDisplayName(c)} is correct`}
              >
                👍
              </button>

              <button
                type="button"
                data-testid={`thumbs-down-${c}`}
                aria-pressed={stateMap[c] === 'down'}
                ref={(el) => {
                  refs.current[c] = Object.assign(refs.current[c] || {}, { down: el });
                }}
                className={`fci-btn fci-btn-down ${stateMap[c] === 'down' ? 'fci-btn-active' : ''} ${styles.button ?? ''}`}
                onClick={() => handleDown(c)}
                title={`${getDisplayName(c)} needs correction`}
              >
                👎
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .fci-root {
          font-family: system-ui, -apple-system, sans-serif;
          position: relative;
        }
        .fci-sync-indicator {
          position: absolute;
          top: -8px;
          right: 0;
          background: #fff3cd;
          color: #856404;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          animation: fci-pulse 1s ease infinite;
        }
        .fci-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .fci-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 6px;
          border: 1px solid #e9ecef;
        }
        .fci-label {
          font-size: 0.85rem;
          font-weight: 500;
          color: #495057;
          min-width: 80px;
        }
        .fci-buttons {
          display: flex;
          gap: 4px;
        }
        .fci-btn {
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
          line-height: 1;
        }
        .fci-btn:hover {
          background: #f5f5f5;
          transform: scale(1.05);
        }
        .fci-btn-active {
          transform: scale(1.1);
        }
        .fci-btn-up.fci-btn-active {
          background: #d4edda;
          border-color: #28a745;
        }
        .fci-btn-down.fci-btn-active {
          background: #f8d7da;
          border-color: #dc3545;
        }
        @keyframes fci-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
