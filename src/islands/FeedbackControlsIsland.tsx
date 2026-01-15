import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FeedbackControlsContract } from '../ui/contracts/FeedbackControls.contract';

let styles: Record<string, string> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  styles = require('./FeedbackControlsIsland.module.css');
} catch (e) {
  // Server/test: CSS module may not be available at runtime
}

export default function FeedbackControlsIsland(
  props: Partial<FeedbackControlsContract>
) {
  const available = props.availableComponents || ['tags'];
  // map of component -> 'up' | 'down' | null
  const [stateMap, setStateMap] = useState<Record<string, string>>({});

  // refs for accessibility updates
  const refs = useRef<Record<string, { up?: HTMLButtonElement | null; down?: HTMLButtonElement | null }>>({});

  useEffect(() => {
    // reflect state on DOM as literal strings for axe
    available.forEach((c) => {
      const s = stateMap[c] || null;
      const r = refs.current[c];
      if (r && r.up) r.up.setAttribute('aria-pressed', s === 'up' ? 'true' : 'false');
      if (r && r.down) r.down.setAttribute('aria-pressed', s === 'down' ? 'true' : 'false');
    });
  }, [stateMap, available]);

  function emitFeedback(
    component: string,
    feedback_type: 'thumbs_up' | 'thumbs_down'
  ) {
    const detail: any = { component, feedback_type };
    if (props.documentId != null) detail.documentId = props.documentId;
    // updated event (legacy/consumer)
    document.dispatchEvent(new CustomEvent('feedback:updated', { detail }));
    // Publish a confirmation event for thumbs_up only
    if (feedback_type === 'thumbs_up') {
      document.dispatchEvent(
        new CustomEvent('feedback:confirmed', { detail: { component, documentId: props.documentId || null } })
      );
    }
  }

  function handleUp(component: string) {
    setStateMap((prev) => ({ ...prev, [component]: prev[component] === 'up' ? null : 'up' }));
    emitFeedback(component, 'thumbs_up');
  }

  function handleDown(component: string) {
    setStateMap((prev) => ({ ...prev, [component]: prev[component] === 'down' ? null : 'down' }));
    emitFeedback(component, 'thumbs_down');
  }

  return (
    <div
      data-testid="feedback-controls-island-root"
      role="group"
      aria-label="Feedback Controls"
      className={styles.root ?? ''}
    >
      {available.map((c) => (
        <div key={c} style={{ display: 'inline-block', marginRight: 8 }}>
          <button
            type="button"
            data-testid={`thumbs-up-${c}`}
            ref={(el) => { refs.current[c] = Object.assign(refs.current[c] || {}, { up: el }); }}
            className={`${styles.button ?? ''} ${stateMap[c] === 'up' ? styles.buttonPressed ?? '' : ''}`}
            onClick={() => { handleUp(c); }}
          >
            👍 {c}
          </button>

          <button
            type="button"
            data-testid={`thumbs-down-${c}`}
            ref={(el) => { refs.current[c] = Object.assign(refs.current[c] || {}, { down: el }); }}
            className={`${styles.button ?? ''} ${stateMap[c] === 'down' ? styles.buttonPressed ?? '' : ''}`}
            onClick={() => { handleDown(c); }}
          >
            👎 {c}
          </button>
        </div>
      ))}
    </div>
  );
}