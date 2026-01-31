import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

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
  paperlessMapping?: string;
  paperless_mapping?: string;
}

interface FieldRecord {
  id?: string;
  name?: string;
  label?: string;
  paperlessMapping?: string;
  bbox?: OverlayBbox;
  overlay?: { bbox?: OverlayBbox };
  overlay_bbox?: OverlayBbox;
  overlayId?: string;
  pageNumber?: number;
  page?: number;
}

interface UnifiedWorkspaceIslandProps {
  documentId?: number;
  visual?: {
    overlays?: OverlayRecord[];
    overlayItems?: OverlayRecord[];
    items?: OverlayRecord[];
    fields?: FieldRecord[];
  };
}

function dispatchEventSafe(name: string, detail?: unknown) {
  try {
    const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null;
    if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(new CustomEvent(name, { detail } as CustomEventInit<unknown>));
  } catch (err) { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent(name, { detail } as CustomEventInit<unknown>));
  } catch (err) { /* ignore */ }
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

  // Central workspace dirty-state management
  useEffect(() => {
    const wnd = getWorkspaceWindow();
    // ensure global state container exists
    wnd.__workspaceState = wnd.__workspaceState || {};

    const onDirty = (e: CustomEvent<{ documentId?: number | string }>) => {
      const documentId = e?.detail?.documentId ?? props.documentId ?? null;
      if (!documentId) return;
      const state = wnd.__workspaceState || {};
      const docKey = String(documentId);
      state[docKey] = state[docKey] || {};
      state[docKey].isDirty = true;
      state[docKey].lastDirtyAt = Date.now();
      wnd.__workspaceState = state;

      // If this island is showing the same document, update local UI
      if (props.documentId && Number(props.documentId) === Number(documentId)) setIsDirty(true);

      try { wnd.__last_workspace_state_change = { documentId, isDirty: true }; } catch (err) { /* ignore */ }
      dispatchEventSafe('workspace:state-change', { documentId, isDirty: true });
    };

    const onSaved = (e: CustomEvent<{ documentId?: number | string }>) => {
      const documentId = e?.detail?.documentId ?? props.documentId ?? null;
      if (!documentId) return;
      const state = wnd.__workspaceState || {};
      const docKey = String(documentId);
      state[docKey] = state[docKey] || {};
      state[docKey].isDirty = false;
      state[docKey].lastSavedAt = Date.now();
      wnd.__workspaceState = state;

      if (props.documentId && Number(props.documentId) === Number(documentId)) setIsDirty(false);

      try { wnd.__last_workspace_state_change = { documentId, isDirty: false }; } catch (err) { /* ignore */ }
      dispatchEventSafe('workspace:state-change', { documentId, isDirty: false });
    };

    window.addEventListener('workspace:dirty', onDirty as EventListener);
    window.addEventListener('sync:success', onSaved as EventListener);

    // initialize local isDirty from global state
    try {
      const docId = props.documentId ? String(props.documentId) : '';
      const initDirty = docId ? wnd.__workspaceState?.[docId]?.isDirty : false;
      setIsDirty(Boolean(initDirty));
    } catch (err) { /* ignore */ }

    return () => {
      window.removeEventListener('workspace:dirty', onDirty as EventListener);
      window.removeEventListener('sync:success', onSaved as EventListener);
    };
  }, [props.documentId]);

  return (
    <div className="h-full w-full flex flex-col p-8">
      <div className="flex-1 border-2 border-dashed border-[#e5e0d8] rounded-lg flex items-center justify-center relative">
        <p className="font-['Space_Grotesk'] text-[#888]">Document Viewer Area Placeholder</p>
        {props.documentId ? (
          <div data-testid="workspace-state-badge" data-state={isDirty ? 'unsaved' : 'clean'} className="absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-semibold bg-white border">
            {isDirty ? 'Unsaved Changes' : 'Saved'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
