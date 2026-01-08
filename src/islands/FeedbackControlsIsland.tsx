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

export default function FeedbackControlsIsland(props: Partial<FeedbackControlsContract>) {
  const [thumbsUp, setThumbsUp] = useState(false);
  const [thumbsDown, setThumbsDown] = useState(false);
  const upRef = useRef(null as HTMLButtonElement | null);
  const downRef = useRef(null as HTMLButtonElement | null);

  useEffect(() => {
    // Ensure aria-pressed is set as a literal string on the DOM element to satisfy Axe
    if (upRef.current) upRef.current.setAttribute('aria-pressed', thumbsUp ? 'true' : 'false');
    if (downRef.current) downRef.current.setAttribute('aria-pressed', thumbsDown ? 'true' : 'false');
  }, [thumbsUp, thumbsDown]);

  function emitFeedback(component: string, feedback_type: 'thumbs_up' | 'thumbs_down') {
    const detail = { component, feedback_type };
    document.dispatchEvent(new CustomEvent('feedback:updated', { detail }));
  }

  return (
    <div data-testid="feedback-controls-island-root" role="group" aria-label="Feedback Controls" className={styles.root ?? ''}>
      <button
        type="button"
        data-testid="thumbs-up-tags"
        ref={upRef}
        className={`${styles.button ?? ''} ${thumbsUp ? styles.buttonPressed ?? '' : ''}`}
        onClick={() => {
          const newState = !thumbsUp;
          setThumbsUp(newState);
          if (newState) setThumbsDown(false);
          emitFeedback('tags', 'thumbs_up');
        }}
      >
        👍 Tags
      </button>

      <button
        type="button"
        data-testid="thumbs-down-tags"
        ref={downRef}
        className={`${styles.button ?? ''} ${thumbsDown ? styles.buttonPressed ?? '' : ''}`}
        onClick={() => {
          const newState = !thumbsDown;
          setThumbsDown(newState);
          if (newState) setThumbsUp(false);
          emitFeedback('tags', 'thumbs_down');
        }}
      >
        👎 Tags
      </button>
    </div>
  );
}