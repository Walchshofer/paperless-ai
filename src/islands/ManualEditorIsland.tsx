import { h, Fragment } from 'preact';
import { useEffect, useState, useRef, useCallback } from 'preact/hooks';
import { ManualEditorSchema, type ManualEditorContract } from '../ui/contracts/ManualEditor.contract';

type TabKeys = 'metadata' | 'content' | 'fields' | 'ai-debug';

type GpuState = 'idle' | 'checking' | 'preparing' | 'ready' | 'error';

type Field = {
  name: string;
  value: string;
};

type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

export default function ManualEditorIsland(props: Partial<ManualEditorContract>) {
  const [active, setActive] = useState<TabKeys>('metadata');
  const [gpuState, setGpuState] = useState<GpuState>('idle');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState<string>('');

  // Convert contract fields to component Field type (coerce values to strings)
  const normalizeFields = (contractFields: ManualEditorContract['fields']): Field[] => {
    if (!contractFields || contractFields.length === 0) {
      return [{ name: '', value: '' }];
    }
    return contractFields.map(f => ({
      name: f.name || '',
      value: f.value != null ? String(f.value) : '',
    }));
  };

  // Form state
  const [title, setTitle] = useState(props.metadata?.title || '');
  const [correspondent, setCorrespondent] = useState(props.metadata?.correspondent || '');
  const [documentType, setDocumentType] = useState(props.metadata?.documentType || '');
  const [content, setContent] = useState(props.content || '');
  const [fields, setFields] = useState<Field[]>(() => normalizeFields(props.fields));

  // Track initial values for diff-based feedback events
  const [initialValues] = useState({
    title: props.metadata?.title || '',
    correspondent: props.metadata?.correspondent || '',
    documentType: props.metadata?.documentType || '',
    content: props.content || '',
    fields: normalizeFields(props.fields),
  });

  // AI Debug state
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const tabsRef = useRef<HTMLDivElement | null>(null);
  const syncBadgeTimeoutRef = useRef<number | null>(null);

  // Sync ARIA states directly on the DOM nodes
  useEffect(() => {
    const tabRoot = tabsRef.current;
    if (!tabRoot) return;

    const buttons = tabRoot.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>;
    const tabOrder: TabKeys[] = ['metadata', 'content', 'fields', 'ai-debug'];

    buttons.forEach((btn, i) => {
      const isSelected = tabOrder[i] === active;
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      btn.setAttribute('tabindex', isSelected ? '0' : '-1');
    });
  }, [active]);

  // Check GPU state on mount for AI Debug tab
  useEffect(() => {
    let mounted = true;

    const checkGpu = async () => {
      setGpuState('checking');
      try {
        const res = await fetch('/api/visual-rag/health', { signal: AbortSignal.timeout(5000) });
        if (!mounted) return;

        if (res.status === 503) {
          setGpuState('preparing');
        } else if (res.ok) {
          setGpuState('ready');
        } else {
          setGpuState('error');
        }
      } catch {
        if (mounted) setGpuState('error');
      }
    };

    checkGpu();
    return () => { mounted = false; };
  }, []);

  // Clear sync badge after 5 seconds
  useEffect(() => {
    if (syncState === 'synced') {
      syncBadgeTimeoutRef.current = window.setTimeout(() => {
        setSyncState('idle');
      }, 5000);
    }
    return () => {
      if (syncBadgeTimeoutRef.current) {
        window.clearTimeout(syncBadgeTimeoutRef.current);
      }
    };
  }, [syncState]);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    const order: TabKeys[] = ['metadata', 'content', 'fields', 'ai-debug'];
    const idx = order.indexOf(active);
    let nextTab: TabKeys | null = null;

    if (e.key === 'ArrowLeft') nextTab = order[(idx + order.length - 1) % order.length];
    if (e.key === 'ArrowRight') nextTab = order[(idx + 1) % order.length];

    if (nextTab) {
      e.preventDefault();
      setActive(nextTab);
      setTimeout(() => {
        const btn = tabsRef.current?.querySelectorAll('[role="tab"]')[order.indexOf(nextTab!)] as HTMLElement;
        btn?.focus();
      }, 0);
    }
  }, [active]);

  // Add a new field row
  const addField = useCallback(() => {
    setFields(prev => [...prev, { name: '', value: '' }]);
  }, []);

  // Remove a field row
  const removeField = useCallback((index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update a field
  const updateField = useCallback((index: number, key: 'name' | 'value', val: string) => {
    setFields(prev => {
      const newFields = [...prev];
      newFields[index] = { ...newFields[index], [key]: val };
      return newFields;
    });
  }, []);

  // Aggregate payload and emit event via Hybrid SOT orchestrator
  const handleSave = useCallback(async () => {
    setSyncState('syncing');
    setSyncError('');

    const requestId = `mei-${Date.now()}`;
    const page = props.page ?? 0;

    // Build document_updates for Hybrid SOT
    const custom_fields = fields
      .filter(f => f.name.trim() !== '')
      .map(f => ({ name: f.name.trim(), value: f.value }));

    const document_updates = {
      title,
      correspondent,
      documentType,
      content,
      custom_fields,
    };

    // Generate feedback_events by diffing against initial values
    const feedback_events: Array<{
      event_type: string;
      field_name: string;
      original_value: string;
      corrected_value: string;
      context: { page: number; request_id: string };
    }> = [];

    if (title !== initialValues.title) {
      feedback_events.push({
        event_type: 'correction',
        field_name: 'title',
        original_value: initialValues.title,
        corrected_value: title,
        context: { page, request_id: requestId },
      });
    }

    if (correspondent !== initialValues.correspondent) {
      feedback_events.push({
        event_type: 'correction',
        field_name: 'correspondent',
        original_value: initialValues.correspondent,
        corrected_value: correspondent,
        context: { page, request_id: requestId },
      });
    }

    if (documentType !== initialValues.documentType) {
      feedback_events.push({
        event_type: 'correction',
        field_name: 'documentType',
        original_value: initialValues.documentType,
        corrected_value: documentType,
        context: { page, request_id: requestId },
      });
    }

    if (content !== initialValues.content) {
      feedback_events.push({
        event_type: 'correction',
        field_name: 'content',
        original_value: initialValues.content.substring(0, 500), // Truncate for payload size
        corrected_value: content.substring(0, 500),
        context: { page, request_id: requestId },
      });
    }

    // Check custom fields for changes
    const initialFieldMap = new Map<string, string>(initialValues.fields.map(f => [f.name, f.value] as [string, string]));
    for (const field of custom_fields) {
      const originalValue = initialFieldMap.get(field.name) || '';
      if (field.value !== originalValue) {
        feedback_events.push({
          event_type: 'correction',
          field_name: `custom_field:${field.name}`,
          original_value: originalValue,
          corrected_value: field.value,
          context: { page, request_id: requestId },
        });
      }
    }

    const payload = {
      documentId: props.documentId ?? null,
      document_updates,
      feedback_events,
      transactional: true,
    };

    const metadata = {
      title,
      correspondent,
      documentType,
    };

    const eventDetail = {
      type: 'payload:ready',
      documentId: props.documentId ?? null,
      page,
      metadata,
      content,
      fields: custom_fields,
      timestamp: Date.now(),
    };

    // Dispatch payload:ready event for cross-island communication
    document.dispatchEvent(new CustomEvent('payload:ready', { detail: eventDetail }));

    try {
      // Hybrid SOT orchestrator endpoint
      const res = await fetch('/manual/updateDocument', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        setSyncState('synced');
        document.dispatchEvent(new CustomEvent('sync:success', {
          detail: { documentId: props.documentId, ...result }
        }));
      } else {
        const errorData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(errorData.message || `Sync failed with status ${res.status}`);
      }
    } catch (err: any) {
      setSyncState('error');
      setSyncError(err.message || 'Sync failed');
      document.dispatchEvent(new CustomEvent('sync:failed', {
        detail: { documentId: props.documentId, error: err.message }
      }));
    }
  }, [props.documentId, props.page, title, correspondent, documentType, content, fields, initialValues]);

  // Fetch AI analysis
  const runAiAnalysis = useCallback(async () => {
    if (gpuState !== 'ready') return;

    setAiLoading(true);
    setAiResponse(null);

    try {
      const res = await fetch('/manual/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.substring(0, 50000),
          id: props.documentId,
        }),
      });

      const data = await res.json();
      setAiResponse(data);
    } catch (err: any) {
      setAiResponse({ error: err.message });
    } finally {
      setAiLoading(false);
    }
  }, [gpuState, content, props.documentId]);

  return (
    <div data-testid="manual-editor-island-root" className="mei-root">
      {/* Sync Badge */}
      {syncState !== 'idle' && (
        <div
          className={`mei-sync-badge mei-sync-${syncState}`}
          data-testid="sync-badge"
          role="status"
          aria-live="polite"
        >
          {syncState === 'syncing' && '⏳ Syncing...'}
          {syncState === 'synced' && '✓ Synced'}
          {syncState === 'error' && `⚠️ ${syncError || 'Sync failed'}`}
        </div>
      )}

      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Manual Editor Tabs"
        onKeyDown={onKeyDown as any}
        ref={tabsRef}
        className="mei-tablist"
      >
        <button
          id="tab-metadata-btn"
          type="button"
          role="tab"
          aria-controls="panel-metadata"
          data-testid="tab-metadata"
          onClick={() => setActive('metadata')}
          className={`mei-tab ${active === 'metadata' ? 'mei-tab-active' : ''}`}
        >
          Metadata
        </button>
        <button
          id="tab-content-btn"
          type="button"
          role="tab"
          aria-controls="panel-content"
          data-testid="tab-content"
          onClick={() => setActive('content')}
          className={`mei-tab ${active === 'content' ? 'mei-tab-active' : ''}`}
        >
          Content
        </button>
        <button
          id="tab-fields-btn"
          type="button"
          role="tab"
          aria-controls="panel-fields"
          data-testid="tab-fields"
          onClick={() => setActive('fields')}
          className={`mei-tab ${active === 'fields' ? 'mei-tab-active' : ''}`}
        >
          Fields
        </button>
        <button
          id="tab-ai-debug-btn"
          type="button"
          role="tab"
          aria-controls="panel-ai-debug"
          data-testid="tab-ai-debug"
          onClick={() => setActive('ai-debug')}
          className={`mei-tab ${active === 'ai-debug' ? 'mei-tab-active' : ''}`}
        >
          AI Debug
          {gpuState === 'preparing' && <span className="mei-gpu-badge">⏳</span>}
          {gpuState === 'ready' && <span className="mei-gpu-badge mei-gpu-ready">✓</span>}
          {gpuState === 'error' && <span className="mei-gpu-badge mei-gpu-error">⚠️</span>}
        </button>
      </div>

      {/* Tab Panels */}
      <div className="mei-panels">
        {/* Metadata Panel */}
        <div
          id="panel-metadata"
          role="tabpanel"
          aria-labelledby="tab-metadata-btn"
          data-panel="metadata"
          className={`mei-panel ${active === 'metadata' ? '' : 'mei-panel-hidden'}`}
          data-testid="panel-metadata"
        >
          <div className="mei-field-group">
            <label htmlFor="mei-title" className="mei-label">Title</label>
            <input
              id="mei-title"
              data-testid="manual-title-input"
              type="text"
              value={title}
              onInput={(e: any) => setTitle(e.target.value)}
              className="mei-input"
            />
          </div>
          <div className="mei-field-group">
            <label htmlFor="mei-correspondent" className="mei-label">Correspondent</label>
            <input
              id="mei-correspondent"
              data-testid="manual-correspondent-input"
              type="text"
              value={correspondent}
              onInput={(e: any) => setCorrespondent(e.target.value)}
              className="mei-input"
            />
          </div>
          <div className="mei-field-group">
            <label htmlFor="mei-doctype" className="mei-label">Document Type</label>
            <input
              id="mei-doctype"
              data-testid="manual-doctype-input"
              type="text"
              value={documentType}
              onInput={(e: any) => setDocumentType(e.target.value)}
              className="mei-input"
            />
          </div>
        </div>

        {/* Content Panel */}
        <div
          id="panel-content"
          role="tabpanel"
          aria-labelledby="tab-content-btn"
          data-panel="content"
          className={`mei-panel ${active === 'content' ? '' : 'mei-panel-hidden'}`}
          data-testid="panel-content"
        >
          <label htmlFor="mei-content" className="mei-label">Document Content</label>
          <textarea
            id="mei-content"
            data-testid="manual-content-input"
            rows={10}
            value={content}
            onInput={(e: any) => setContent(e.target.value)}
            className="mei-textarea"
          />
        </div>

        {/* Fields Panel */}
        <div
          id="panel-fields"
          role="tabpanel"
          aria-labelledby="tab-fields-btn"
          data-panel="fields"
          className={`mei-panel ${active === 'fields' ? '' : 'mei-panel-hidden'}`}
          data-testid="panel-fields"
        >
          <div className="mei-fields-header">
            <span className="mei-label">Custom Fields</span>
            <button
              type="button"
              onClick={addField}
              className="mei-btn mei-btn-add"
              data-testid="add-field-btn"
            >
              + Add Field
            </button>
          </div>
          {fields.map((field, i) => (
            <div key={i} className="mei-field-row">
              <input
                data-testid={`field-name-${i}`}
                placeholder="Field name"
                value={field.name}
                onInput={(e: any) => updateField(i, 'name', e.target.value)}
                className="mei-input mei-field-name"
              />
              <input
                data-testid={`field-value-${i}`}
                placeholder="Field value"
                value={field.value}
                onInput={(e: any) => updateField(i, 'value', e.target.value)}
                className="mei-input mei-field-value"
              />
              <button
                type="button"
                onClick={() => removeField(i)}
                className="mei-btn mei-btn-remove"
                data-testid={`remove-field-${i}`}
                aria-label={`Remove field ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* AI Debug Panel */}
        <div
          id="panel-ai-debug"
          role="tabpanel"
          aria-labelledby="tab-ai-debug-btn"
          data-panel="ai-debug"
          className={`mei-panel ${active === 'ai-debug' ? '' : 'mei-panel-hidden'}`}
          data-testid="panel-ai-debug"
        >
          {/* 503 Handler UI */}
          {gpuState === 'preparing' && (
            <div className="mei-gpu-preparing" data-testid="gpu-preparing-status">
              <div className="mei-spinner" />
              <p>GPU Preparing (Warmup)...</p>
              <p className="mei-gpu-hint">Visual analysis features will be available shortly.</p>
            </div>
          )}

          {gpuState === 'error' && (
            <div className="mei-gpu-error-box" data-testid="gpu-error-status">
              <p>⚠️ Visual Analysis Unavailable</p>
              <p className="mei-gpu-hint">The GPU sidecar is not responding.</p>
            </div>
          )}

          {gpuState === 'ready' && (
            <div className="mei-ai-debug-content">
              <button
                type="button"
                onClick={runAiAnalysis}
                disabled={aiLoading}
                className="mei-btn mei-btn-primary"
                data-testid="run-ai-analysis-btn"
              >
                {aiLoading ? 'Analyzing...' : 'Run AI Analysis'}
              </button>

              {aiResponse && (
                <div className="mei-ai-response" data-testid="ai-response">
                  <h4>AI Response</h4>
                  <pre className="mei-ai-json">
                    {JSON.stringify(aiResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {gpuState === 'checking' && (
            <div className="mei-gpu-checking">
              <div className="mei-spinner" />
              <p>Checking GPU status...</p>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="mei-actions">
        <button
          data-testid="manual-save-btn"
          type="button"
          onClick={handleSave}
          className="mei-btn mei-btn-save"
          disabled={syncState === 'syncing'}
        >
          {syncState === 'syncing' ? 'Saving...' : 'Save'}
        </button>
      </div>

      <style>{`
        .mei-root {
          font-family: system-ui, -apple-system, sans-serif;
          position: relative;
        }
        .mei-sync-badge {
          position: absolute;
          top: -8px;
          right: 0;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
          animation: mei-fade-in 0.3s ease;
        }
        .mei-sync-syncing { background: #fff3cd; color: #856404; }
        .mei-sync-synced { background: #d4edda; color: #155724; }
        .mei-sync-error { background: #f8d7da; color: #721c24; }

        .mei-tablist {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 8px;
        }
        .mei-tab {
          padding: 8px 16px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.9rem;
          border-radius: 4px 4px 0 0;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .mei-tab:hover { background: #f5f5f5; }
        .mei-tab-active {
          background: #3498db;
          color: white;
        }
        .mei-gpu-badge {
          font-size: 0.75rem;
        }
        .mei-gpu-ready { color: #27ae60; }
        .mei-gpu-error { color: #e74c3c; }

        .mei-panels { min-height: 200px; }
        .mei-panel { padding: 16px 0; }
        .mei-panel-hidden { display: none; }

        .mei-field-group { margin-bottom: 16px; }
        .mei-label {
          display: block;
          font-weight: 500;
          margin-bottom: 4px;
          color: #333;
          font-size: 0.9rem;
        }
        .mei-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
          box-sizing: border-box;
        }
        .mei-input:focus {
          outline: none;
          border-color: #3498db;
        }
        .mei-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
          resize: vertical;
          font-family: monospace;
          box-sizing: border-box;
        }
        .mei-textarea:focus {
          outline: none;
          border-color: #3498db;
        }

        .mei-fields-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .mei-field-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }
        .mei-field-name { flex: 1; }
        .mei-field-value { flex: 2; }

        .mei-btn {
          padding: 8px 16px;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        .mei-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .mei-btn-add {
          background: #f8f9fa;
        }
        .mei-btn-add:hover { background: #e9ecef; }
        .mei-btn-remove {
          background: #e74c3c;
          color: white;
          border-color: #e74c3c;
          padding: 8px 12px;
        }
        .mei-btn-remove:hover { background: #c0392b; }
        .mei-btn-primary {
          background: #3498db;
          color: white;
          border-color: #3498db;
        }
        .mei-btn-primary:hover:not(:disabled) { background: #2980b9; }
        .mei-btn-save {
          background: #27ae60;
          color: white;
          border-color: #27ae60;
          min-width: 100px;
        }
        .mei-btn-save:hover:not(:disabled) { background: #219a52; }

        .mei-actions {
          margin-top: 16px;
          display: flex;
          justify-content: flex-end;
        }

        /* AI Debug Panel */
        .mei-gpu-preparing,
        .mei-gpu-checking,
        .mei-gpu-error-box {
          text-align: center;
          padding: 32px;
          color: #666;
        }
        .mei-gpu-error-box {
          background: #fff3f3;
          border: 1px solid #e74c3c;
          border-radius: 8px;
          color: #c0392b;
        }
        .mei-gpu-hint {
          font-size: 0.85rem;
          color: #888;
          margin-top: 8px;
        }
        .mei-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e0e0e0;
          border-top-color: #3498db;
          border-radius: 50%;
          animation: mei-spin 1s linear infinite;
          margin: 0 auto 12px;
        }
        .mei-ai-debug-content { padding: 8px 0; }
        .mei-ai-response {
          margin-top: 16px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 4px;
        }
        .mei-ai-response h4 {
          margin: 0 0 8px;
          font-size: 0.9rem;
        }
        .mei-ai-json {
          background: #2d2d2d;
          color: #f8f8f2;
          padding: 12px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 0.8rem;
          max-height: 300px;
          overflow-y: auto;
        }

        @keyframes mei-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes mei-fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
