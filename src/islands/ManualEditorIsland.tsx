import { h } from 'preact';
import { useEffect, useState, useRef } from 'preact/hooks';
import { ManualEditorSchema } from '../ui/contracts/ManualEditor.contract';
import type { ManualEditorContract } from '../ui/contracts/ManualEditor.contract';

export default function ManualEditorIsland(props: Partial<ManualEditorContract>) {
  const [active, setActive] = useState('metadata' as 'metadata'|'content'|'fields');
  const tabsRef = useRef(null as HTMLDivElement|null);
  const titleRef = useRef(null as HTMLInputElement|null);
  const contentRef = useRef(null as HTMLTextAreaElement|null);
  const fieldNameRef = useRef(null as HTMLInputElement|null);
  const fieldValueRef = useRef(null as HTMLInputElement|null);

  useEffect(() => {
    try {
      const result = ManualEditorSchema.safeParse(props);
      if (!result.success) {
        console.warn('ManualEditorIsland: invalid props', result.error.errors);
        return;
      }
    } catch (e) {
      console.warn('ManualEditorIsland: validation failed', e && (e as any).message ? (e as any).message : e);
      return;
    }
  }, [props]);

  function onKeyDown(e: KeyboardEvent) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes((e as any).key)) return;
    e.preventDefault();
    const order: Array<'metadata'|'content'|'fields'> = ['metadata','content','fields'];
    const idx = order.indexOf(active);
    if ((e as any).key === 'ArrowLeft') setActive(order[(idx+order.length-1)%order.length]);
    if ((e as any).key === 'ArrowRight') setActive(order[(idx+1)%order.length]);
    if ((e as any).key === 'Home') setActive(order[0]);
    if ((e as any).key === 'End') setActive(order[order.length-1]);
  }

  useEffect(() => {
    // Move focus to the active tab button
    try {
      const tabRoot = tabsRef.current;
      if (!tabRoot) return;
      const btn = tabRoot.querySelectorAll('[role="tab"]')[['metadata','content','fields'].indexOf(active)] as HTMLElement;
      if (btn && typeof btn.focus === 'function') btn.focus();
    } catch (e) { /* no-op */ }
  }, [active]);

  function emitPayload() {
    const payload: any = { documentId: props.documentId || null, metadata: {}, content: '', fields: [] };
    if (titleRef.current) payload.metadata.title = titleRef.current.value || '';
    if (contentRef.current) payload.content = contentRef.current.value || '';
    if (fieldNameRef.current && fieldNameRef.current.value) {
      payload.fields.push({ name: fieldNameRef.current.value, value: fieldValueRef.current ? fieldValueRef.current.value : '' });
    }
    const ev = new CustomEvent('payload:ready', { detail: payload });
    document.dispatchEvent(ev);
  }

  return (
    <div data-testid="manual-editor-island-root">
      <div role="tablist" aria-label="Manual Editor Tabs" onKeyDown={(e:any)=>onKeyDown(e)} ref={tabsRef}>
        <button
          id="tab-metadata-btn"
          role="tab"
          aria-controls="panel-metadata"
          aria-selected={active==='metadata' ? 'true' : 'false'}
          data-testid="tab-metadata"
          onClick={()=>setActive('metadata')}
        >
          Metadata
        </button>
        <button
          id="tab-content-btn"
          role="tab"
          aria-controls="panel-content"
          aria-selected={active==='content' ? 'true' : 'false'}
          data-testid="tab-content"
          onClick={()=>setActive('content')}
        >
          Content
        </button>
        <button
          id="tab-fields-btn"
          role="tab"
          aria-controls="panel-fields"
          aria-selected={active==='fields' ? 'true' : 'false'}
          data-testid="tab-fields"
          onClick={()=>setActive('fields')}
        >
          Fields
        </button>
      </div>

      <div id="panel-metadata" role="tabpanel" aria-labelledby="tab-metadata-btn" hidden={active !== 'metadata'}>
        <label>Title
          <input data-testid="manual-title-input" ref={titleRef} type="text" />
        </label>
      </div>

      <div id="panel-content" role="tabpanel" aria-labelledby="tab-content-btn" hidden={active !== 'content'}>
        {/* eslint-disable-next-line no-inline-styles */}
        <textarea data-testid="manual-content-input" ref={contentRef} rows={4} style={{ width: '100%' }} />
      </div>

      <div id="panel-fields" role="tabpanel" aria-labelledby="tab-fields-btn" hidden={active !== 'fields'}>
        <div>
          <input data-testid="field-name-0" ref={fieldNameRef} placeholder="Field name" />
          <input data-testid="field-value-0" ref={fieldValueRef} placeholder="Field value" />
        </div>
      </div>

      {/* eslint-disable-next-line no-inline-styles */}
      <div style={{ marginTop: 8 }}>
        <button type="button" data-testid="manual-save-btn" onClick={emitPayload}>Save</button>
      </div>
    </div>
  );
}
