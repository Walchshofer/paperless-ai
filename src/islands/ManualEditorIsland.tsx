import { h } from 'preact';
import { useEffect, useState, useRef } from 'preact/hooks';
import { ManualEditorSchema, type ManualEditorContract } from '../ui/contracts/ManualEditor.contract';

let styles: Record<string, string> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  styles = require('./ManualEditorIsland.module.css');
} catch (e) {
  // Server/test: CSS module may not be available at runtime
}

type TabKeys = 'metadata' | 'content' | 'fields';

export default function ManualEditorIsland(props: Partial<ManualEditorContract>) {
  // TS2347 FIX: Use 'as' for state and refs to avoid untyped function call errors
  const [active, setActive] = useState('metadata' as TabKeys);
  const tabsRef = useRef(null as HTMLDivElement | null);
  const titleRef = useRef(null as HTMLInputElement | null);
  const contentRef = useRef(null as HTMLTextAreaElement | null);
  const fieldNameRef = useRef(null as HTMLInputElement | null);
  const fieldValueRef = useRef(null as HTMLInputElement | null);

  // Schema Validation logic
  useEffect(() => {
    try {
      const result = ManualEditorSchema.safeParse(props);
      if (!result.success) {
        console.warn('ManualEditorIsland: invalid props', result.error.errors);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('ManualEditorIsland: validation failed', msg);
    }
  }, [props]);

  // Handle Keyboard Navigation within the Tab List
  const onKeyDown = (e: KeyboardEvent) => {
    const order: TabKeys[] = ['metadata', 'content', 'fields'];
    const idx = order.indexOf(active);
    let nextTab: TabKeys | null = null;

    if (e.key === 'ArrowLeft') nextTab = order[(idx + order.length - 1) % order.length];
    if (e.key === 'ArrowRight') nextTab = order[(idx + 1) % order.length];
    if (e.key === 'Home') nextTab = order[0];
    if (e.key === 'End') nextTab = order[order.length - 1];

    if (nextTab) {
      e.preventDefault();
      setActive(nextTab);
    }
  };

  // Focus management and ARIA attribute sync for tab buttons
  useEffect(() => {
    const tabRoot = tabsRef.current;
    if (!tabRoot) return;

    const buttons = tabRoot.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>;
    const order: TabKeys[] = ['metadata','content','fields'];
    const activeIdx = order.indexOf(active);

    // Sync aria-selected and tabindex as literal attributes on the DOM
    buttons.forEach((btn, idx) => {
      btn.setAttribute('aria-selected', idx === activeIdx ? 'true' : 'false');
      btn.setAttribute('tabindex', idx === activeIdx ? '0' : '-1');
    });

    // Move focus to the active tab button
    if (buttons[activeIdx]) buttons[activeIdx].focus();
  }, [active]);

  // Construct and dispatch the payload event
  const emitPayload = () => {
    const payload = {
      documentId: props.documentId || null,
      metadata: { 
        title: titleRef.current ? titleRef.current.value : '' 
      },
      content: contentRef.current ? contentRef.current.value : '',
      fields: fieldNameRef.current && fieldNameRef.current.value 
        ? [{ 
            name: fieldNameRef.current.value, 
            value: fieldValueRef.current ? fieldValueRef.current.value : '' 
          }] 
        : []
    };
    
    const ev = new CustomEvent('payload:ready', { detail: payload });
    document.dispatchEvent(ev);
  };

  return (
    <div data-testid="manual-editor-island-root" className={styles.container ?? ''}>
      
      {/* Tab List Header */}
      <div 
        role="tablist" 
        aria-label="Manual Editor Tabs" 
        onKeyDown={(e: any) => onKeyDown(e)} 
        ref={tabsRef}
        className={styles.tabs ?? ''}
      >
        {(['metadata', 'content', 'fields'] as const).map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}-btn`}
            type="button"
            role="tab"
            aria-controls={`panel-${tab}`}
            data-testid={`tab-${tab}`}
            onClick={() => setActive(tab)}
            className={`${styles.tab ?? ''} ${active === tab ? styles.tabActive ?? '' : ''}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div 
        id="panel-metadata" 
        role="tabpanel" 
        aria-labelledby="tab-metadata-btn" 
        hidden={active !== 'metadata'}
      >
        <label>
          Title
          <input data-testid="manual-title-input" ref={titleRef} type="text" />
        </label>
      </div>

      <div 
        id="panel-content" 
        role="tabpanel" 
        aria-labelledby="tab-content-btn" 
        hidden={active !== 'content'}
      >
        <textarea 
          className={styles.textarea ?? ''} 
          data-testid="manual-content-input" 
          ref={contentRef} 
          rows={4} 
        />
      </div>

      <div 
        id="panel-fields" 
        role="tabpanel" 
        aria-labelledby="tab-fields-btn" 
        hidden={active !== 'fields'}
      >

        <div>
          <input data-testid="field-name-0" ref={fieldNameRef} placeholder="Field name" />
          <input data-testid="field-value-0" ref={fieldValueRef} placeholder="Field value" />
        </div>
      </div>

      <div className={styles.save ?? ''}>
        <button type="button" data-testid="manual-save-btn" onClick={emitPayload}>
          Save
        </button>
      </div>
    </div>
  );
}