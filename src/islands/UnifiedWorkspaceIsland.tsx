import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
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
  label?: string;
  bbox?: OverlayBbox;
  box?: OverlayBbox;
  bbox_array?: [number, number, number, number];
  pageNumber?: number;
  page?: number;
  paperlessMapping?: string | null;
  paperless_mapping?: string | null;
  paperlessField?: string | null;
  overlayData?: {
    bbox?: OverlayBbox;
    box?: OverlayBbox;
  } | null;
}

interface FieldRecord {
  id?: string;
  name?: string;
  label?: string;
  paperlessMapping?: string | null;
  paperlessField?: string | null;
  bbox?: OverlayBbox;
  overlay?: { bbox?: OverlayBbox };
  overlay_bbox?: OverlayBbox;
  overlayId?: string;
  pageNumber?: number;
  page?: number;
}

function normalizeLookupToken(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/[^a-z0-9:]/g, '');
}

function buildLookupTokens(value: unknown): Set<string> {
  const raw = String(value ?? '').trim();
  const tokens = new Set<string>();
  const add = (candidate: string) => {
    const normalized = normalizeLookupToken(candidate);
    if (normalized) tokens.add(normalized);
  };

  if (!raw) return tokens;
  add(raw);
  if (raw.includes(':')) {
    add(raw.split(':').slice(1).join(':'));
  }
  add(raw.replace(/^metadata:/i, ''));
  add(raw.replace(/^custom_field:/i, ''));
  add(raw.replace(/^customfield:/i, ''));
  return tokens;
}

function matchesLookup(tokens: Set<string>, value: unknown): boolean {
  const normalized = normalizeLookupToken(value);
  return normalized ? tokens.has(normalized) : false;
}

function getBboxFromOverlay(overlay: OverlayRecord | null): OverlayBbox | null {
  if (!overlay) return null;
  if (overlay.bbox) return overlay.bbox;
  if (overlay.box) return overlay.box;
  if (overlay.overlayData?.bbox) return overlay.overlayData.bbox;
  if (overlay.overlayData?.box) return overlay.overlayData.box;
  if (Array.isArray(overlay.bbox_array)) {
    const [x, y, width, height] = overlay.bbox_array;
    return { x, y, width, height };
  }
  return null;
}

function resolveLocateTarget(
  rawFieldId: unknown,
  overlays: OverlayRecord[],
  fields: FieldRecord[]
): { bbox: OverlayBbox; page: number } | null {
  const tokens = buildLookupTokens(rawFieldId);
  if (tokens.size === 0) return null;

  const field = fields.find((item) => (
    matchesLookup(tokens, item.id) ||
    matchesLookup(tokens, item.name) ||
    matchesLookup(tokens, item.label) ||
    matchesLookup(tokens, item.paperlessMapping) ||
    matchesLookup(tokens, item.paperlessField)
  ));

  if (field) {
    const bbox = field.bbox || field.overlay?.bbox || field.overlay_bbox || null;
    const page = field.pageNumber || field.page || 1;
    if (bbox) return { bbox, page };

    if (field.overlayId) {
      const overlayByFieldId = overlays.find((item) => (
        matchesLookup(buildLookupTokens(field.overlayId), item.id) ||
        matchesLookup(buildLookupTokens(field.overlayId), item.overlayId)
      ));
      const overlayBbox = getBboxFromOverlay(overlayByFieldId || null);
      if (overlayBbox) {
        return {
          bbox: overlayBbox,
          page: overlayByFieldId?.pageNumber || overlayByFieldId?.page || page || 1
        };
      }
    }
  }

  const overlay = overlays.find((item) => (
    matchesLookup(tokens, item.id) ||
    matchesLookup(tokens, item.overlayId) ||
    matchesLookup(tokens, item.paperlessMapping) ||
    matchesLookup(tokens, item.paperless_mapping) ||
    matchesLookup(tokens, item.paperlessField) ||
    matchesLookup(tokens, item.label)
  ));
  if (!overlay) return null;
  const bbox = getBboxFromOverlay(overlay);
  if (!bbox) return null;
  const page = overlay.pageNumber || overlay.page || 1;
  return { bbox, page };
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
  const activeDocumentIdRef = useRef<number | string | null>(
    props.document?.id ?? null
  );
  const visualStateRef = useRef({
    overlays: (
      ((props.visual || {}) as Record<string, unknown>).overlays ||
      ((props.visual || {}) as Record<string, unknown>).overlayItems ||
      ((props.visual || {}) as Record<string, unknown>).items ||
      []
    ) as OverlayRecord[],
    fields: (((props.visual || {}) as Record<string, unknown>).fields || []) as FieldRecord[]
  });

  useEffect(() => {
    const visual = (props.visual || {}) as Record<string, unknown>;
    visualStateRef.current = {
      overlays: (visual.overlays || visual.overlayItems || visual.items || []) as OverlayRecord[],
      fields: (visual.fields || []) as FieldRecord[]
    };
  }, [props.visual]);

  useEffect(() => {
    activeDocumentIdRef.current = props.document?.id ?? null;
  }, [props.document?.id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Record<string, unknown>>)?.detail || {};
      const documentId = detail.documentId;
      if (documentId !== undefined && documentId !== null) {
        activeDocumentIdRef.current = documentId as number | string;
      }
      const visual = detail.visual as Record<string, unknown> | undefined;
      if (visual) {
        visualStateRef.current = {
          overlays: (
            visual.overlays ||
            visual.overlayItems ||
            visual.items ||
            []
          ) as OverlayRecord[],
          fields: (visual.fields || []) as FieldRecord[]
        };
      }
    };
    window.addEventListener('workspace:document-switched', handler as EventListener);
    return () => window.removeEventListener('workspace:document-switched', handler as EventListener);
  }, []);

  // Listen for metadata locate events and translate to overlay highlight events
  useEffect(() => {
    const handler = async (e: Event) => {
      const wnd = getWorkspaceWindow();
      const detail = (e as CustomEvent<Record<string, unknown>>)?.detail || {};
      const fieldId = (detail.fieldId || detail.field_id || detail.id) as string | undefined;
      try { wnd.__last_metadata_locate = { fieldId: fieldId as string, handled: false }; } catch (err) { /* ignore */ }
      if (!fieldId) return;

      let overlays = visualStateRef.current.overlays;
      let fields = visualStateRef.current.fields;
      let resolved = resolveLocateTarget(fieldId, overlays, fields);

      // Fallback: fetch latest overlays for the active document when static vm
      // data is stale (e.g., after inline document switch or relabeling).
      const activeDocumentId = activeDocumentIdRef.current;
      if (!resolved && activeDocumentId) {
        try {
          const response = await fetch(
            `/api/visual-overlays/document/${activeDocumentId}`
          );
          if (response.ok) {
            const payload = await response.json();
            overlays = Array.isArray(payload?.overlays)
              ? payload.overlays as OverlayRecord[]
              : [];
            fields = Array.isArray(payload?.fields)
              ? payload.fields as FieldRecord[]
              : fields;
            visualStateRef.current = { overlays, fields };
            resolved = resolveLocateTarget(fieldId, overlays, fields);
          }
        } catch (err) {
          console.warn(
            '[UnifiedWorkspaceIsland] metadata locate fallback fetch failed:',
            err
          );
        }
      }

      if (resolved) {
        window.dispatchEvent(new CustomEvent('overlay:highlight-region', {
          detail: { bbox: resolved.bbox, page: resolved.page }
        }));
        try {
          wnd.__last_metadata_locate = {
            fieldId: fieldId as string,
            handled: true,
            bbox: resolved.bbox,
            page: resolved.page
          };
        } catch (err) { /* ignore */ }
        return;
      }

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
