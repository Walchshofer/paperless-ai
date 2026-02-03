import { h } from 'preact';
import { useEffect, useState, useRef, useCallback } from 'preact/hooks';
import type { VisualAnnotationContract } from '../ui/contracts/VisualAnnotation.contract';

type Annotation = {
  id?: number;
  label: string;
  note: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confirmed?: boolean;
  context?: {
    correspondentId?: number | null;
    tagIds?: number[];
    page?: number;
    documentTypeId?: number | null;
    metadata?: Record<string, unknown>;
  };
};

/** Shape of annotation data from API or props */
interface AnnotationInput {
  id?: number;
  label?: string;
  note?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  bbox?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  context?: {
    correspondentId?: number | null;
    tagIds?: number[];
    page?: number;
    documentTypeId?: number | null;
  };
}

/** Shape of created annotation from save API */
interface CreatedAnnotation {
  id?: number;
  label?: string;
  note?: string;
  bbox?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } | number[];
  context?: {
    correspondentId?: number | null;
    tagIds?: number[];
    page?: number;
    documentTypeId?: number | null;
  };
}

type GpuState = 'idle' | 'checking' | 'preparing' | 'ready' | 'error';

// Exponential backoff config
const INITIAL_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 5000;
const HANDSHAKE_TIMEOUT_MS = 5000;
const MAX_RETRIES = 10;

declare global {
  interface Window {
    __visual_annotation_dirty?: boolean;
  }
}

export default function VisualAnnotationIsland(props: Partial<VisualAnnotationContract>) {
  const [status, setStatus] = useState('idle' as GpuState);
  const [annotations, setAnnotations] = useState([] as Annotation[]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [liveRect, setLiveRect] = useState(null as {x: number, y: number, w: number, h: number} | null);
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  // Retry nonce: incrementing this triggers the handshake effect to re-run
  const [retryNonce, setRetryNonce] = useState(0);
  // Initialize from props.annotations (when server provides saved annotations)
  useEffect(() => {
    if (props.annotations && Array.isArray(props.annotations)) {
      try {
        const mapped = (props.annotations as AnnotationInput[]).map((a: AnnotationInput) => ({
          id: a.id,
          label: a.label || '',
          note: a.note || '',
          x: Number(a.bbox?.x ?? a.x ?? 0),
          y: Number(a.bbox?.y ?? a.y ?? 0),
          width: Number(a.bbox?.width ?? a.width ?? 0),
          height: Number(a.bbox?.height ?? a.height ?? 0),
          confirmed: true,
          context: a.context || undefined
        }));
        // debug log to help tests - removed once tests stable

        console.debug && console.debug('VisualAnnotationIsland init annotations', mapped);
        setAnnotations(mapped as Annotation[]);
      } catch (_err: unknown) { /* ignore */ }
    }
  }, [props.annotations]);

  // If the server provides persistence, load saved annotations for the current document/page
  useEffect(() => {
    let aborted = false;
    async function loadSaved() {
      if (!props.documentId) return;
      try {
        const pageQuery = (props.page !== undefined && props.page !== null) ? `?page=${props.page}` : '';
        const resp = await fetch(`/api/annotations/${props.documentId}${pageQuery}`, { headers: { 'X-Request-Id': `load-annotations-${Date.now()}` } });
        if (aborted) return;
        if (resp.status === 401) {
          // not authenticated - nothing to load for this user
          console.warn('Annotations: authentication required to load annotations');
          return;
        }
        if (!resp.ok) throw new Error(`Failed to load annotations: ${resp.status}`);
        const json = await resp.json();
        const anns: AnnotationInput[] = Array.isArray(json.annotations) ? json.annotations : [];
        const mapped = anns.map((a: AnnotationInput) => ({
          id: a.id,
          label: a.label || '',
          note: a.note || '',
          x: Number(a.bbox?.x ?? a.x ?? 0),
          y: Number(a.bbox?.y ?? a.y ?? 0),
          width: Number(a.bbox?.width ?? a.width ?? 0),
          height: Number(a.bbox?.height ?? a.height ?? 0),
          confirmed: true,
          context: a.context || undefined
        }));
        setAnnotations(mapped as Annotation[]);
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : String(err);
        console.error('Failed to load annotations:', msg);
      }
    }

    loadSaved();
    return () => { aborted = true; };
  }, [props.documentId, props.page]);

  // Listen for annotations loaded events from other islands (OverlayViewerIsland)
  useEffect(() => {
    const handler = (e: Event) => {
      const anns = (e as CustomEvent)?.detail?.annotations;
      if (!Array.isArray(anns)) return;
      const mapped = (anns as AnnotationInput[]).map((a: AnnotationInput) => ({
        id: a.id,
        label: a.label || '',
        note: a.note || '',
        x: Number(a.bbox?.x ?? a.x ?? 0),
        y: Number(a.bbox?.y ?? a.y ?? 0),
        width: Number(a.bbox?.width ?? a.width ?? 0),
        height: Number(a.bbox?.height ?? a.height ?? 0),
        confirmed: true,
        context: a.context || undefined
      }));
      setAnnotations(mapped as Annotation[]);
    };

    document.addEventListener('annotations:loaded', handler as EventListener);
    return () => document.removeEventListener('annotations:loaded', handler as EventListener);
  }, []);
  const canvasRef = useRef(null as HTMLDivElement | null);
  const startRef = useRef(null as {x: number, y: number} | null);
  const mountedRef = useRef(true);
  const drawToggleRef = useRef(null as HTMLButtonElement | null);
  const liveRectElRef = useRef(null as HTMLDivElement | null);

  // Calculate exponential backoff delay
  const getBackoffDelay = useCallback((attempt: number) => {
    const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
    return Math.min(delay, MAX_BACKOFF_MS);
  }, []);

  // Sidecar health check function - extracted for reuse
  const checkSidecar = useCallback(async (retryAttemptRef: { current: number }) => {
    if (!mountedRef.current) return;

    setStatus('checking');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HANDSHAKE_TIMEOUT_MS);

    try {
      const res = await fetch('/api/visual-rag/health', {
        signal: controller.signal,
        headers: { 'X-Request-Id': `handshake-${Date.now()}` }
      });
      clearTimeout(timeoutId);

      if (!mountedRef.current) return;

      if (res.status === 503) {
        // Sidecar initializing - show preparing state
        setStatus('preparing');
        retryAttemptRef.current++;
        setRetryCount(retryAttemptRef.current);

        if (retryAttemptRef.current < MAX_RETRIES) {
          const delay = getBackoffDelay(retryAttemptRef.current);
          setTimeout(() => mountedRef.current && checkSidecar(retryAttemptRef), delay);
        } else {
          setStatus('error');
          setErrorMessage('GPU warmup timed out after maximum retries');
        }
        return;
      }

      if (res.ok) {
        setStatus('ready');
        setRetryCount(0);
        setErrorMessage('');
      } else {
        setStatus('error');
        setErrorMessage(`Sidecar returned status ${res.status}`);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (!mountedRef.current) return;

      retryAttemptRef.current++;
      setRetryCount(retryAttemptRef.current);

      if (retryAttemptRef.current < MAX_RETRIES) {
        setStatus('preparing');
        const delay = getBackoffDelay(retryAttemptRef.current);
        setTimeout(() => mountedRef.current && checkSidecar(retryAttemptRef), delay);
      } else {
        setStatus('error');
        const name = (err && typeof err === 'object' && 'name' in err) ? (err as Error).name : undefined;
        const message = (err && typeof err === 'object' && 'message' in err) ? (err as Error).message : String(err);
        setErrorMessage(name === 'AbortError' ? 'Connection timeout' : message);
      }
    }
  }, [getBackoffDelay]);

  // 1. Handshake & 503 Handling with exponential backoff
  // Re-runs when retryNonce changes (user clicks Retry button)
  useEffect(() => {
    mountedRef.current = true;
    const retryAttemptRef = { current: 0 };

    checkSidecar(retryAttemptRef);

    return () => { mountedRef.current = false; };
  }, [checkSidecar, retryNonce]);

  // 2. Canvas Interaction Logic
  // Keep the aria-pressed attribute as a string token for accessibility tools
  useEffect(() => {
    if (drawToggleRef.current) {
      drawToggleRef.current.setAttribute('aria-pressed', isDrawing ? 'true' : 'false');
    }
  }, [isDrawing]);

  const getLocalCoords = (evt: MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      w: rect.width,
      h: rect.height
    };
  }; 

  const handleMouseDown = (e: MouseEvent) => {
    if (!isDrawing || status !== 'ready') return;
    e.preventDefault();
    const { x, y } = getLocalCoords(e);
    startRef.current = { x, y };
    setLiveRect({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDrawing || !startRef.current || !liveRect) return;
    const { x, y } = getLocalCoords(e);
    const left = Math.min(startRef.current.x, x);
    const top = Math.min(startRef.current.y, y);
    const width = Math.abs(x - startRef.current.x);
    const height = Math.abs(y - startRef.current.y);
    setLiveRect({ x: left, y: top, w: width, h: height });
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isDrawing || !startRef.current || !liveRect) return;
    const { x, y, w: cw, h: ch } = getLocalCoords(e);
    const left = Math.min(startRef.current.x, x);
    const top = Math.min(startRef.current.y, y);
    const width = Math.abs(x - startRef.current.x);
    const height = Math.abs(y - startRef.current.y);

    // Normalize
    const nx = left / cw;
    const ny = top / ch;
    const nw = width / cw;
    const nh = height / ch;

    setAnnotations((prev: Annotation[]) => [...prev, { label: '', note: '', x: nx, y: ny, width: nw, height: nh }]);
    setLiveRect(null);
    startRef.current = null;
  };

  // Keep live-rect CSS variables in sync when liveRect changes
  useEffect(() => {
    const el = liveRectElRef.current;
    if (!el || !liveRect) return;
    el.style.setProperty('--vai-x', `${liveRect.x}px`);
    el.style.setProperty('--vai-y', `${liveRect.y}px`);
    el.style.setProperty('--vai-w', `${liveRect.w}px`);
    el.style.setProperty('--vai-h', `${liveRect.h}px`);
  }, [liveRect]);

  // 3. Actions
  const handleConfirm = async (index: number) => {
    const ann = annotations[index];
    try {
      // Build bbox in [y1, x1, y2, x2] normalized format for the API
      const bbox = [ann.y, ann.x, ann.y + ann.height, ann.x + ann.width];

      // Trigger Hybrid SOT update with correct payload structure
      // API expects: { documentId, events: [{ event_type, field_name, corrected_value, context }] }
      await fetch('/api/visual-rag/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': `annotation-confirm-${Date.now()}`
        },
        body: JSON.stringify({
          documentId: props.documentId ? Number(props.documentId) : null,
          events: [{
            event_type: 'annotation',
            field_name: ann.label || 'visual_annotation',
            corrected_value: {
              label: ann.label,
              text: ann.note || '',
              bbox,
              confidence: 1.0  // User confirmed, so full confidence
            },
            context: {
              request_id: `annotation-confirm-${Date.now()}`,
              page: props.page ?? 0,
              bbox,
              label: ann.label,
              note: ann.note,
              correspondentId: ann.context?.correspondentId ?? null,
              tagIds: ann.context?.tagIds ?? [],
              documentTypeId: ann.context?.documentTypeId ?? null
            }
          }]
        })
      });

      const newAnns = [...annotations];
      newAnns[index].confirmed = true;
      setAnnotations(newAnns);

      document.dispatchEvent(new CustomEvent('feedback:confirmed', {
        detail: {
          ...ann,
          documentId: props.documentId,
          page: props.page,
          bbox
        }
      }));
    } catch (e) {
      console.error('Failed to confirm match', e);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);

  // Mirror dirty state for coordinator to query
  useEffect(() => {
    try { window.__visual_annotation_dirty = annotations.length > 0; } catch (_err) { /* ignore */ }
  }, [annotations]);

  // Save helper returns result so coordinator can react
  const handleSave = async (): Promise<{ success: boolean; message?: string }> => {
    setIsSaving(true);
    setSaveError('');
    const payload = {
      documentId: props.documentId || null,
      page: props.page || null,
      annotations: annotations.map((a: Annotation) => ({ bbox: { x: a.x, y: a.y, width: a.width, height: a.height }, label: a.label, note: a.note }))
    };

    try {
      const resp = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': `save-annotations-${Date.now()}` },
        body: JSON.stringify(payload)
      });

      if (resp.status === 401) {
        setSaveError('Authentication required to save annotations');
        setNeedsAuth(true);
        setIsSaving(false);
        return { success: false, message: 'auth required' };
      }

      if (!resp.ok) throw new Error(`Save failed (${resp.status})`);

      const json = await resp.json();
      const created = Array.isArray(json.created) ? json.created : [];

      // Merge returned created annotations (with ids) into local annotations by matching bbox
      const findMatch = (local: Annotation, c: CreatedAnnotation) => {
        const cb = c.bbox || { x: 0, y: 0, width: 0, height: 0 };
        let cx: number, cy: number, cwidth: number, cheight: number;
        if (Array.isArray(cb)) {
          // bbox is [y1, x1, y2, x2] format
          cx = Number(cb[1] ?? 0);
          cy = Number(cb[0] ?? 0);
          cwidth = Number((cb[3] ?? 0) - (cb[1] ?? 0));
          cheight = Number((cb[2] ?? 0) - (cb[0] ?? 0));
        } else {
          cx = Number(cb.x ?? 0);
          cy = Number(cb.y ?? 0);
          cwidth = Number(cb.width ?? 0);
          cheight = Number(cb.height ?? 0);
        }
        return Math.abs(local.x - cx) < 0.001 && Math.abs(local.y - cy) < 0.001 && Math.abs(local.width - cwidth) < 0.001 && Math.abs(local.height - cheight) < 0.001;
      };

      const newAnns = annotations.map((local: Annotation) => {
        const found = (created as CreatedAnnotation[]).find((c: CreatedAnnotation) => findMatch(local, c));
        if (found) {
          const foundBbox = found.bbox;
          let bboxX: number | undefined, bboxY: number | undefined, bboxWidth: number | undefined, bboxHeight: number | undefined;
          if (foundBbox && !Array.isArray(foundBbox)) {
            bboxX = foundBbox.x;
            bboxY = foundBbox.y;
            bboxWidth = foundBbox.width;
            bboxHeight = foundBbox.height;
          }
          return {
            id: found.id,
            label: local.label,
            note: local.note,
            x: Number(bboxX ?? local.x),
            y: Number(bboxY ?? local.y),
            width: Number(bboxWidth ?? local.width),
            height: Number(bboxHeight ?? local.height),
            confirmed: true,
            context: found.context || local.context
          } as Annotation;
        }
        return local;
      });

      setAnnotations(newAnns);

      // keep legacy event for other islands
      document.dispatchEvent(new CustomEvent('payload:ready', { detail: payload }));

      // Success
      try { window.__visual_annotation_dirty = false; } catch (_err) { /* ignore */ }
      return { success: true };
    } catch (err: unknown) {
      const msg = (err && typeof err === 'object' && 'message' in err) ? (err as Error).message : String(err);
      console.error('Failed to save annotations:', msg);
      setSaveError(msg || 'Failed to save annotations');
      return { success: false, message: String(msg) };
    } finally {
      setIsSaving(false);
    }
  };

  // Export annotations handler
  const handleExportAnnotations = useCallback(() => {
    if (annotations.length === 0 || !documentId) return;
    
    // Dispatch export event
    const event = new CustomEvent('export:annotations-requested', {
      detail: {
        documentId,
        annotations,
        format: 'json'
      }
    });
    
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(event);
    }
  }, [annotations, documentId]);

  // Listen for workspace save requests and participate
  useEffect(() => {
    type SaveRequestDetail = { saveId?: string; documentId?: number | null };

    async function onSaveRequest(e: Event) {
      const detail = (e as CustomEvent<SaveRequestDetail>)?.detail || {};
      const { saveId, documentId } = detail;
      if (String(documentId) !== String(props.documentId)) return;
      const participantId = 'visual-annotation';
      const willSave = annotations.length > 0;
      window.dispatchEvent(new CustomEvent('workspace:save-ack', { detail: { saveId, participantId, willSave } }));
      if (!willSave) return;
      const result = await handleSave();
      window.dispatchEvent(new CustomEvent('workspace:save-partial-complete', { detail: { saveId, participantId, success: Boolean(result.success), message: result.message } }));
    }

    window.addEventListener('workspace:save-request', onSaveRequest as EventListener);
    return () => window.removeEventListener('workspace:save-request', onSaveRequest as EventListener);
  }, [annotations, props.documentId]);

  // Retry handler for error state - increments nonce to trigger useEffect re-run
  const handleRetry = useCallback(() => {
    setStatus('idle');
    setRetryCount(0);
    setErrorMessage('');
    mountedRef.current = true;
    // Increment nonce to trigger the handshake effect to re-run
    setRetryNonce((n: number) => n + 1);
  }, []);

  return (
    <div data-testid="visual-annotation-island-root" data-hydrated="true">
      {/* Full-page blocking modal for GPU Preparing state */}
      {(status === 'preparing' || status === 'checking') && (
        <div
          className="vai-fullpage-modal"
          data-testid="gpu-preparing-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gpu-modal-title"
        >
          <div className="vai-modal-content">
            <div className="vai-modal-spinner" />
            <h2 id="gpu-modal-title" className="vai-modal-title">
              GPU Preparing (Warmup)
            </h2>
            <p className="vai-modal-text">
              The visual analysis system is initializing...
            </p>
            {retryCount > 0 && (
              <p className="vai-modal-retry" data-testid="retry-count">
                Retry attempt {retryCount}/{MAX_RETRIES}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error modal */}
      {status === 'error' && (
        <div
          className="vai-error-modal"
          data-testid="gpu-error-modal"
          role="alertdialog"
          aria-labelledby="error-modal-title"
        >
          <div className="vai-modal-content vai-error-content">
            <div className="vai-error-icon">⚠️</div>
            <h2 id="error-modal-title" className="vai-modal-title">
              Visual Analysis Unavailable
            </h2>
            <p className="vai-modal-text">
              {errorMessage || 'Could not connect to the visual analysis service.'}
            </p>
            <button
              className="vai-retry-btn"
              onClick={handleRetry}
              data-testid="retry-button"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      <div className="vai-controls">
        <button
          ref={drawToggleRef}
          data-testid="draw-toggle"
          onClick={() => setIsDrawing(!isDrawing)}
          aria-pressed="false"
          disabled={status !== 'ready'}
          className={`vai-btn ${isDrawing ? 'vai-btn-active' : ''}`}
        >
          {isDrawing ? 'Drawing: ON' : 'Draw Mode'}
        </button>
        <button
          data-testid="save-annotations"
          onClick={handleSave}
          className="vai-btn vai-btn-primary"
          disabled={status !== 'ready' || annotations.length === 0 || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Annotations'}
        </button>
        <button
          data-testid="export-annotations"
          onClick={handleExportAnnotations}
          className="vai-btn"
          disabled={status !== 'ready' || annotations.length === 0}
          title="Export all annotations as JSON"
        >
          <i className="fas fa-download mr-1"></i>
          Export ({annotations.length})
        </button>
        {saveError && (
          <div className="flex items-center gap-2 ml-2">
            <div data-testid="annotation-save-error" className="vai-save-error text-red-600" role="alert">
              {saveError}
            </div>
            {needsAuth && (
              <button
                data-testid="annotation-login-btn"
                className="vai-btn"
                onClick={() => {
                  try {
                    document.dispatchEvent(new CustomEvent('auth:required', { detail: { redirect: window && window.location && window.location.pathname ? window.location.pathname : null } }));
                  } catch (e) {
                    // fallback: navigate directly if environment allows
                    try { if (window && window.location) window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; } catch (e) {}
                  }
                }}
              >
                Login to Save
              </button>
            )}
          </div>
        )}
        <div data-testid="annotation-status" className="vai-status" aria-live="polite">
          {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
        </div>
        {status === 'ready' && (
          <span className="vai-ready-badge" data-testid="gpu-ready-badge">✓ Ready</span>
        )}
      </div>

      <div
        ref={canvasRef}
        data-testid="annotation-canvas"
        className={`vai-canvas ${isDrawing ? 'vai-cursor-draw' : 'vai-cursor-default'} ${status !== 'ready' ? 'vai-canvas-disabled' : ''}`}
        onMouseDown={handleMouseDown as (e: MouseEvent) => void}
        onMouseMove={handleMouseMove as (e: MouseEvent) => void}
        onMouseUp={handleMouseUp as (e: MouseEvent) => void}
        aria-label="Annotation canvas"
        role="application"
      >
        {/* Render Annotations as Red Pen boxes */}
        {annotations.map((ann: Annotation, i: number) => (
          <div
            key={i}
            ref={(el: HTMLDivElement | null) => {
              if (el) {
                el.style.setProperty('--vai-x', `${ann.x * 100}%`);
                el.style.setProperty('--vai-y', `${ann.y * 100}%`);
                el.style.setProperty('--vai-w', `${ann.width * 100}%`);
                el.style.setProperty('--vai-h', `${ann.height * 100}%`);
              }
            }}
            className={`vai-annotation-box ${ann.confirmed ? 'vai-box-confirmed' : 'vai-box-default'}`}
            data-testid={`annotation-box-${i}`}
          />
        ))}

        {/* Live Rect during drawing */}
        {liveRect && (
          <div
            ref={liveRectElRef}
            className="vai-annotation-box vai-box-live"
            data-testid="live-rect"
          />
        )} 
      </div>

      <div data-testid="annotations-list" className="vai-list" role="list">
        {annotations.map((ann: Annotation, i: number) => (
          <div
            key={i}
            data-testid="annotation-item"
            className="vai-item"
            role="listitem"
          >
            <input
              data-testid={`annotation-label-${i}`}
              placeholder="Label"
              value={ann.label}
              onInput={async (e: Event) => {
                const newAnns = [...annotations];
                const val = (e.target as HTMLInputElement).value;
                newAnns[i].label = val;
                setAnnotations(newAnns);
                // If this is a persisted annotation, update server
                try {
                  if (newAnns[i].id) {
                    await fetch(`/api/annotations/${newAnns[i].id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ label: val })
                    });
                  }
                } catch (err) {
                  console.error('Failed to update annotation label', err);
                }
              }}
              className="vai-input"
              aria-label={`Label for annotation ${i + 1}`}
            />
            <input
              data-testid={`annotation-note-${i}`}
              placeholder="Note (optional)"
              value={ann.note}
              onInput={(e: Event) => {
                const newAnns = [...annotations];
                newAnns[i].note = (e.target as HTMLInputElement).value;
                setAnnotations(newAnns);
              }}
              className="vai-input"
              aria-label={`Note for annotation ${i + 1}`}
            />
            <button
              onClick={() => handleConfirm(i)}
              disabled={ann.confirmed}
              className={`vai-btn ${ann.confirmed ? 'vai-btn-confirmed' : 'vai-btn-confirm'}`}
              data-testid={`confirm-btn-${i}`}
            >
              {ann.confirmed ? '✓ Confirmed' : 'Confirm Match'}
            </button>
            <button
              onClick={async () => {
                const annToRemove = annotations[i];
                if (annToRemove && annToRemove.id) {
                  try {
                    const resp = await fetch(`/api/annotations/${annToRemove.id}`, { method: 'DELETE' });
                    if (!resp.ok) throw new Error('delete failed');
                    setAnnotations(annotations.filter((_: Annotation, idx: number) => idx !== i));
                  } catch (err) {
                    console.error('Failed to delete annotation', err);
                    // fallback: still remove locally to preserve UX, but keep console error
                    setAnnotations(annotations.filter((_: Annotation, idx: number) => idx !== i));
                  }
                } else {
                  setAnnotations(annotations.filter((_: Annotation, idx: number) => idx !== i));
                }
              }}
              className="vai-btn vai-btn-danger"
              data-testid={`remove-btn-${i}`}
              aria-label={`Remove annotation ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <style>{`
        /* Full-page blocking modal */
        .vai-fullpage-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
        }
        .vai-error-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .vai-modal-content {
          background: white;
          border-radius: 12px;
          padding: 32px 48px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 400px;
        }
        .vai-error-content {
          border: 2px solid #e74c3c;
        }
        .vai-modal-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e0e0e0;
          border-top-color: #3498db;
          border-radius: 50%;
          animation: vai-spin 1s linear infinite;
          margin: 0 auto 16px;
        }
        .vai-modal-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 8px;
          color: #333;
        }
        .vai-modal-text {
          color: #666;
          margin: 0 0 8px;
          font-size: 0.9rem;
        }
        .vai-modal-retry {
          color: #e67e22;
          font-size: 0.85rem;
          margin: 8px 0 0;
        }
        .vai-error-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .vai-retry-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.95rem;
          margin-top: 16px;
          transition: background 0.2s;
        }
        .vai-retry-btn:hover {
          background: #2980b9;
        }

        /* Controls */
        .vai-controls {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .vai-btn {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        .vai-btn:hover:not(:disabled) {
          background: #f5f5f5;
        }
        .vai-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .vai-btn-active {
          background: #dc3545;
          color: white;
          border-color: #dc3545;
        }
        .vai-btn-primary {
          background: #3498db;
          color: white;
          border-color: #3498db;
        }
        .vai-btn-primary:hover:not(:disabled) {
          background: #2980b9;
        }
        .vai-btn-confirm {
          background: #27ae60;
          color: white;
          border-color: #27ae60;
        }
        .vai-btn-confirmed {
          background: #95a5a6;
          color: white;
          border-color: #95a5a6;
        }
        .vai-btn-danger {
          background: #e74c3c;
          color: white;
          border-color: #e74c3c;
        }
        .vai-btn-danger:hover:not(:disabled) {
          background: #c0392b;
        }
        .vai-status {
          margin-left: 8px;
          color: #666;
          font-size: 0.9rem;
        }
        .vai-ready-badge {
          background: #27ae60;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        /* Canvas */
        .vai-canvas {
          position: relative;
          border: 2px solid #ddd;
          min-height: 240px;
          height: 100%;
          touch-action: none;
          background: #fafafa;
          border-radius: 4px;
          overflow: hidden;
        }
        .vai-canvas-disabled {
          pointer-events: none;
          opacity: 0.7;
        }
        .vai-cursor-draw {
          cursor: crosshair;
        }
        .vai-cursor-default {
          cursor: default;
        }

        /* Annotation boxes */
        .vai-annotation-box {
          position: absolute;
          box-sizing: border-box;
          pointer-events: none;
          left: var(--vai-x);
          top: var(--vai-y);
          width: var(--vai-w);
          height: var(--vai-h);
        }
        .vai-box-default {
          border: 2px solid rgba(220, 20, 60, 0.9);
          background: rgba(220, 20, 60, 0.1);
        }
        .vai-box-confirmed {
          border: 2px solid #27ae60;
          background: rgba(39, 174, 96, 0.1);
        }
        .vai-box-live {
          border: 2px dashed rgba(220, 20, 60, 0.7);
          background: rgba(220, 20, 60, 0.05);
        }

        /* Annotation list */
        .vai-list {
          margin-top: 12px;
        }
        .vai-item {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
          padding: 8px;
          background: #f9f9f9;
          border-radius: 4px;
          flex-wrap: wrap;
        }
        .vai-input {
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
          min-width: 120px;
        }
        .vai-input:focus {
          outline: none;
          border-color: #3498db;
        }

        @keyframes vai-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
