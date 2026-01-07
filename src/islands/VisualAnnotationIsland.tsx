import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import type { VisualAnnotationContract } from '../ui/contracts/VisualAnnotation.contract';

// Minimal island stub: mounts into <div data-island="visual-annotation-island">
export default function VisualAnnotationIsland(props: Partial<VisualAnnotationContract>) {
  useEffect(() => {
    // Validate props at mount (consumer should add runtime Zod validation)
    // Placeholder mount logic: attach event listeners or initialize a canvas
    // For now the island exports a simple DOM for e2e/tests
  }, []);

  return (
    <div data-testid="visual-annotation-island-root">
      {/* Visual Annotation Island (stub) */}
      <button data-testid="draw-toggle">Draw Mode</button>
      <div data-testid="annotation-canvas">(canvas placeholder)</div>
    </div>
  );
}
