import { h } from 'preact';
import { useEffect, useState, useRef } from 'preact/hooks';
import { ManualEditorSchema, type ManualEditorContract } from '../ui/contracts/ManualEditor.contract';

type TabKeys = 'metadata' | 'content' | 'fields';

export default function ManualEditorIsland(props: Partial<ManualEditorContract>) {
  const [active, setActive] = useState('metadata' as TabKeys);
  const tabsRef = useRef(null as HTMLDivElement | null);
  const titleRef = useRef(null as HTMLInputElement | null);
  const contentRef = useRef(null as HTMLTextAreaElement | null);
  const fieldNameRef = useRef(null as HTMLInputElement | null);
  const fieldValueRef = useRef(null as HTMLInputElement | null);

  // Sync ARIA states directly on the DOM nodes
  // This removes the {expression} from JSX that Edge Tools flags as invalid
  useEffect(() => {
    const tabRoot = tabsRef.current;
    if (!tabRoot) return;

    const buttons = tabRoot.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>;
    const tabOrder: TabKeys[] = ['metadata', 'content', 'fields'];

    buttons.forEach((btn, i) => {
      const isSelected = tabOrder[i] === active;
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      btn.setAttribute('tabindex', isSelected ? '0' : '-1');
    });
  }, [active]);

  const onKeyDown = (e: KeyboardEvent) => {
    const order: TabKeys[] = ['metadata', 'content', 'fields'];
    const idx = order.indexOf(active);
    let nextTab: TabKeys | null = null;

    if (e.key === 'ArrowLeft') nextTab = order[(idx + order.length - 1) % order.length];
    if (e.key === 'ArrowRight') nextTab = order[(idx + 1) % order.length];
    
    if (nextTab) {
      e.preventDefault();
      setActive(nextTab);
      // Auto-focus the active button after the state update
      setTimeout(() => {
        const btn = tabsRef.current?.querySelectorAll('[role="tab"]')[order.indexOf(nextTab!)] as HTMLElement;
        btn?.focus();
      }, 0);
    }
  };

  return (
    <div data-testid="manual-editor-island-root" className="manual-editor">
      <div role="tablist" aria-label="Manual Editor Tabs" onKeyDown={(e: any) => onKeyDown(e)} ref={tabsRef}>
        <button id="tab-metadata-btn" type="button" role="tab" aria-controls="panel-metadata" data-testid="tab-metadata" onClick={() => setActive('metadata')}>Metadata</button>
        <button id="tab-content-btn" type="button" role="tab" aria-controls="panel-content" data-testid="tab-content" onClick={() => setActive('content')}>Content</button>
        <button id="tab-fields-btn" type="button" role="tab" aria-controls="panel-fields" data-testid="tab-fields" onClick={() => setActive('fields')}>Fields</button>
      </div>
      {/* ... panels ... */}
    </div>
  );
}