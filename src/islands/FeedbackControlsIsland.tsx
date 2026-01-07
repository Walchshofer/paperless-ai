import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { FeedbackControlsSchema, type FeedbackControlsContract } from '../ui/contracts/FeedbackControls.contract';

export default function FeedbackControlsIsland(props: Partial<FeedbackControlsContract>) {
  const [thumbsUp, setThumbsUp] = useState(false);
  const [thumbsDown, setThumbsDown] = useState(false);

  useEffect(() => {
    try {
      const result = FeedbackControlsSchema.safeParse(props);
      if (!result.success) {
        console.warn('FeedbackControlsIsland: invalid props', result.error.errors);
        return;
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.warn('FeedbackControlsIsland: validation failed', errorMessage);
      return;
    }
  }, [props]);

  function emitFeedback(component: string, feedback_type: 'thumbs_up' | 'thumbs_down') {
    const detail = { component, feedback_type };
    const ev = new CustomEvent('feedback:updated', { detail });
    document.dispatchEvent(ev);
  }

  return (
    <div data-testid="feedback-controls-island-root" role="group" aria-label="Feedback Controls">
      <button
        data-testid="thumbs-up-tags"
        aria-pressed={thumbsUp ? 'true' : 'false'}
        onClick={() => { 
          setThumbsUp(!thumbsUp); 
          setThumbsDown(false); 
          emitFeedback('tags', 'thumbs_up'); 
        }}
      >
        👍 Tags
      </button>
      <button
        data-testid="thumbs-down-tags"
        aria-pressed={thumbsDown ? 'true' : 'false'}
        onClick={() => { 
          setThumbsDown(!thumbsDown); 
          setThumbsUp(false); 
          emitFeedback('tags', 'thumbs_down'); 
        }}
      >
        👎 Tags
      </button>
    </div>
  );
}