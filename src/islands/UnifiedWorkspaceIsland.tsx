import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { UnifiedWorkspaceContract } from '../ui/contracts/UnifiedWorkspace.contract';

// Extend the Window interface to include workspace-related global state
interface WorkspaceWindowExtension {
  __last_metadata_locate?: { fieldId: string; handled: boolean; bbox?: OverlayBbox; page?: number };
  __workspaceState?: Record<string, { isDirty?: boolean; lastDirtyAt?: number; lastSavedAt?: number }>;
  __last_workspace_state_change?: { documentId: number | string; isDirty: boolean };
}

// Type-safe window access helper
function getWorkspaceWindow(): Window & WorkspaceWindowExtension {
  return window as Window & WorkspaceWindowExtension;
}

// Type definitions for overlay-related data
interface OverlayBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OverlayRecord {
  id?: string;
  overlayId?: string;
  bbox?: OverlayBbox;
  box?: OverlayBbox;
  bbox_array?: [number, number, number, number];
  pageNumber?: number;
  page?: number;
  paperlessMapping?: string | null;
  paperless_mapping?: string | null;
}

interface FieldRecord {
  id?: string;
  name?: string;
  label?: string;
  paperlessMapping?: string | null;
  bbox?: OverlayBbox;
  overlay?: { bbox?: OverlayBbox };
  overlay_bbox?: OverlayBbox;
  overlayId?: string;
  pageNumber?: number;
  page?: number;
}

interface ReprocessApiErrorPayload {
  error?: string;
  reasonCode?: string;
  errorKey?: string;
  userMessage?: string;
}

interface ReprocessClientError extends Error {
  reasonCode?: string;
  errorKey?: string;
  userMessage?: string;
}

export type UnifiedWorkspaceIslandProps = Partial<UnifiedWorkspaceContract>;

function dispatchEventSafe(name: string, detail?: unknown) {
  try {
    const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null;
    if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(new CustomEvent(name, { detail } as CustomEventInit<unknown>));
  } catch (err) { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent(name, { detail } as CustomEventInit<unknown>));
  } catch (err) { /* ignore */ }
}

function buildReprocessSocketUrl(documentId: number | string): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/reprocess/${documentId}`;
}

const REPROCESS_FRIENDLY_MESSAGES: Record<string, string> = {
  visual_rag_unavailable: (
    'GPU Preparing: visual search is temporarily unavailable. '
    + 'Using text-based extraction fallback.'
  ),
  model_unavailable: (
    'GPU Preparing: visual search is temporarily unavailable. '
    + 'Using text-based extraction fallback.'
  ),
  pipeline_timeout: (
    'Vision model is taking longer than expected. '
    + 'Retrying with exponential backoff.'
  ),
  qdrant_connection_failed: (
    'Vector search is temporarily unavailable because the circuit breaker is '
    + 'open. Please try again later.'
  ),
  invalid_document_format: (
    'This document format is not supported. '
    + 'Please upload a PDF or image file.'
  )
};

function resolveReprocessUserMessage(payload: ReprocessApiErrorPayload): string {
  const explicit = payload.userMessage;
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit;
  }

  const reasonCode = payload.reasonCode
    ? String(payload.reasonCode)
    : '';
  if (reasonCode && REPROCESS_FRIENDLY_MESSAGES[reasonCode]) {
    return REPROCESS_FRIENDLY_MESSAGES[reasonCode];
  }

  return String(payload.error || 'Re-analysis failed');
}

export default function UnifiedWorkspaceIsland(props: UnifiedWorkspaceIslandProps) {
  const [isDirty, setIsDirty] = useState(false);

  // Listen for metadata locate events and translate to overlay highlight events
  useEffect(() => {
    const handler = (e: Event) => {
      const wnd = getWorkspaceWindow();
      const detail = (e as CustomEvent<Record<string, unknown>>)?.detail || {};
      const fieldId = (detail.fieldId || detail.field_id || detail.id) as string | undefined;
      try { wnd.__last_metadata_locate = { fieldId: fieldId as string, handled: false }; } catch (err) { /* ignore */ }
      if (!fieldId) return;

      // Try to resolve using visual overlays and fields
      const visual = (props.visual || {}) as Record<string, unknown>;
      const overlays = (visual.overlays || visual.overlayItems || visual.items || []) as OverlayRecord[];
      const vfields = (visual.fields || []) as FieldRecord[];

      // Helper: find overlay bbox from overlay object
      const getBboxFromOverlay = (ov: OverlayRecord | null): OverlayBbox | null => {
        if (!ov) return null;
        if (ov.bbox) return ov.bbox;
        if (ov.box) return ov.box;
        if (Array.isArray(ov.bbox_array)) {
          const [x, y, w, h] = ov.bbox_array;
          return { x, y, width: w, height: h };
        }
        return null;
      };

      // 1) Try to find a direct field match which includes overlay info
      const found: FieldRecord | undefined = vfields.find((f) => f.id === fieldId || f.name === fieldId || f.label === fieldId || f.paperlessMapping === fieldId);
      if (found && (found.bbox || found.overlay || found.overlayId || found.overlay_bbox)) {
        const bbox = found.bbox || found.overlay?.bbox || found.overlay_bbox || null;
        const page = found.pageNumber || found.page || 1;
        if (bbox) {
          window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page } }));
          try { wnd.__last_metadata_locate = { fieldId: fieldId as string, handled: true, bbox, page }; } catch (err) { /* ignore */ }
          return;
        }
        // If field has overlayId, try to find that overlay
        if (found.overlayId) {
          const overlay = overlays.find((o) => o.id === found.overlayId || o.overlayId === found.overlayId);
          const bbox = getBboxFromOverlay(overlay || null);
          const page = overlay?.pageNumber || overlay?.page || found.pageNumber || 1;
          if (bbox) {
            window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page } }));
            try { wnd.__last_metadata_locate = { fieldId: fieldId as string, handled: true, bbox, page }; } catch (err) { /* ignore */ }
            return;
          }
        }
      }

      // 2) Try to find an overlay by paperlessMapping match
      const overlayByMapping = overlays.find((o) => o.paperlessMapping === fieldId || o.paperless_mapping === fieldId || o.paperless_mapping === (vfields.find((f: FieldRecord) => f.id === fieldId)?.paperlessMapping));
      if (overlayByMapping) {
        const bbox = getBboxFromOverlay(overlayByMapping);
        const page = overlayByMapping?.pageNumber || overlayByMapping?.page || 1;
        if (bbox) {
          window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page } }));
          try { wnd.__last_metadata_locate = { fieldId: fieldId as string, handled: true, bbox, page }; } catch (err) { /* ignore */ }
          return;
        }
      }

      // 3) Try to resolve overlay by id directly
      const overlayById = overlays.find((o) => o.id === fieldId);
      if (overlayById) {
        const bbox = getBboxFromOverlay(overlayById);
        const page = overlayById?.pageNumber || overlayById?.page || 1;
        if (bbox) {
          window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page } }));
          try { wnd.__last_metadata_locate = { fieldId: fieldId as string, handled: true, bbox, page }; } catch (err) { /* ignore */ }
          return;
        }
      }

      // If not found, emit a not-found marker (tests can observe)
      try { wnd.__last_metadata_locate = { fieldId: fieldId as string, handled: false }; } catch (err) { /* ignore */ }
      console.warn('[UnifiedWorkspaceIsland] metadata:locate-field: could not resolve fieldId to overlay bbox', fieldId);
    };

    window.addEventListener('metadata:locate-field', handler as EventListener);
    return () => window.removeEventListener('metadata:locate-field', handler as EventListener);
  }, [props.visual]);

  // Listen for feedback votes from SmartMetadataIsland and persist immediately
  useEffect(() => {
    const feedbackHandler = async (e: Event) => {
      const detail = (e as CustomEvent<{ fieldId?: string | number; vote?: 'up' | 'down' }>)?.detail || {};
      const fieldId = detail.fieldId as string | number | undefined;
      const vote = detail.vote as 'up' | 'down' | undefined;
      const documentId = props.document?.id ?? null;
      if (!fieldId || !vote || !documentId) return;

      try {
        // Fire-and-forget; server will validate and require auth
        const resp = await fetch('/api/feedback/field-vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId, fieldId, vote })
        });

        if (resp.ok) {
          window.dispatchEvent(new CustomEvent('feedback:sent', { detail: { documentId, fieldId, vote } }));
        } else {
          window.dispatchEvent(new CustomEvent('feedback:failed', { detail: { documentId, fieldId, vote, status: resp.status } }));
        }
      } catch (err) {
        // Network error - emit internal failure event for diagnostics
        window.dispatchEvent(new CustomEvent('feedback:failed', { detail: { documentId, fieldId, vote, error: (err as Error).message } }));
      }
    };

    window.addEventListener('feedback:vote', feedbackHandler as EventListener);
    return () => window.removeEventListener('feedback:vote', feedbackHandler as EventListener);
  }, [props.document?.id]);

  // Central workspace dirty-state management
  useEffect(() => {
    const wnd = getWorkspaceWindow();
    // ensure global state container exists
    wnd.__workspaceState = wnd.__workspaceState || {};

    const onDirty = (e: CustomEvent<{ documentId?: number | string }>) => {
      const documentId = e?.detail?.documentId ?? (props.document?.id ?? null);
      if (!documentId) return;
      const state = wnd.__workspaceState || {};
      const docKey = String(documentId);
      state[docKey] = state[docKey] || {};
      state[docKey].isDirty = true;
      state[docKey].lastDirtyAt = Date.now();
      wnd.__workspaceState = state;

      // If this island is showing the same document, update local UI
      if ((props.document?.id ?? null) && Number(props.document?.id) === Number(documentId)) setIsDirty(true);

      try { wnd.__last_workspace_state_change = { documentId, isDirty: true }; } catch (err) { /* ignore */ }
      dispatchEventSafe('workspace:state-change', { documentId, isDirty: true });
    };

    const onSaved = (e: CustomEvent<{ documentId?: number | string }>) => {
      const documentId = e?.detail?.documentId ?? (props.document?.id ?? null);
      if (!documentId) return;
      const state = wnd.__workspaceState || {};
      const docKey = String(documentId);
      state[docKey] = state[docKey] || {};
      state[docKey].isDirty = false;
      state[docKey].lastSavedAt = Date.now();
      wnd.__workspaceState = state;

      if ((props.document?.id ?? null) && Number(props.document?.id) === Number(documentId)) setIsDirty(false);

      try { wnd.__last_workspace_state_change = { documentId, isDirty: false }; } catch (err) { /* ignore */ }
      dispatchEventSafe('workspace:state-change', { documentId, isDirty: false });
    };

    window.addEventListener('workspace:dirty', onDirty as EventListener);
    window.addEventListener('sync:success', onSaved as EventListener);

    // initialize local isDirty from global state
    try {
      const docId = props.document?.id ? String(props.document?.id) : '';
      const initDirty = docId ? wnd.__workspaceState?.[docId]?.isDirty : false;
      setIsDirty(Boolean(initDirty));
    } catch (err) { /* ignore */ }

    // Warn on browser unload when dirty
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      try {
        const docKey = props.document?.id ? String(props.document?.id) : '';
        const wnd = getWorkspaceWindow();
        const state = wnd.__workspaceState || {};
        const dirty = docKey ? state[docKey]?.isDirty : false;
        if (dirty) {
          // Standard way to trigger a browser prompt
          e.preventDefault();
          // Some browsers require returnValue to be set
          (e as BeforeUnloadEvent).returnValue = '';
          return '';
        }
      } catch (err) {
        // ignore
      }
      return undefined;
    };

    window.addEventListener('beforeunload', beforeUnloadHandler as EventListener);

    return () => {
      window.removeEventListener('workspace:dirty', onDirty as EventListener);
      window.removeEventListener('sync:success', onSaved as EventListener);
      window.removeEventListener('beforeunload', beforeUnloadHandler as EventListener);
    };
  }, [props.document?.id]);

  // Handle workspace:save-request events from DocumentContextBarIsland
  useEffect(() => {
    const handleSaveRequest = async (e: Event) => {
      const detail = (e as CustomEvent<{ documentId?: number | string }>)?.detail || {};
      const { documentId } = detail;
      // Only handle if this workspace instance is showing the same document
      if (String(documentId) !== String(props.document?.id)) return;

      try {
        // Call the save API
        const response = await fetch('/api/processing/update-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId,
            // Include metadata from current state if available via global workspace state
          }),
        });

        if (response.ok) {
          window.dispatchEvent(new CustomEvent('workspace:save-complete', {
            detail: { documentId, success: true }
          }));
        } else {
          throw new Error('Save failed');
        }
      } catch (err) {
        window.dispatchEvent(new CustomEvent('workspace:save-failed', {
          detail: { documentId, error: (err as Error).message }
        }));
      }
    };

    window.addEventListener('workspace:save-request', handleSaveRequest as EventListener);
    return () => window.removeEventListener('workspace:save-request', handleSaveRequest as EventListener);
  }, [props.document?.id]);

  // Handle workspace:reprocess-request events from DocumentContextBarIsland
  useEffect(() => {
    const handleReprocessRequest = async (e: Event) => {
      const detail = (e as CustomEvent<{ documentId?: number | string }>)?.detail || {};
      const { documentId } = detail;
      // Only handle if this workspace instance is showing the same document
      if (String(documentId) !== String(props.document?.id)) return;

      let progressSocket: WebSocket | null = null;
      let hasProgressSocket = false;

      try {
        // Show processing state
        window.dispatchEvent(new CustomEvent('workspace:reprocess-started', {
          detail: { documentId }
        }));
        dispatchEventSafe('workspace:reprocess-progress', {
          documentId,
          stage: 'queued',
          label: 'Queued for re-analysis',
          status: 'in_progress',
          percentage: 5,
          details: null,
          timestamp: new Date().toISOString()
        });

        const socketUrl = buildReprocessSocketUrl(String(documentId));
        if (socketUrl && typeof window !== 'undefined' && window.WebSocket) {
          try {
            progressSocket = new window.WebSocket(socketUrl);
            progressSocket.onmessage = (message: MessageEvent<string>) => {
              try {
                const payload = JSON.parse(message.data || '{}');
                hasProgressSocket = true;
                dispatchEventSafe('workspace:reprocess-progress', payload);
              } catch {
                // Ignore malformed payloads
              }
            };
            progressSocket.onerror = () => {
              dispatchEventSafe('workspace:reprocess-progress', {
                documentId,
                stage: 'visual_extraction',
                label: 'Running expert pipeline stages',
                status: 'in_progress',
                percentage: 30,
                details: { source: 'fallback' },
                timestamp: new Date().toISOString()
              });
            };
          } catch {
            // WebSocket optional: fallback to optimistic client-side progress
          }
        }

        // Call the reprocess API
        const response = await fetch(`/api/documents/${documentId}/reprocess`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({} as ReprocessApiErrorPayload));
          const apiError = new Error(
            resolveReprocessUserMessage(errorData)
          ) as ReprocessClientError;
          apiError.reasonCode = errorData.reasonCode;
          apiError.errorKey = errorData.errorKey;
          apiError.userMessage = resolveReprocessUserMessage(errorData);
          throw apiError;
        }

        const result = await response.json();

        if (!hasProgressSocket) {
          dispatchEventSafe('workspace:reprocess-progress', {
            documentId,
            stage: 'completed',
            label: 'Re-analysis complete',
            status: 'completed',
            percentage: 100,
            details: null,
            timestamp: new Date().toISOString()
          });
        }

        // Dispatch success event with results
        window.dispatchEvent(new CustomEvent('workspace:reprocess-complete', {
          detail: {
            documentId,
            success: true,
            classification: result.classification,
            extractedFields: result.extractedFields,
            smartTags: result.smartTags,
            confidence: result.confidence,
            stats: result.stats
          }
        }));

        // Trigger metadata refresh for SmartMetadataIsland
        window.dispatchEvent(new CustomEvent('metadata:refresh', {
          detail: {
            documentId,
            fields: result.extractedFields,
            tags: result.smartTags,
            classification: result.classificationDetails || result.classification
          }
        }));

      } catch (err) {
        console.error('[UnifiedWorkspace] Reprocess failed:', err);
        const reprocessError = err as ReprocessClientError;
        const userMessage = reprocessError.userMessage ||
          reprocessError.message ||
          'Re-analysis failed';
        dispatchEventSafe('workspace:reprocess-progress', {
          documentId,
          stage: 'failed',
          label: userMessage,
          status: 'failed',
          percentage: 100,
          details: {
            error: reprocessError.message,
            userMessage,
            reasonCode: reprocessError.reasonCode || null,
            errorKey: reprocessError.errorKey || null
          },
          timestamp: new Date().toISOString()
        });
        window.dispatchEvent(new CustomEvent('workspace:reprocess-failed', {
          detail: {
            documentId,
            error: userMessage,
            userMessage,
            reasonCode: reprocessError.reasonCode || null,
            errorKey: reprocessError.errorKey || null
          }
        }));
      } finally {
        if (progressSocket) {
          try { progressSocket.close(); } catch { /* ignore */ }
        }
      }
    };

    window.addEventListener('workspace:reprocess-request', handleReprocessRequest as EventListener);
    return () => window.removeEventListener('workspace:reprocess-request', handleReprocessRequest as EventListener);
  }, [props.document?.id]);

  return (
    <div data-testid="unified-workspace-root" data-hydrated="true" style={{ display: 'none' }}>
      {/* Background state coordinator - no visible UI */}
    </div>
  );
}
