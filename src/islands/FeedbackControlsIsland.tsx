import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import type { FeedbackControlsContract } from '../ui/contracts/FeedbackControls.contract';

export default function FeedbackControlsIsland(props: Partial<FeedbackControlsContract>) {
  useEffect(() => {
    // Mount and wire thumbs up/down handlers
  }, []);

  return (
    <div data-testid="feedback-controls-island-root">
      <!-- Feedback Controls Island (stub) -->
      <button data-testid="thumbs-up-tags">👍 Tags</button>
      <button data-testid="thumbs-down-tags">👎 Tags</button>
    </div>
  );
}
