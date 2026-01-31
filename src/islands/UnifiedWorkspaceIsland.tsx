import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

function dispatchEventSafe(name: string, detail?: unknown) {
  try {
    const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null;
    if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(new CustomEvent(name, { detail } as CustomEventInit<any>));
  } catch (err) { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent(name, { detail } as CustomEventInit<any>));
  } catch (err) { /* ignore */ }
}

export default function UnifiedWorkspaceIsland(props: any) {
  const [isDirty, setIsDirty] = useState(false);

  // Listen for metadata locate events and translate to overlay highlight events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const fieldId = detail.fieldId || detail.field_id || detail.id;
      try { (window as any).__last_metadata_locate = { fieldId, handled: false }; } catch (err) { /* ignore */ }
      if (!fieldId) return;

      // Try to resolve using visual overlays and fields
      const visual = props.visual || {};
      const overlays = (visual.overlays || visual.overlayItems || visual.items || []) as any[];
      const vfields = (visual.fields || []) as any[];

      // Helper: find overlay bbox from overlay object
      const getBboxFromOverlay = (ov: any) => {
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
      let found: any = vfields.find((f) => f.id === fieldId || f.name === fieldId || f.label === fieldId || f.paperlessMapping === fieldId);
      if (found && (found.bbox || found.overlay || found.overlayId || found.overlay_bbox)) {
        const bbox = found.bbox || found.overlay?.bbox || found.overlay_bbox || null;
        const page = found.pageNumber || found.page || 1;
        if (bbox) {
          window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page } }));
          try { (window as any).__last_metadata_locate = { fieldId, handled: true, bbox, page }; } catch (err) {}
          return;
        }
        // If field has overlayId, try to find that overlay
        if (found.overlayId) {
          const overlay = overlays.find((o) => o.id === found.overlayId || o.overlayId === found.overlayId);
          const bbox = getBboxFromOverlay(overlay);
          const page = overlay?.pageNumber || overlay?.page || found.pageNumber || 1;
          if (bbox) {
            window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page } }));
            try { (window as any).__last_metadata_locate = { fieldId, handled: true, bbox, page }; } catch (err) {}
            return;
          }
        }
      }

      // 2) Try to find an overlay by paperlessMapping match
      const overlayByMapping = overlays.find((o) => o.paperlessMapping === fieldId || o.paperless_mapping === fieldId || o.paperless_mapping === (vfields.find((f:any) => f.id === fieldId)?.paperlessMapping));
      if (overlayByMapping) {
        const bbox = getBboxFromOverlay(overlayByMapping);
        const page = overlayByMapping?.pageNumber || overlayByMapping?.page || 1;
        if (bbox) {
          window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page } }));
          try { (window as any).__last_metadata_locate = { fieldId, handled: true, bbox, page }; } catch (err) {}
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
          try { (window as any).__last_metadata_locate = { fieldId, handled: true, bbox, page }; } catch (err) {}
          return;
        }
      }

      // If not found, emit a not-found marker (tests can observe)
      try { (window as any).__last_metadata_locate = { fieldId, handled: false }; } catch (err) { /* ignore */ }
      console.warn('[UnifiedWorkspaceIsland] metadata:locate-field: could not resolve fieldId to overlay bbox', fieldId);
    };

    window.addEventListener('metadata:locate-field', handler as EventListener);
    return () => window.removeEventListener('metadata:locate-field', handler as EventListener);
  }, [props.visual]);

  // Central workspace dirty-state management
  useEffect(() => {
    // ensure global state container exists
    (window as any).__workspaceState = (window as any).__workspaceState || {};

    const onDirty = (e: Event) => {
      const documentId = (e as CustomEvent)?.detail?.documentId ?? props.documentId ?? null;
      if (!documentId) return;
      const state = (window as any).__workspaceState;
      state[documentId] = state[documentId] || {};
      state[documentId].isDirty = true;
      state[documentId].lastDirtyAt = Date.now();
      (window as any).__workspaceState = state;

      // If this island is showing the same document, update local UI
      if (props.documentId && Number(props.documentId) === Number(documentId)) setIsDirty(true);

      try { (window as any).__last_workspace_state_change = { documentId, isDirty: true }; } catch (err) { /* ignore */ }
      dispatchEventSafe('workspace:state-change', { documentId, isDirty: true });
    };

    const onSaved = (e: Event) => {
      const documentId = (e as CustomEvent)?.detail?.documentId ?? props.documentId ?? null;
      if (!documentId) return;
      const state = (window as any).__workspaceState;
      state[documentId] = state[documentId] || {};
      state[documentId].isDirty = false;
      state[documentId].lastSavedAt = Date.now();
      (window as any).__workspaceState = state;

      if (props.documentId && Number(props.documentId) === Number(documentId)) setIsDirty(false);

      try { (window as any).__last_workspace_state_change = { documentId, isDirty: false }; } catch (err) { /* ignore */ }
      dispatchEventSafe('workspace:state-change', { documentId, isDirty: false });
    };

    window.addEventListener('workspace:dirty', onDirty as EventListener);
    window.addEventListener('sync:success', onSaved as EventListener);

    // initialize local isDirty from global state
    try {
      const initDirty = (window as any).__workspaceState?.[props.documentId]?.isDirty || false;
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
